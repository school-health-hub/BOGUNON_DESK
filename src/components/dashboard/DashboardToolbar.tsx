import { Blocks, Check, LayoutDashboard, LayoutTemplate, Palette, PanelBottom, Plus, RotateCcw } from "lucide-react";
import type { DashboardEditorPanel } from "./useDesktopNavigation";

type DashboardToolbarProps = {
  readonly activePanel: DashboardEditorPanel;
  readonly isEditing: boolean;
  readonly onOpenPanel: (panel: DashboardEditorPanel) => void;
  readonly onOpenQuickAdd: () => void;
  readonly onReset: () => void;
  readonly onToggleEdit: () => void;
};

export function DashboardToolbar({
  activePanel,
  isEditing,
  onOpenPanel,
  onOpenQuickAdd,
  onReset,
  onToggleEdit,
}: DashboardToolbarProps) {
  if (!isEditing) {
    return (
      <div className="workspace-view-actions" aria-label="업무판 빠른 작업">
        <button className="toolbar-button workspace-quick-add-button" type="button" onClick={onOpenQuickAdd}>
          <Plus size={15} /> 빠른 추가
        </button>
        <button className="toolbar-button workspace-customize-button" type="button" onClick={onToggleEdit}>
          <LayoutDashboard size={15} /> 화면 꾸미기
        </button>
      </div>
    );
  }

  return (
    <>
      <header className="workspace-toolbar" aria-label="화면 꾸미기 도구">
        <div className="workspace-toolbar__actions" role="toolbar" aria-label="데스크 편집 도구">
          <button
            className={`toolbar-button${activePanel === "library" ? " is-active" : ""}`}
            type="button"
            aria-controls="workspace-widget-panel"
            aria-pressed={activePanel === "library"}
            onClick={() => onOpenPanel("library")}
          >
            <Blocks size={15} /> 위젯
          </button>
          <button
            className={`toolbar-button${activePanel === "presets" ? " is-active" : ""}`}
            type="button"
            aria-controls="workspace-layout-panel"
            aria-pressed={activePanel === "presets"}
            onClick={() => onOpenPanel("presets")}
          >
            <LayoutTemplate size={15} /> 배치
          </button>
          <button
            className={`toolbar-button${activePanel === "appearance" ? " is-active" : ""}`}
            type="button"
            aria-controls="workspace-style-panel"
            aria-pressed={activePanel === "appearance"}
            onClick={() => onOpenPanel("appearance")}
          >
            <Palette size={15} /> 스타일
          </button>
          <button
            className={`toolbar-button${activePanel === "dock" ? " is-active" : ""}`}
            type="button"
            aria-controls="workspace-dock-panel"
            aria-pressed={activePanel === "dock"}
            onClick={() => onOpenPanel("dock")}
          >
            <PanelBottom size={15} /> Dock
          </button>
          <span className="workspace-toolbar__divider" aria-hidden="true" />
          <button className="toolbar-button is-reset is-icon-only" type="button" aria-label="기본 데스크형으로 초기화" onClick={onReset}>
            <RotateCcw size={15} aria-hidden="true" />
          </button>
          <button className="toolbar-button is-primary" type="button" onClick={onToggleEdit}>
            <Check size={15} /> 완료
          </button>
        </div>
      </header>
      <p className="workspace-toolbar__hint">끌어서 이동 · 모서리에서 크기 변경</p>
    </>
  );
}
