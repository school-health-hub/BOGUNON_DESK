import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DashboardLayout, WidgetLayout } from '../../../src/dashboard/types';
import { parseDashboardLayoutValue } from '../../../src/dashboard/storage';
import { mergeRenderedGridLayout, resolveDeskGeometry } from '../../../src/dashboard/deskGeometry';
import { widgetRegistry } from '../../../src/dashboard/widgetRegistry';
import type { MonitorProfileView, MonitorSnapshot } from '../../monitor-protocol';
import './monitor-profiles.css';

const geometryFields = [
  { key: 'x', label: '가로 위치', min: 0, max: 11 },
  { key: 'y', label: '세로 위치', min: 0, max: 39 },
  { key: 'w', label: '너비', min: 1, max: 12 },
  { key: 'h', label: '높이', min: 1, max: 40 },
] as const;

type EditorProps = Readonly<{
  profile: MonitorProfileView; layout: DashboardLayout; disabled: boolean;
  save: (layout: DashboardLayout, visible: boolean) => Promise<void>;
}>;

function ProfileEditor({ profile, layout, disabled, save }: EditorProps) {
  const width = profile.display?.workArea.width ?? profile.lastBounds.width;
  const rendered = resolveDeskGeometry(layout, width).widgets;
  const [selectedId, setSelectedId] = useState(rendered[0]?.id ?? '');
  const selected = rendered.find(widget => widget.id === selectedId);
  const [profileVisible, setProfileVisible] = useState(profile.visible);
  if (!selected) return <p>편집할 위젯이 없습니다.</p>;
  const rows = Math.max(1, ...rendered.filter(widget => widget.visible).map(widget => widget.y + widget.h));
  return <div className="monitor-profile-editor">
    <label className="monitor-profile-check"><input type="checkbox" checked={profileVisible} disabled={disabled} onChange={event => setProfileVisible(event.target.checked)}/>이 모니터에 위젯 표시</label>
    <div className="monitor-profile-preview" role="img" aria-label="저장된 모니터 위젯 배치 미리보기" style={{ aspectRatio: `${width} / ${profile.display?.workArea.height ?? profile.lastBounds.height}` }}>
      {rendered.filter(widget => widget.visible).map(widget => <span key={widget.id} className={widget.id === selectedId ? 'is-selected' : ''} style={{ left: `${widget.x / 12 * 100}%`, top: `${widget.y / rows * 100}%`, width: `${widget.w / 12 * 100}%`, height: `${widget.h / rows * 100}%` }}>{widgetRegistry[widget.type].title}</span>)}
    </div>
    <label>편집할 위젯<select value={selectedId} disabled={disabled} onChange={event => setSelectedId(event.target.value)}>{rendered.map(widget => <option key={widget.id} value={widget.id}>{widgetRegistry[widget.type].title}{widget.visible ? '' : ' · 숨김'}</option>)}</select></label>
    <WidgetGeometryForm key={selectedId} widget={selected} rendered={rendered} layout={layout} disabled={disabled} profileVisible={profileVisible} save={save}/>
  </div>;
}

type GeometryProps = Readonly<{
  widget: WidgetLayout; rendered: readonly WidgetLayout[]; layout: DashboardLayout;
  disabled: boolean; profileVisible: boolean; save: EditorProps['save'];
}>;

function WidgetGeometryForm({ widget, rendered, layout, disabled, profileVisible, save }: GeometryProps) {
  const [fields, setFields] = useState({ x: String(widget.x), y: String(widget.y), w: String(widget.w), h: String(widget.h) });
  const [visible, setVisible] = useState(widget.visible);
  const [error, setError] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (disabled) return;
    const geometry = { x: Number(fields.x), y: Number(fields.y), w: Number(fields.w), h: Number(fields.h) };
    const definition = widgetRegistry[widget.type];
    if (Object.values(fields).some(value => !value.trim()) || !Object.values(geometry).every(Number.isInteger) || geometry.x < 0 || geometry.y < 0 ||
      geometry.w < definition.minW || geometry.h < definition.minH || geometry.x + geometry.w > 12 || geometry.y + geometry.h > 40 ||
      (definition.maxW !== undefined && geometry.w > definition.maxW) || (definition.maxH !== undefined && geometry.h > definition.maxH)) {
      setError(`위치는 12열·40행 안의 정수, 크기는 최소 ${definition.minW}×${definition.minH}${definition.maxW ? `, 최대 너비 ${definition.maxW}` : ''}${definition.maxH ? `, 최대 높이 ${definition.maxH}` : ''}로 입력해 주세요.`);
      return;
    }
    const materialized = { ...layout, widgets: rendered };
    const merged = mergeRenderedGridLayout(materialized, rendered, rendered.filter(item => item.visible).map(item => ({ i: item.id, x: item.x, y: item.y, w: item.w, h: item.h, ...(item.id === widget.id ? geometry : {}) })));
    const next: DashboardLayout = { ...merged, presetId: undefined, widgets: merged.widgets.map(item => item.id === widget.id ? { ...item, ...geometry, visible } : item) };
    if (!parseDashboardLayoutValue(next)) { setError('이 배치를 저장할 수 없습니다. 위젯 크기와 위치를 확인해 주세요.'); return; }
    setError('');
    void save(next, profileVisible);
  };
  return <form onSubmit={submit}>
    <fieldset disabled={disabled}><legend>위젯 위치·크기 · 12열 × 40행</legend>
      <div className="monitor-profile-fields">{geometryFields.map(field => <label key={field.key}>{field.label}<input type="number" step="1" min={field.min} max={field.max} value={fields[field.key]} onChange={event => setFields(current => ({ ...current, [field.key]: event.target.value }))}/></label>)}</div>
      <label className="monitor-profile-check"><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)}/>선택한 위젯 표시</label>
      <button type="submit" disabled={disabled}>위젯 배치 적용</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </form>;
}

