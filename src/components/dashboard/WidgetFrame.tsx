import { GripVertical, Settings, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
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
} as const satisfies Record<WidgetType, "primary" | "utility" | "info">;

type WidgetFrameProps = {
  readonly isEditing: boolean;
  readonly isSelected: boolean;
  readonly widget: WidgetLayout;
  readonly onHide: () => void;
  readonly onSelect: () => void;
};

export function WidgetFrame({ isEditing, isSelected, widget, onHide, onSelect }: WidgetFrameProps) {
  const detailsId = useId();
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
      className={`widget-frame ${isEditing ? "is-editing" : "is-viewing"}${isSelected ? " is-selected" : ""}${isSettingsOpen ? " has-settings-open" : ""}`}
      aria-label={definition.title}
      data-widget-family={widgetFamilyByType[widget.type]}
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
              aria-controls={detailsId}
              aria-expanded={isSettingsOpen}
              aria-label={`${definition.title} 설정 보기`}
              onClick={() => setIsSettingsOpen((current) => !current)}
            >
              <Settings size={14} />
            </button>
            <button type="button" aria-label={`${definition.title} 숨기기`} onClick={onHide}>
              <X size={14} />
            </button>
          </div>
          {isSettingsOpen && (
            <div
              className="widget-frame__settings-panel"
              id={detailsId}
              role="dialog"
              aria-label={`${definition.title} 위젯 정보`}
              onKeyDown={(event) => {
                if (event.key === "Escape") setIsSettingsOpen(false);
              }}
            >
              <header>
                <div>
                  <span>{categoryLabel}</span>
                  <strong>{definition.title}</strong>
                </div>
                <button type="button" aria-label="위젯 정보 닫기" onClick={() => setIsSettingsOpen(false)}>
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
