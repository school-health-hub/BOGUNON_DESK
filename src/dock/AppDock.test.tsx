import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppDock } from "./AppDock";
import { createDefaultDockLayout } from "./storage";

describe("AppDock", () => {
  it("keeps launcher names accessible while rendering labels as tooltips", () => {
    const markup = renderToStaticMarkup(
      <AppDock activeActionId="home" dockLayout={createDefaultDockLayout()} onAction={() => undefined} />,
    );

    expect(markup).toContain('aria-label="홈"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('class="dock__tooltip" aria-hidden="true">홈</span>');
    expect(markup).toContain('class="dock__active-indicator"');
    expect(markup).toContain('data-dock-item="home"');
  });

  it("keeps stable item identity hooks when dock items are reordered", () => {
    const layout = createDefaultDockLayout();
    const reversed = { ...layout, items: [...layout.items].reverse() };
    const markup = renderToStaticMarkup(
      <AppDock activeActionId="home" dockLayout={reversed} onAction={() => undefined} />,
    );

    expect(markup.indexOf('data-dock-item="settings"')).toBeLessThan(markup.indexOf('data-dock-item="home"'));
    expect(markup).toContain('data-dock-item="online-health-room"');
    expect(markup).toContain('data-dock-item="work-folder"');
  });
});
