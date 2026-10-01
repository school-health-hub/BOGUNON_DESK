import { X } from "lucide-react";
import type { AppearanceBackground, CardStyle, CornerStyle, DashboardAppearance } from "../../dashboard/types";

type AppearancePanelProps = {
  readonly appearance: DashboardAppearance;
  readonly onClose: () => void;
  readonly onUpdate: (appearance: DashboardAppearance) => void;
};

const backgrounds: readonly { readonly id: AppearanceBackground; readonly label: string }[] = [
  { id: "blue-gray", label: "쿨 블루" },
  { id: "white", label: "화이트" },
  { id: "warm-gray", label: "웜 그레이" },
  { id: "mint", label: "민트" },
  { id: "lavender", label: "라벤더" },
];

const cardStyles: readonly { readonly id: CardStyle; readonly label: string }[] = [
  { id: "default", label: "기본" },
  { id: "soft", label: "소프트" },
  { id: "flat", label: "플랫" },
];

const corners: readonly { readonly id: CornerStyle; readonly label: string }[] = [
  { id: "compact", label: "컴팩트" },
  { id: "soft", label: "부드럽게" },
];

export function AppearancePanel({ appearance, onClose, onUpdate }: AppearancePanelProps) {
  return (
    <aside className="workspace-editor-panel appearance-popover" id="workspace-style-panel" aria-label="스타일 편집">
      <header>
        <div><strong>스타일</strong></div>
        <button type="button" aria-label="스타일 편집 닫기" onClick={onClose}><X size={16} /></button>
      </header>
      <p className="workspace-editor-panel__intro">선택하면 현재 데스크에 바로 반영됩니다.</p>
      <div className="workspace-editor-panel__body appearance-popover__body">
        <fieldset>
          <legend>배경</legend>
          <div className="swatch-list">
            {backgrounds.map((item) => (
              <button
                className={appearance.background === item.id ? "is-selected" : ""}
                type="button"
                aria-pressed={appearance.background === item.id}
                key={item.id}
                onClick={() => onUpdate({ ...appearance, background: item.id })}
              >
                <span className={`appearance-canvas-preview bg-${item.id}`} aria-hidden="true"><i /><i /></span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>위젯 스타일</legend>
          <div className="segmented-list card-style-list">
            {cardStyles.map((item) => (
              <button
                className={appearance.cardStyle === item.id ? "is-selected" : ""}
                type="button"
                aria-pressed={appearance.cardStyle === item.id}
                key={item.id}
                onClick={() => onUpdate({ ...appearance, cardStyle: item.id })}
              >
                <span className={`appearance-card-preview is-${item.id}`} aria-hidden="true"><i /><i /></span>
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>모서리</legend>
          <div className="segmented-list corner-style-list">
            {corners.map((item) => (
              <button
                className={appearance.cornerStyle === item.id ? "is-selected" : ""}
                type="button"
                aria-pressed={appearance.cornerStyle === item.id}
                key={item.id}
                onClick={() => onUpdate({ ...appearance, cornerStyle: item.id })}
              >
                <span className={`appearance-corner-preview is-${item.id}`} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </aside>
  );
}
