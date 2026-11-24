import { GripVertical, Settings, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { widgetRegistry } from "../../dashboard/widgetRegistry";
import type { WidgetLayout, WidgetType } from "../../dashboard/types";

const widgetFamilyByType = {
  clock: "info",
  "today-summary": "info",
  "priority-task": "utility",
  "monthly-calendar": "primary",
  "today-tasks": "primary",
  "quick-memo": "utility",
  "quick-launcher": "utility",
  "upcoming-schedule": "utility",
  dday: "info",
  "weekly-schedule": "primary",
  notifications: "utility",
  meal: "info",
  weather: "info",
  "newsletter-shortcut": "utility",
} as const satisfies Record<WidgetType, "primary" | "utility" | "info">;

type WidgetFrameProps = {
  readonly externalSettingsId?: string;
  readonly externalSettingsOpen?: boolean;
  readonly isEditing: boolean;
  readonly isSelected: boolean;
  readonly widget: WidgetLayout;
  readonly onHide: () => void;
  readonly onOpenSettings?: (trigger: HTMLButtonElement) => void;
  readonly onSelect: () => void;
};

export function WidgetFrame({ externalSettingsId, externalSettingsOpen = false, isEditing, isSelected, widget, onHide, onOpenSettings, onSelect }: WidgetFrameProps) {
  const detailsId = useId();
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const closeSettings = () => {
    setIsSettingsOpen(false);
    settingsTrigger.current?.focus();
  };
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const definition = widgetRegistry[widget.type];
  const WidgetComponent = definition.component;
  const categoryLabel = definition.category === "basic" ? "기본" : definition.category === "schedule" ? "일정" : "업무";
  const maxSize = `${definition.maxW ?? "제한 없음"} × ${definition.maxH ?? "제한 없음"}`;

  useEffect(() => {
    if (!isEditing) setIsSettingsOpen(false);
  }, [isEditing]);

  return (
    <section
      className={`widget-frame ${isEditing ? "is-editing" : "is-viewing"}${isSelected ? " is-selected" : ""}${isSettingsOpen || externalSettingsOpen ? " has-settings-open" : ""}`}
      aria-label={definition.title}
      data-widget-family={widgetFamilyByType[widget.type]}
      onFocusCapture={(event) => {
        if (widget.type !== "clock" && widget.type !== "quick-memo" && widget.type !== "quick-launcher") return;
        const control = event.target;
        if (!(control instanceof HTMLElement) || !control.closest(".widget-frame__body")) return;
        // Native textarea focus can expose only its caret, leaving other controls clipped.
        requestAnimationFrame(() => {
          if (control.isConnected && document.activeElement === control) {
            control.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
          }
        });
      }}
      onPointerDown={() => {
        if (isEditing) onSelect();
      }}
    >
      {isEditing && (
        <div className="widget-frame__chrome">
          <button className="widget-frame__drag" type="button" aria-label={`${definition.title} 이동`}>
            <GripVertical size={16} />
          </button>
          <div className="widget-frame__actions">
            <button
              type="button"
              ref={settingsTrigger}
              aria-controls={externalSettingsId ?? detailsId}
              aria-expanded={isSettingsOpen || externalSettingsOpen}
              aria-label={`${definition.title} 설정 보기`}
              onClick={(event) => {
                if (onOpenSettings !== undefined) onOpenSettings(event.currentTarget);
                else setIsSettingsOpen((current) => !current);
              }}
            >
              <Settings size={14} />
            </button>
            <button type="button" aria-label={`${definition.title} 숨기기`} onClick={onHide}>
              <X size={14} />
            </button>
          </div>
          {isSettingsOpen && onOpenSettings === undefined && (
            <div
              className="widget-frame__settings-panel"
              id={detailsId}
              role="dialog"
              aria-label={`${definition.title} 위젯 정보`}
              onKeyDown={(event) => {
                if (event.key === "Escape") { event.stopPropagation(); closeSettings(); }
              }}
            >
              <header>
                <div>
                  <span>{categoryLabel}</span>
                  <strong>{definition.title}</strong>
                </div>
                <button type="button" aria-label="위젯 정보 닫기" onClick={closeSettings}>
                  <X size={14} />
                </button>
              </header>
              <p>{definition.description}</p>
              <dl>
                <div>
                  <dt>현재 크기</dt>
                  <dd>
                    {widget.w} × {widget.h}
                  </dd>
                </div>
                <div>
                  <dt>기본 크기</dt>
                  <dd>
                    {definition.defaultSize.w} × {definition.defaultSize.h}
                  </dd>
                </div>
                <div>
                  <dt>최소 크기</dt>
                  <dd>
                    {definition.minW} × {definition.minH}
                  </dd>
                </div>
                <div>
                  <dt>최대 크기</dt>
                  <dd>{maxSize}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}
      <div className="widget-frame__body">
        <WidgetComponent />
      </div>
    </section>
  );
}
