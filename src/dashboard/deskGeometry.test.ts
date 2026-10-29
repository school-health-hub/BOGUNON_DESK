import { describe, expect, it } from "vitest";
import { createDefaultDashboardLayout } from "./layouts";
import { createDashboardLayout, defaultWidgetLayouts } from "./layouts";
import { isCanonicalDeskLayout, mergeRenderedGridLayout, resolveDeskGeometry } from "./deskGeometry";
import { hideWidget, restoreWidget, toGridLayout } from "./layoutTransforms";
import { parseDashboardLayoutValue } from "./storage";
import { calculateDashboardGridMetrics, applyPreset } from "../components/dashboard/dashboardCanvasSupport";

describe("dense desk geometry", () => {
  it.each([[1440, 900], [1366, 768], [1280, 720]])("gives the default launcher its observed content room at %i pixels", (width, height) => {
    // Given a canonical desk and the 205px content floor measured in browser QA.
    const layout = createDefaultDashboardLayout();
    const geometry = resolveDeskGeometry(layout, width);
    const rows = Math.max(...geometry.widgets.filter((widget) => widget.visible).map((widget) => widget.y + widget.h));
    // When the actual rendered slot height is calculated.
    const metrics = calculateDashboardGridMetrics(height, rows, geometry);
    const launcher = geometry.widgets.find((widget) => widget.type === "quick-launcher");
    const slotHeight = (launcher?.h ?? 0) * metrics.rowHeight + Math.max(0, (launcher?.h ?? 0) - 1) * metrics.margin;
    // Then all content and the observed four-pixel border allowance fit without a nested scrollbar.
    expect(slotHeight).toBeGreaterThanOrEqual(209);
  });
  it("keeps the hidden notification slot below the rendered launcher", () => {
    // Given the canonical desktop including its hidden notification object.
    const layout = createDefaultDashboardLayout();
    // When its presentation is resolved.
    const { widgets } = resolveDeskGeometry(layout, 1366);
    const launcher = widgets.find((widget) => widget.type === "quick-launcher");
    const notifications = widgets.find((widget) => widget.type === "notifications");
    // Then restoring notifications has a separate vertical slot.
    expect(notifications?.y).toBeGreaterThanOrEqual((launcher?.y ?? 0) + (launcher?.h ?? 0));
  });
  it("gives the clock room for its complete time at a narrow desktop width", () => {
    // Given a canonical desk in the 980px desktop window.
    const layout = createDefaultDashboardLayout();
    // When its presentation geometry is resolved.
    const geometry = resolveDeskGeometry(layout, 980);
    const clock = geometry.widgets.find((widget) => widget.type === "clock");
    const columnWidth = (980 - 28 - geometry.margin * 11) / 12;
    // Then the clock has room for its icon, full time, and surface padding.
    expect((clock?.w ?? 0) * columnWidth + ((clock?.w ?? 0) - 1) * geometry.margin).toBeGreaterThanOrEqual(200);
  });
  it("keeps every visible narrow desktop object in a separate slot", () => {
    // Given a canonical narrow desktop.
    const layout = createDefaultDashboardLayout();
    // When the presentation is projected.
    const visible = resolveDeskGeometry(layout, 980).widgets.filter((widget) => widget.visible);
    // Then no two objects compete for the same area.
    for (const [index, left] of visible.entries()) for (const right of visible.slice(index + 1)) {
      expect(left.x < right.x + right.w && left.x + left.w > right.x && left.y < right.y + right.h && left.y + left.h > right.y).toBe(false);
    }
  });
  it.each([375, 899, 980, 1199, 1366])("keeps responsive callbacks inert at %i pixels", (width) => {
    // Given the original canonical state.
    const layout = createDefaultDashboardLayout();
    const rendered = resolveDeskGeometry(layout, width).widgets;
    // When the grid reports the presentation it was given.
    const result = mergeRenderedGridLayout(layout, rendered, toGridLayout(rendered, true));
    // Then the stored object and geometry are unchanged.
    expect(result).toBe(layout);
    expect(result.widgets).toBe(layout.widgets);
  });
  it("preserves custom coordinates at narrow desktop widths", () => {
    // Given an explicitly customized saved desk.
    const original = createDefaultDashboardLayout();
    const custom = { ...original, widgets: original.widgets.map((widget) => widget.type === "clock" ? { ...widget, w: 3 } : widget) };
    // When the window narrows.
    const geometry = resolveDeskGeometry(custom, 980);
    // Then no responsive projection replaces the saved custom coordinates.
    expect(geometry.widgets).toBe(custom.widgets);
  });
  it.each([[1366,768,5,48,12,648,true],[1600,900,5,54,12,714,false],[1920,1080,5,69,14,899,false]] as const)("sizes real slots with an outer scroll fallback at %i pixels", (width,height,calendarRows,rowHeight,margin,contentHeight,requiresScroll) => {
    const geometry = resolveDeskGeometry(createDefaultDashboardLayout(), width);
    const visible = geometry.widgets.filter((widget) => widget.visible);
    const calendar = visible.find((widget) => widget.type === "monthly-calendar");
    const weekly = visible.find((widget) => widget.type === "weekly-schedule");
    const metrics = calculateDashboardGridMetrics(height, Math.max(...visible.map((widget) => widget.y + widget.h)), geometry);
    expect(calendar?.h).toBe(calendarRows);
    expect(calendar?.y).toBe(2);
    expect(calendar?.w).toBe(6);
    expect(weekly?.y).toBe(7);
    expect(metrics.availableHeight - metrics.contentHeight).toBeLessThan(10);
    expect(metrics).toMatchObject({ rowHeight, margin, contentHeight, requiresScroll });
    for (const [index,left] of visible.entries()) for (const right of visible.slice(index+1)) {
      expect(left.x < right.x+right.w && left.x+left.w > right.x && left.y < right.y+right.h && left.y+left.h > right.y).toBe(false);
    }
  });
  it("recognizes canonical geometry independently of appearance, order and empty settings", () => {
    const layout = createDefaultDashboardLayout();
    expect(isCanonicalDeskLayout({ ...layout, appearance: { ...layout.appearance, background: "mint" }, widgets: [...layout.widgets].reverse().map((widget) => ({...widget, settings:{}})) })).toBe(true);
  });
  it("returns the same state for responsive callbacks without persistence churn", () => {
    const layout = createDefaultDashboardLayout();
    for (const width of [1366,1600,1920,1366]) {
      const rendered = resolveDeskGeometry(layout,width).widgets;
      expect(mergeRenderedGridLayout(layout,rendered,toGridLayout(rendered,true))).toBe(layout);
    }
  });
  it("persists displayed coordinates and fine units after manual resize", () => {
    const layout = createDefaultDashboardLayout();
    const rendered = resolveDeskGeometry(layout,1920).widgets;
    const next = toGridLayout(rendered,true).map((item) => item.i === "widget-monthly-calendar" ? {...item,w:7} : item);
    const custom = mergeRenderedGridLayout(layout,rendered,next);
    expect(custom.presetId).toBeUndefined();
    expect(custom.gridProfile).toBe("dense-desk-v2");
    expect(resolveDeskGeometry(custom,1366).widgets).toEqual(custom.widgets);
    expect(custom.widgets.find((widget) => widget.type === "weekly-schedule")?.y).toBe(7);
    expect(parseDashboardLayoutValue(JSON.parse(JSON.stringify(custom)))).toEqual(custom);
  });
  it("keeps displayed coordinates when hiding and restoring at wide width", () => {
    const layout = createDefaultDashboardLayout();
    const rendered = resolveDeskGeometry(layout,1920).widgets;
    const hidden = hideWidget({...layout,widgets:rendered},"widget-meal");
    const restored = restoreWidget(hidden,"meal");
    expect(hidden.gridProfile).toBe("dense-desk-v2");
    expect(restored.widgets.filter((widget) => widget.type !== "meal")).toEqual(rendered.filter((widget) => widget.type !== "meal"));
    expect(resolveDeskGeometry(hidden,1366).widgets).toEqual(hidden.widgets);
  });
  it("preserves absent-profile saved desk and custom geometry", () => {
    const legacy = {...createDashboardLayout(defaultWidgetLayouts),presetId:"desk"} as const;
    const parsed = parseDashboardLayoutValue(legacy);
    expect(parsed?.gridProfile).toBeUndefined();
    expect(parsed?.widgets).toEqual(legacy.widgets);
    expect(resolveDeskGeometry(legacy,1920)).toMatchObject({dense:false,widgets:legacy.widgets});
    expect(applyPreset(legacy,"desk",()=>true).gridProfile).toBe("dense-desk-v2");
  });
  it("rejects unknown profiles at the persistence boundary", () => {
    expect(parseDashboardLayoutValue({...createDefaultDashboardLayout(),gridProfile:"unknown"})).toBeNull();
  });
  it("preserves current metadata when an older render emits an edited callback", () => {
    const layout = createDefaultDashboardLayout();
    const rendered = resolveDeskGeometry(layout,1920).widgets;
    const current = hideWidget({...layout,widgets:rendered},"widget-meal");
    const next = toGridLayout(rendered,true).map((item) => item.i === "widget-clock" ? {...item,w:3} : item);
    const merged = mergeRenderedGridLayout(current,rendered,next);
    expect(merged.widgets.find((widget) => widget.type === "meal")?.visible).toBe(false);
    expect(merged.widgets.find((widget) => widget.type === "clock")?.w).toBe(3);
  });
  it("places calendar at the origin with weekly directly below when starting a desk", () => {
    const layout = createDefaultDashboardLayout();
    const calendar = layout.widgets.find((widget) => widget.type === "monthly-calendar");
    const weekly = layout.widgets.find((widget) => widget.type === "weekly-schedule");
    expect(calendar).toMatchObject({ x: 0, y: 0, w: 8, h: 5 });
    expect(weekly?.y).toBe((calendar?.y ?? 0) + (calendar?.h ?? 0));
  });
  it("fits the visible launcher inside twelve rows when starting a desk", () => {
    const layout = createDefaultDashboardLayout();
    expect(layout.widgets.find((widget) => widget.type === "quick-launcher")).toMatchObject({ visible: true, x: 8, y: 6, w: 4, h: 4 });
    expect(Math.max(...layout.widgets.filter((widget) => widget.visible).map((widget) => widget.y + widget.h))).toBe(12);
  });
});
