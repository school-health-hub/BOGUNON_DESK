import { X } from "lucide-react";
import { useId } from "react";
import { widgetDefinitions, widgetLibraryCategories } from "../../dashboard/widgetRegistry";
import type { WidgetLayout, WidgetType } from "../../dashboard/types";

type WidgetLibraryDrawerProps = {
  readonly widgets: readonly WidgetLayout[];
  readonly onClose: () => void;
  readonly onHide: (type: WidgetType) => void;
  readonly onRestore: (type: WidgetType) => void;
};

export function WidgetLibraryDrawer({ widgets, onClose, onHide, onRestore }: WidgetLibraryDrawerProps) {
  const libraryId = useId();
  const visibleTypes = new Set(widgets.filter((widget) => widget.visible).map((widget) => widget.type));

  return (
    <aside className="workspace-editor-panel widget-library widget-library--cards" id="workspace-widget-panel" aria-label="위젯 편집">
      <header>
        <div>
          <strong>위젯</strong>
        </div>
        <button type="button" aria-label="위젯 편집 닫기" onClick={onClose}><X size={16} /></button>
      </header>
      <p className="workspace-editor-panel__intro">필요한 위젯을 선택하세요. 꺼도 데이터와 배치는 유지됩니다.</p>
      <div className="workspace-editor-panel__body">
        {widgetLibraryCategories.map((category) => {
          const definitions = widgetDefinitions.filter((definition) => definition.category === category.id);
          const activeCount = definitions.filter((definition) => visibleTypes.has(definition.type)).length;
          return (
            <section key={category.id} aria-labelledby={`${libraryId}-${category.id}`}>
              <h2><span id={`${libraryId}-${category.id}`}>{category.title}</span><small>{activeCount}/{definitions.length} 사용 중</small></h2>
              <div className="widget-library__list">
                {definitions.map((definition) => {
              const inUse = visibleTypes.has(definition.type);
              const Icon = definition.icon;
              return (
                <article className={inUse ? "is-in-use" : ""} key={definition.type} data-widget-type={definition.type}>
                  <span className="widget-library__icon" aria-hidden="true"><Icon size={17} /></span>
                  <div className="widget-library__copy">
                    <strong>{definition.title}</strong>
                    <p id={`${libraryId}-${definition.type}-description`}>{definition.description}</p>
                  </div>
                  <button role="switch" aria-label={`${definition.title} 표시`} aria-describedby={`${libraryId}-${definition.type}-description`} aria-checked={inUse} type="button" onClick={() => inUse ? onHide(definition.type) : onRestore(definition.type)}>
                    <span className="widget-library__track" aria-hidden="true"><span /></span>
                    <span className="widget-library__state" aria-hidden="true">{inUse ? "ON" : "OFF"}</span>
                  </button>
                </article>
              );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
