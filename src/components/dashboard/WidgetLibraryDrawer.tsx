import { X } from "lucide-react";
import { widgetDefinitions, widgetLibraryCategories } from "../../dashboard/widgetRegistry";
import type { WidgetLayout, WidgetType } from "../../dashboard/types";

type WidgetLibraryDrawerProps = {
  readonly widgets: readonly WidgetLayout[];
  readonly onClose: () => void;
  readonly onRestore: (type: WidgetType) => void;
};

export function WidgetLibraryDrawer({ widgets, onClose, onRestore }: WidgetLibraryDrawerProps) {
  const visibleTypes = new Set(widgets.filter((widget) => widget.visible).map((widget) => widget.type));

  return (
    <aside className="workspace-editor-panel widget-library" id="workspace-widget-panel" aria-label="위젯 편집">
      <header>
        <div>
          <strong>위젯</strong>
        </div>
        <button type="button" aria-label="위젯 편집 닫기" onClick={onClose}><X size={16} /></button>
      </header>
      <p className="workspace-editor-panel__intro">필요한 도구만 현재 데스크에 놓으세요.</p>
      <div className="workspace-editor-panel__body">
        {widgetLibraryCategories.map((category) => {
          const definitions = widgetDefinitions.filter((definition) => definition.category === category.id);
          const activeCount = definitions.filter((definition) => visibleTypes.has(definition.type)).length;
          return (
            <section key={category.id}>
              <h2><span>{category.title}</span><small>{activeCount}/{definitions.length} 사용 중</small></h2>
              <div className="widget-library__list">
                {definitions.map((definition) => {
              const inUse = visibleTypes.has(definition.type);
              const Icon = definition.icon;
              return (
                <article className={inUse ? "is-in-use" : ""} key={definition.type}>
                  <span className="widget-library__icon" aria-hidden="true"><Icon size={17} /></span>
                  <div>
                    <strong>{definition.title}</strong>
                    <p>{definition.description}</p>
                  </div>
                  <button disabled={inUse} type="button" onClick={() => onRestore(definition.type)}>
                    {inUse ? "사용 중" : "추가"}
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
