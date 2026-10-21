import { describe, expect, it } from "vitest";
import { createDefaultDashboardLayout } from "./layouts";
import { createDashboardLayout, defaultWidgetLayouts } from "./layouts";
import { isCanonicalDeskLayout, mergeRenderedGridLayout, resolveDeskGeometry } from "./deskGeometry";
import { hideWidget, restoreWidget, toGridLayout } from "./layoutTransforms";
import { parseDashboardLayoutValue } from "./storage";
import { calculateDashboardGridMetrics, applyPreset } from "../components/dashboard/dashboardCanvasSupport";

describe("dense desk geometry", () => {
  it.each([[1366,768,5,56,12,668],[1600,900,5,61,12,718],[1920,1080,5,77,14,896]])("fits bounded real slots at %i pixels", (width,height,calendarRows,rowHeight,margin,contentHeight) => {
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
    expect(metrics).toMatchObject({ rowHeight, margin, contentHeight, requiresScroll: height < 840 });
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
