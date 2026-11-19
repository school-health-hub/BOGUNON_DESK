import { Eye, HelpCircle, LayoutPanelTop, Monitor, Settings2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { widgetRegistry } from "../../dashboard/widgetRegistry";
import type { WidgetLayout, WidgetType } from "../../dashboard/types";
import "./WidgetSettingsPanel.css";

export type WidgetSettingsMonitor = {
  readonly profileKey: string;
  readonly label: string;
  readonly connected: boolean;
};

export type WidgetSettingsDraft = {
  readonly targetProfileKey: string;
  readonly visible: boolean;
};

type WidgetSettingsPanelProps = {
  readonly widget: WidgetLayout;
  readonly monitorLabel: string;
  readonly monitorOptions: readonly WidgetSettingsMonitor[];
  readonly ownerProfileKey: string;
  readonly onCancel: () => void;
  readonly onSave: (draft: WidgetSettingsDraft) => Promise<void>;
};

const contentGuidance = (type: WidgetType): readonly [string, string] => {
  switch (type) {
    case "quick-memo": return ["메모 내용", "메모는 위젯에서 직접 작성합니다. 이 설정창은 메모 내용을 바꾸거나 삭제하지 않습니다."];
    case "upcoming-schedule": return ["표시 일정", "가까운 주요 일정 5건을 날짜순으로 보여 줍니다. 일정 원본은 Workspace와 공유됩니다."];
    case "weekly-schedule": return ["이번 주 범위", "월요일부터 일요일까지의 일정을 보여 줍니다. 일정이 많으면 위젯 안에서 스크롤할 수 있습니다."];
    case "quick-launcher": return ["실행 항목", "등록된 업무 기능과 이 PC의 업무 폴더를 사용합니다. 실행 항목은 Workspace 설정에서 관리합니다."];
    case "dday": return ["D-Day 기준", "등록된 일정 중 다가오는 제출과 행사를 기준으로 남은 날짜를 표시합니다."];
    case "today-tasks": return ["오늘의 업무", "오늘 처리할 업무를 보여 줍니다. 완료 상태와 업무 내용은 원본 업무 데이터에 유지됩니다."];
    default: return ["위젯 내용", widgetRegistry[type].description];
  }
};

export function WidgetSettingsPanel({ widget, monitorLabel, monitorOptions, ownerProfileKey, onCancel, onSave }: WidgetSettingsPanelProps) {
  const definition = widgetRegistry[widget.type];
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [targetProfileKey, setTargetProfileKey] = useState(ownerProfileKey);
  const [visible, setVisible] = useState(widget.visible);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = targetProfileKey !== ownerProfileKey || visible !== widget.visible;
  const guidance = useMemo(() => contentGuidance(widget.type), [widget.type]);
  const monitorChoices = monitorOptions.filter((monitor) => monitor.connected || monitor.profileKey === ownerProfileKey);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => { if (confirmClose) confirmRef.current?.focus(); }, [confirmClose]);

  const requestClose = (): void => {
    if (isSaving) return;
    if (dirty) setConfirmClose(true);
    else onCancel();
  };

  const continueEditing = (): void => {
    setConfirmClose(false);
    requestAnimationFrame(() => closeRef.current?.focus());
  };

  const save = async (): Promise<void> => {
    if (!dirty || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave({ targetProfileKey, visible });
      onCancel();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "위젯 설정을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const trapKeyboard = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (confirmClose) continueEditing();
      else requestClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? [])]
      .filter((element) => !element.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return <div className="widget-settings-backdrop" data-palette-interactive>
    <div
      id="widget-settings-panel"
      ref={dialogRef}
      className="widget-settings-panel"
      role="dialog"
      aria-modal="true"
      aria-label={`${definition.title} 위젯 설정`}
      aria-describedby={descriptionId}
      onKeyDown={trapKeyboard}
    >
      <header className="widget-settings-panel__header">
        <div className="widget-settings-panel__identity">
          <span className="widget-settings-panel__icon" aria-hidden="true"><definition.icon size={22} strokeWidth={1.8} /></span>
          <div>
            <div className="widget-settings-panel__eyebrow"><span>{monitorLabel}</span><span>위젯 설정</span></div>
            <h2 id={titleId}>{definition.title}</h2>
            <p id={descriptionId}>{definition.description}</p>
          </div>
        </div>
        <button ref={closeRef} className="widget-settings-panel__close" type="button" aria-label="위젯 설정 닫기" onClick={requestClose}><X size={20} /></button>
      </header>

      <div className="widget-settings-panel__body">
        <section className="widget-settings-card" aria-labelledby={`${titleId}-content`}>
          <div className="widget-settings-card__heading"><Settings2 size={18} /><div><h3 id={`${titleId}-content`}>내용 설정</h3><p>위젯이 사용하는 정보와 편집 위치를 확인합니다.</p></div></div>
          <div className="widget-settings-card__notice"><strong>{guidance[0]}</strong><span>{guidance[1]}</span></div>
        </section>

        <section className="widget-settings-card" aria-labelledby={`${titleId}-display`}>
          <div className="widget-settings-card__heading"><Eye size={18} /><div><h3 id={`${titleId}-display`}>표시 방식</h3><p>위젯 내용은 삭제하지 않고 화면 표시만 바꿉니다.</p></div></div>
          <label className="widget-settings-toggle">
            <span><strong>위젯 표시</strong><small>{visible ? "선택한 모니터에 표시합니다." : "숨겨도 위젯 데이터는 그대로 유지됩니다."}</small></span>
            <input type="checkbox" aria-label="위젯 표시" checked={visible} onChange={(event) => setVisible(event.target.checked)} />
            <span className="widget-settings-toggle__track" aria-hidden="true"><span /></span>
          </label>
        </section>

        <section className="widget-settings-card" aria-labelledby={`${titleId}-monitor`}>
          <div className="widget-settings-card__heading"><Monitor size={18} /><div><h3 id={`${titleId}-monitor`}>모니터 및 배치</h3><p>저장하기 전까지 실제 모니터와 좌표는 바뀌지 않습니다.</p></div></div>
          <label className="widget-settings-field"><span>표시 모니터</span><select aria-label="표시 모니터" value={targetProfileKey} onChange={(event) => setTargetProfileKey(event.target.value)}>{monitorChoices.map((monitor) => <option key={monitor.profileKey} value={monitor.profileKey}>{monitor.label}{monitor.profileKey === ownerProfileKey ? " · 현재" : ""}</option>)}</select></label>
          <dl className="widget-settings-geometry"><div><dt>위치</dt><dd>{widget.x}, {widget.y}</dd></div><div><dt>크기</dt><dd>{widget.w} × {widget.h}</dd></div><div><dt>저장 방식</dt><dd>저장 후 적용</dd></div></dl>
        </section>

        <section className="widget-settings-card widget-settings-card--compact" aria-labelledby={`${titleId}-extra`}>
          <div className="widget-settings-card__heading"><LayoutPanelTop size={18} /><div><h3 id={`${titleId}-extra`}>위젯별 추가 옵션</h3><p>내용 자체의 편집은 위젯에서 진행합니다.</p></div></div>
          <p className="widget-settings-card__copy">현재 위젯은 별도의 추가 저장 옵션이 없습니다. 배치와 표시 상태만 안전하게 변경할 수 있습니다.</p>
        </section>

        <section className="widget-settings-card widget-settings-card--help" aria-labelledby={`${titleId}-help`}>
          <div className="widget-settings-card__heading"><HelpCircle size={18} /><div><h3 id={`${titleId}-help`}>도움말</h3><p>취소하면 기존 모니터, 위치, 크기와 표시 상태가 유지됩니다.</p></div></div>
        </section>
        {error !== null && <p className="widget-settings-panel__error" role="alert">{error}</p>}
      </div>

      <footer className="widget-settings-panel__footer">
        <span aria-live="polite">{isSaving ? "저장 중…" : dirty ? "저장하지 않은 변경사항이 있습니다." : "현재 설정과 같습니다."}</span>
        <div><button type="button" className="widget-settings-button widget-settings-button--secondary" disabled={isSaving} onClick={requestClose}>취소</button><button type="button" className="widget-settings-button widget-settings-button--primary" disabled={!dirty || isSaving} onClick={() => void save()}>저장</button></div>
      </footer>

      {confirmClose && <div className="widget-settings-confirm" role="alert">
        <strong>저장하지 않은 변경사항이 있습니다.</strong>
        <p>닫으면 이번 변경은 적용되지 않습니다.</p>
        <div><button ref={confirmRef} type="button" onClick={continueEditing}>계속 편집</button><button type="button" onClick={onCancel}>변경 취소하고 닫기</button></div>
      </div>}
    </div>
  </div>;
}
