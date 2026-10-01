import { Wrench, X } from "lucide-react";
import { healthToolCategories, type ToolboxToolId } from "../../tools/toolRegistry";

type ToolboxPanelProps = {
  readonly isLoading: boolean;
  readonly onClose: () => void;
  readonly onExecute: (actionId: ToolboxToolId) => void;
};

export function ToolboxPanel({ isLoading, onClose, onExecute }: ToolboxPanelProps) {
  return (
    <aside className="toolbox-panel" aria-label="업무 도구함">
      <header>
        <div className="toolbox-panel__title-icon"><Wrench size={17} /></div>
        <div><strong>업무 도구</strong><span>자주 사용하는 보건 업무 도구를 실행합니다.</span></div>
        <button type="button" aria-label="업무 도구함 닫기" onClick={onClose}><X size={16} /></button>
      </header>
      <div className="toolbox-panel__categories" aria-busy={isLoading}>
        {healthToolCategories.map((category) => (
          <section key={category.id} aria-labelledby={`tool-category-${category.id}`}>
            <h2 id={`tool-category-${category.id}`}>{category.label}</h2>
            <div className="toolbox-panel__list">
              {category.tools.map((tool) => {
                const Icon = tool.icon;
                return (
                    <button className="toolbox-panel__launch" type="button" disabled={tool.kind === "externalAction" && isLoading} key={tool.id} onClick={() => onExecute(tool.id)}>
                    <span><Icon size={18} /></span>
                    <span><strong>{tool.label}</strong><small>{tool.description}</small></span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
