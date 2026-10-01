import { dockRegistry } from "./dockRegistry";
import type { DesktopActionId } from "../desktop/types";
import type { DockLayout } from "./types";

type AppDockProps = {
  readonly dockLayout: DockLayout;
  readonly activeActionId: DesktopActionId;
  readonly onAction: (actionId: DesktopActionId) => void;
};

export function AppDock({ activeActionId, dockLayout, onAction }: AppDockProps) {
  const visibleItems = dockLayout.items.filter((item) => item.visible);

  return (
    <nav className="dock" aria-label="주요 기능">
      {visibleItems.map((item) => {
        const definition = dockRegistry[item.id];
        const Icon = definition.icon;
        const isActive = definition.actionId === activeActionId;
        return (
          <button
            className={isActive ? "is-active" : ""}
            data-dock-item={item.id}
            type="button"
            aria-label={definition.label}
            aria-current={isActive ? "page" : undefined}
            key={item.id}
            onClick={() => onAction(definition.actionId)}
          >
            <span className="dock__icon" aria-hidden="true"><Icon size={28} strokeWidth={1.75} /></span>
            <span className="dock__tooltip" aria-hidden="true">{definition.label}</span>
            <span className="dock__active-indicator" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
