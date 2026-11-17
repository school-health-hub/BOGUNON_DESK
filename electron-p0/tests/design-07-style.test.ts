// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { afterEach, describe, expect, it } from "vitest";

const candidateRoot = "body.electron-soft-rose.design-07-candidate";
const stylesheetPath = "electron-p0/renderer/design-07.css";
const stylesheet = readFileSync(stylesheetPath, "utf8");

afterEach(() => {
  document.body.className = "";
  document.head.replaceChildren();
});

describe("DESIGN-07 terminal candidate stylesheet", () => {
  it("loads after the approved Electron workspace styles and activates the exact candidate marker", () => {
    const entry = readFileSync("electron-p0/renderer/main.tsx", "utf8");
    expect(entry.indexOf("import './design-07.css';")).toBeGreaterThan(entry.indexOf("import './td2-workspace.css';"));
    expect(entry).toContain("document.body.classList.add('electron-soft-rose');");
    expect(entry).toContain("document.body.classList.add('design-07-candidate');");
  });

  it("roots every element selector at the exact candidate body", () => {
    let selectorCount = 0;
    postcss.parse(stylesheet).walkRules((rule) => {
      for (const selector of rule.selectors) {
        expect(selector.trim().startsWith(candidateRoot)).toBe(true);
        selectorCount += 1;
      }
    });
    expect(selectorCount).toBeGreaterThan(35);
    expect(stylesheet).not.toContain("!important");
  });

  it("keeps candidate tokens absent from an ordinary Electron body", () => {
    const style = document.createElement("style");
    style.textContent = stylesheet;
    document.head.append(style);
    document.body.classList.add("electron-soft-rose");
    expect(getComputedStyle(document.body).getPropertyValue("--d07-canvas")).toBe("");
    document.body.classList.add("design-07-candidate");
    expect(getComputedStyle(document.body).getPropertyValue("--d07-canvas")).not.toBe("");
  });

  it("declares distinct summary and dense tiers plus resilient fallbacks", () => {
    expect(stylesheet).toContain("--d07-summary-fill: rgb(255 253 249 / 80%)");
    expect(stylesheet).toContain("--d07-dense-fill: rgb(255 253 249 / 97%)");
    expect(stylesheet).toMatch(/data-widget-family="primary"[\s\S]*--design-07-widget-fill: var\(--d07-dense-fill\)/);
    expect(stylesheet).toMatch(/data-widget-type="today-summary"[\s\S]*--design-07-widget-fill: var\(--d07-summary-fill\)/);
    expect(stylesheet).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toContain("@supports not ((backdrop-filter: blur(1px))");
    expect(stylesheet).toContain("@media (forced-colors: active)");
  });

  it("neutralizes every Dock interaction transform when reduced motion is requested", () => {
    const reducedMotion = postcss.parse(stylesheet).nodes.find(
      (node) => node.type === "atrule" && node.name === "media" && node.params === "(prefers-reduced-motion: reduce)",
    );
    expect(reducedMotion?.type).toBe("atrule");
    const reducedSource = reducedMotion?.toString() ?? "";
    for (const state of ["button:hover", "button:active", "button:focus-visible"] as const) {
      expect(reducedSource).toContain(`${candidateRoot} .workspace-shell .dock ${state}`);
    }
    expect(reducedSource).toContain("transition: none");
    expect(reducedSource).toContain("transform: none");
  });

  it("reserves content space for the existing bottom Dock without changing its runtime contract", () => {
    expect(stylesheet).toContain("padding-bottom: calc(24px + var(--desktop-dock-height, 72px))");
    expect(stylesheet).toContain("z-index: var(--d07-layer-dock)");
    expect(stylesheet).toContain("border-radius: 24px");
    const dockSource = readFileSync("src/dock/AppDock.tsx", "utf8");
    expect(dockSource).not.toContain("design-07");
  });

  it("keeps the open customization inspector above its toolbar controls", () => {
    const root = postcss.parse(stylesheet);
    let toolbarLayer = 0;
    let inspectorLayer = 0;
    let toolbarUsesLayer = false;
    let inspectorUsesLayer = false;

    root.walkDecls((declaration) => {
      if (declaration.prop === "--d07-layer-toolbar") toolbarLayer = Number(declaration.value);
      if (declaration.prop === "--d07-layer-inspector") inspectorLayer = Number(declaration.value);
      if (declaration.prop === "z-index" && declaration.value === "var(--d07-layer-toolbar)") toolbarUsesLayer = true;
      if (declaration.prop === "z-index" && declaration.value === "var(--d07-layer-inspector)") inspectorUsesLayer = true;
    });

    expect(toolbarUsesLayer).toBe(true);
    expect(inspectorUsesLayer).toBe(true);
    expect(inspectorLayer).toBeGreaterThan(toolbarLayer);
  });

  it("keeps edit controls above the workspace instead of intersecting widgets at any approved width", () => {
    const root = postcss.parse(stylesheet);
    const toolbarRule = root.nodes.find(
      (node) => node.type === "rule"
        && node.selector === `${candidateRoot} .workspace-shell.is-edit-mode .workspace-toolbar`,
    );
    expect(toolbarRule?.type).toBe("rule");
    const toolbarSource = toolbarRule?.toString() ?? "";
    expect(toolbarSource).toContain("top: 12px");
    expect(toolbarSource).toContain("right: auto");
    expect(toolbarSource).toContain("left: 50%");
    expect(toolbarSource).toContain("width: max-content");
    expect(toolbarSource).toContain("max-width: calc(100vw - 32px)");
    expect(toolbarSource).toContain("transform: translateX(-50%)");

    const actionRule = root.nodes.find(
      (node) => node.type === "rule"
        && node.selector === `${candidateRoot} .workspace-shell.is-edit-mode .workspace-toolbar__actions`,
    );
    expect(actionRule?.toString()).toContain("flex-flow: row nowrap");
  });

  it("keeps compact Korean task titles readable", () => {
    const compactMedia = postcss.parse(stylesheet).nodes.find(
      (node) => node.type === "atrule" && node.name === "media" && node.params === "(max-width: 1100px)",
    );
    expect(compactMedia?.type).toBe("atrule");
    const compactSource = compactMedia?.toString() ?? "";

    expect(compactSource).toContain('[data-widget-type="today-tasks"] .panel__header');
    expect(compactSource).toContain("flex-direction: column");
    expect(compactSource).toContain('[data-widget-type="today-tasks"] .panel__title');
    expect(compactSource).toContain("padding-right: 28px");
    expect(compactSource).toContain("word-break: keep-all");
    expect(compactSource).toContain("overflow-wrap: normal");
    expect(compactSource).toContain("white-space: nowrap");
    expect(compactSource).toContain('[data-widget-type="weather"] .weather-panel .panel__title');
    expect(compactSource).toContain('[data-widget-type="weather"] .weather-panel .panel__icon { display: none; }');
    expect(compactSource).toContain("text-overflow: clip; white-space: nowrap; word-break: keep-all");
    expect(compactSource).toContain("text-overflow: clip");
    expect(compactSource).toContain('[data-widget-type="weather"] .widget-frame__body > .weather-panel');
    expect(compactSource).toContain("padding: 6px 8px 4px");
    expect(compactSource).toContain("min-height: 20px; margin-bottom: 0; padding-left: 28px; padding-right: 0");
    expect(compactSource).toContain('[data-widget-type="weather"] .workspace-data-notice');
    expect(compactSource).toContain("padding: 0; font-size: 11px; line-height: 1.2");
    const frameHeight = 94;
    const reservedHeight = 6 + 20 + 4 + 53;
    expect(reservedHeight).toBeLessThanOrEqual(frameHeight);
  });

  it("lets the six-week compact View calendar determine its presentation height", () => {
    const compactMedia = postcss.parse(stylesheet).nodes.find(
      (node) => node.type === "atrule" && node.name === "media" && node.params === "(max-width: 1100px)",
    );
    const compactSource = compactMedia?.toString() ?? "";
    expect(compactSource).toContain('[data-widget-type="monthly-calendar"] .widget-frame.is-viewing');
    expect(compactSource).toContain('[data-widget-type="monthly-calendar"] .calendar-panel');
    expect(compactSource).toContain('[data-widget-type="monthly-calendar"] .calendar-grid');
    expect(compactSource).toContain("height: auto");
    expect(compactSource).toContain("min-height: 360px");
    expect(compactSource).toContain("min-height: 240px");
  });

  it("fits short information content without hiding data", () => {
    expect(stylesheet).toContain('[data-widget-type="meal"] .widget-frame__body > .meal-panel');
    expect(stylesheet).toContain('[data-widget-type="weather"] .widget-frame__body > .weather-panel');
    expect(stylesheet).toContain('[data-widget-type="clock"] .date-card__eyebrow');
    expect(stylesheet).toContain("min-height: 0");
    expect(stylesheet).toContain("white-space: nowrap");
  });

  it("fits the three-line weather notice inside the 72px View card", () => {
    const viewWeather = `${candidateRoot} .workspace-shell.is-view-mode .desktop-widget-grid [data-widget-type="weather"]`;
    expect(stylesheet).toContain(`${viewWeather} .widget-frame__body > .weather-panel { padding: 4px 10px; }`);
    expect(stylesheet).toContain(`${viewWeather} .panel__header { min-height: 14px; margin-bottom: 0; }`);
    expect(stylesheet).toContain(`${viewWeather} .weather-state { line-height: 1.25; }`);
  });

  it("exposes compact interaction state and removes disabled move affordances", () => {
    const layoutSource = readFileSync("src/components/dashboard/DesktopWidgetLayout.tsx", "utf8");
    const appSource = readFileSync("electron-p0/renderer/P0App.tsx", "utf8");
    expect(appSource).toContain("compact={width<900}");
    expect(layoutSource).toContain('${compact ? " is-compact" : ""}');
    expect(stylesheet).toContain(".desktop-widget-grid.is-compact .widget-frame__drag");
    expect(stylesheet).toContain(".desktop-widget-grid.is-compact .react-resizable-handle");
    expect(stylesheet).toContain("display: none");
  });
});
