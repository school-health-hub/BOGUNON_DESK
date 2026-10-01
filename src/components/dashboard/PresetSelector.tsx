import { Check, X } from "lucide-react";
import { dashboardPresets } from "../../dashboard/presets";
import type { DashboardPresetId } from "../../dashboard/types";

type PresetSelectorProps = {
  readonly currentPresetId: DashboardPresetId | undefined;
  readonly onApply: (presetId: DashboardPresetId) => void;
  readonly onClose: () => void;
};

export function PresetSelector({ currentPresetId, onApply, onClose }: PresetSelectorProps) {
  return (
    <aside className="workspace-editor-panel preset-popover" id="workspace-layout-panel" aria-label="배치 편집">
      <header>
        <div><strong>배치</strong></div>
        <button type="button" aria-label="배치 편집 닫기" onClick={onClose}><X size={16} /></button>
      </header>
      <p className="workspace-editor-panel__intro">원하는 데스크 구성을 바로 적용하세요.</p>
      <div className="workspace-editor-panel__body preset-popover__list">
        {dashboardPresets.map((preset) => {
          const isCurrent = currentPresetId === preset.id;
          const visibleWidgets = preset.layout.widgets.filter((widget) => widget.visible);
          const rowCount = Math.max(1, ...visibleWidgets.map((widget) => widget.y + widget.h));
          return (
            <button
              className={isCurrent ? "is-selected" : ""}
              type="button"
              aria-pressed={isCurrent}
              key={preset.id}
              onClick={() => onApply(preset.id)}
            >
              <span className="preset-preview" aria-hidden="true">
                {visibleWidgets.map((widget) => (
                  <span
                    key={widget.id}
                    style={{
                      left: `${(widget.x / 12) * 100}%`,
                      top: `${(widget.y / rowCount) * 100}%`,
                      width: `${(widget.w / 12) * 100}%`,
                      height: `${(widget.h / rowCount) * 100}%`,
                    }}
                  />
                ))}
              </span>
              <span className="preset-popover__copy">
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
              </span>
              {isCurrent && <span className="preset-popover__current"><Check size={13} /> 사용 중</span>}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
