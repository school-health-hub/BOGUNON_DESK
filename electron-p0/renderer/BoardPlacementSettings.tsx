import { useEffect, useState } from 'react';
import { defaultBoardPlacement, type BoardPlacement, type DesktopSurfaceBridge, type DesktopSurfaceDocument } from '../desktop-surface-protocol';

export function BoardPlacementSettings({ bridge }: { readonly bridge: DesktopSurfaceBridge }) {
  const [document, setDocument] = useState<DesktopSurfaceDocument>();
  const [draft, setDraft] = useState<BoardPlacement>(defaultBoardPlacement);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    let active = true;
    void bridge.read().then(value => {
      if (!active) return;
      setDocument(value);
      setDraft(value.boardPlacement ?? defaultBoardPlacement);
    }).catch(() => { if (active) setStatus('화면 배치를 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [bridge]);
  const apply = async () => {
    setBusy(true);
    try {
      const value = await bridge.placeBoard(draft);
      setDocument(value);
      setStatus('화면 배치를 적용했습니다.');
    } catch {
      setStatus('화면 배치를 적용하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  return <section aria-label="화면 배치">
    <h3>화면 배치</h3>
    <fieldset disabled={!document || busy}>
      <legend>사용 방식</legend>
      <label><input type="radio" name="board-preset" checked={draft.preset === 'shared'} onChange={() => setDraft({ ...draft, preset: 'shared' })}/>바탕화면과 함께 사용</label>
      <label><input type="radio" name="board-preset" checked={draft.preset === 'dedicated'} onChange={() => setDraft({ ...draft, preset: 'dedicated' })}/>한쪽 모니터를 업무용으로 사용</label>
      <label>배치 대상 모니터
        <select disabled={draft.preset === 'shared'} value={draft.target ?? ''} onChange={event => setDraft({ ...draft, target: event.target.value || null })}>
          <option value="">주 화면</option>
          {Object.entries(document?.profiles ?? {}).filter(([key, profile]) => !profile.dormant || key === draft.target).map(([key, profile]) =>
            <option key={key} value={key} disabled={profile.dormant}>{profile.monitor.label} · {Math.round(profile.monitor.scaleFactor * 100)}%{profile.dormant ? ' · 연결 해제' : ''}</option>)}
        </select>
      </label>
      <label>바탕화면 아이콘 공간 너비
        <select value={draft.iconSpace} onChange={event => setDraft({ ...draft, iconSpace: Number(event.target.value) })}>
          {[20, 21, 22, 23, 24, 25].map(value => <option key={value} value={value}>{value}%</option>)}
        </select>
      </label>
      <p>미리보기 · {draft.preset === 'shared' ? `왼쪽 ${draft.iconSpace}% 바탕화면 / 오른쪽 ${100 - draft.iconSpace}% 업무 보드` : '선택한 화면에 업무 보드'}</p>
      <p>이 설정은 BOGUNON DESK 배치에만 적용됩니다.</p>
      <button type="button" onClick={() => void apply()}>적용</button>
      <button type="button" onClick={() => { setDraft(document?.boardPlacement ?? defaultBoardPlacement); setStatus('변경을 취소했습니다.'); }}>취소</button>
      <button type="button" onClick={() => setDraft(defaultBoardPlacement)}>기본 배치 복원</button>
    </fieldset>
    <p role="status">{status}</p>
  </section>;
}