export function MonitorProfilesPanel({ fallbackLayout }: Readonly<{ fallbackLayout: DashboardLayout }>) {
  const api = window.electronMonitorProfiles;
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState('모니터 정보를 불러오는 중입니다.');
  const [busy, setBusy] = useState(false);
  const [reloadGeneration, setReloadGeneration] = useState(0);
  const writing = useRef(false), revision = useRef(-1), live = useRef(true);
  const receive = (next: MonitorSnapshot): void => {
    if (!live.current || next.revision < revision.current) return;
    revision.current = next.revision;
    setSnapshot(next);
  };
  useEffect(() => {
    live.current = true;
    if (!api) { setStatus('모니터 설정 연결을 사용할 수 없습니다.'); return; }
    const unsubscribe = api.subscribe(receive);
    void api.read().then(value => { receive(value); if (live.current) setStatus('모니터를 선택한 뒤 변경 내용을 적용해 주세요.'); }).catch(reason => {
      if (live.current) setStatus(reason instanceof Error ? `모니터 정보를 읽지 못했습니다. ${reason.message}` : '모니터 정보를 읽지 못했습니다.');
    });
    return () => { live.current = false; unsubscribe(); };
  }, [api]);
  const selected = snapshot?.profiles.find(profile => profile.id === selectedId) ?? snapshot?.profiles.find(profile => profile.connected) ?? snapshot?.profiles[0];
  const parsed = selected?.layout == null ? fallbackLayout : parseDashboardLayoutValue(selected.layout);
  const disabled = busy || !snapshot?.writable || !selected?.connected || selected.dormant || selected.identityKind !== 'device-path' || !parsed;
  const save = async (layout: DashboardLayout, visible: boolean): Promise<void> => {
    if (disabled || writing.current || !snapshot || !selected) return;
    writing.current = true; setBusy(true); setStatus('모니터 배치를 저장 중입니다.');
    try {
      const saved = await api.write({ revision: snapshot.revision, profileId: selected.id, layout, visible });
      receive(saved);
      if (live.current) setStatus('선택한 모니터의 배치를 저장했습니다.');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '저장 실패';
      try {
        receive(await api.read());
        if (live.current) { setReloadGeneration(current => current + 1); setStatus(`저장하지 못했습니다. 최신 설정을 다시 불러왔습니다. 변경 내용을 확인한 뒤 다시 적용해 주세요. ${message}`); }
      } catch (reloadError) {
        if (live.current) { setSnapshot(null); setStatus(`저장·최신 설정 확인 실패. 설정을 다시 열어 주세요. ${reloadError instanceof Error ? reloadError.message : message}`); }
      }
    } finally { writing.current = false; if (live.current) setBusy(false); }
  };
  return <section className="monitor-profiles" aria-label="모니터별 위젯 배치">
    <h3>모니터별 위젯 배치</h3><p>모니터마다 위젯 표시와 배치를 저장합니다. 업무 화면 기본 배치와 Dock 설정은 별도로 유지됩니다.</p>
    {snapshot?.error && <p role="alert">{snapshot.error}</p>}
    {snapshot && !snapshot.writable && <p role="alert">모니터 설정을 저장할 수 없어 읽기 전용으로 표시합니다.</p>}
    {selected && snapshot && <>
      <label>대상 모니터<select value={selected.id} disabled={busy} onChange={event => setSelectedId(event.target.value)}>{snapshot.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}{profile.display?.primary ? ' · 기본' : ''}{profile.connected ? '' : ' · 연결 안 됨'} · {profile.display?.workArea.width ?? profile.lastBounds.width}×{profile.display?.workArea.height ?? profile.lastBounds.height} 화면 기준 크기 · {Math.round((profile.display?.scaleFactor ?? profile.scaleFactor) * 100)}%</option>)}</select></label>
      {!selected.connected || selected.dormant ? <p>연결되지 않은 모니터의 저장된 배치입니다. 다시 연결할 때까지 읽기 전용으로 보존합니다.</p> : selected.identityKind === 'uncertain' ? <p role="alert">이 모니터의 고유 식별을 확인하지 못해 저장을 중단했습니다. 기존 배치는 보존됩니다.</p> : null}
      {selected.layout == null && <p>업무 화면 기본 배치를 사용 중입니다. 적용하면 이 모니터의 배치로 저장합니다.</p>}
      {parsed ? <ProfileEditor key={`${selected.id}-${snapshot.revision}-${reloadGeneration}`} profile={selected} layout={parsed} disabled={Boolean(disabled)} save={save}/> : <p role="alert">저장된 배치를 읽을 수 없습니다. 원본을 유지하고 편집을 중단했습니다.</p>}
    </>}
    {snapshot?.profiles.length === 0 && <p>연결된 모니터가 없습니다. 다시 연결하면 이 화면에 표시됩니다.</p>}
    <p role="status">{status}</p>
  </section>;
}
