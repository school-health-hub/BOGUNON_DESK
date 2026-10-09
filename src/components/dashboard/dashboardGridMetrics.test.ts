import { describe, expect, it } from "vitest";
import { createDashboardLayout, defaultAppearance, defaultWidgetLayouts } from "../../dashboard/layouts";
import { hideWidget, mergeGridLayout, restoreWidget, toGridLayout } from "../../dashboard/layoutTransforms";
import { calculateDashboardGridMetrics, getWorkspaceModeClassName, RESET_DASHBOARD_CONFIRMATION, resetDashboardLayout, resolveDashboardGridWidth } from "./dashboardCanvasSupport";

describe("workspace visual mode", () => {
  it("derives the shell mode class from the existing editing state", () => {
    expect(getWorkspaceModeClassName(false)).toBe("is-view-mode");
    expect(getWorkspaceModeClassName(true)).toBe("is-edit-mode");
  });

  it("describes reset as a layout-only action", () => {
    expect(RESET_DASHBOARD_CONFIRMATION).toContain("현재 데스크 배치");
    expect(RESET_DASHBOARD_CONFIRMATION).toContain("기본 데스크형");
    expect(RESET_DASHBOARD_CONFIRMATION).toContain("계정 설정과 업무 데이터는 그대로 유지");
  });

  it("resets widget placement while preserving the current appearance", () => {
    const current = {
      ...createDashboardLayout(defaultWidgetLayouts, defaultAppearance, "default"),
      appearance: { background: "lavender", cardStyle: "flat", cornerStyle: "compact" },
    } as const;
    const reset = resetDashboardLayout(current);

    expect(reset.presetId).toBe("desk");
    expect(reset.appearance).toEqual(current.appearance);
  });
});

describe("dashboard grid metrics", () => {
  it("waits for a measured container width instead of rendering a desktop fallback", () => {
    expect(resolveDashboardGridWidth(null)).toBeNull();
    expect(resolveDashboardGridWidth(1414)).toBe(1414);
    expect(resolveDashboardGridWidth(280)).toBe(320);
  });

  it("fills the available height for a 9-row layout", () => {
    const filled = calculateDashboardGridMetrics(900, 9);
    const tenRows = calculateDashboardGridMetrics(900, 10);

    expect(filled.requiresScroll).toBe(false);
    expect(filled.rowHeight).toBeGreaterThan(tenRows.rowHeight);
    expect(filled.availableHeight - filled.contentHeight).toBeGreaterThanOrEqual(0);
    expect(filled.availableHeight - filled.contentHeight).toBeLessThan(9);
    expect(filled.contentHeight).toBeGreaterThanOrEqual(820);
  });

  it("keeps the existing sizing and scroll boundary for 10 and 11 rows", () => {
    const tenRows = calculateDashboardGridMetrics(900, 10);
    const elevenRows = calculateDashboardGridMetrics(900, 11);

    expect(tenRows.rowHeight).toBe(69);
    expect(tenRows.contentHeight).toBe(816);
    expect(tenRows.requiresScroll).toBe(false);
    expect(elevenRows.rowHeight).toBe(tenRows.rowHeight);
    expect(elevenRows.requiresScroll).toBe(true);
    expect(elevenRows.contentHeight).toBeGreaterThan(elevenRows.availableHeight);
  });

  it("uses 9 rows as the minimum sizing baseline", () => {
    const fiveRows = calculateDashboardGridMetrics(900, 5);
    const nineRows = calculateDashboardGridMetrics(900, 9);

    expect(fiveRows.rowHeight).toBe(nineRows.rowHeight);
    expect(fiveRows.rowHeight).toBeLessThan(90);
    expect(fiveRows.requiresScroll).toBe(false);
  });

  it("preserves the 9, 10, and 11 row boundaries at an 800px viewport", () => {
    const nineRows = calculateDashboardGridMetrics(800, 9);
    const tenRows = calculateDashboardGridMetrics(800, 10);
    const elevenRows = calculateDashboardGridMetrics(800, 11);

    expect(nineRows.requiresScroll).toBe(false);
    expect(nineRows.rowHeight).toBeGreaterThan(tenRows.rowHeight);
    expect(nineRows.contentHeight).toBeLessThanOrEqual(nineRows.availableHeight);
    expect(tenRows.requiresScroll).toBe(false);
    expect(tenRows.contentHeight).toBeLessThanOrEqual(tenRows.availableHeight);
    expect(elevenRows.rowHeight).toBe(tenRows.rowHeight);
    expect(elevenRows.requiresScroll).toBe(true);
    expect(elevenRows.contentHeight).toBeGreaterThan(elevenRows.availableHeight);
  });

  it("keeps the low-height desktop fallback instead of compressing content", () => {
    const compactHeight = calculateDashboardGridMetrics(680, 9);

    expect(compactHeight.availableHeight).toBe(572);
    expect(compactHeight.contentHeight).toBeLessThanOrEqual(compactHeight.availableHeight);
    expect(compactHeight.requiresScroll).toBe(false);
  });

  it("reserves dock-safe space at the supported 700px minimum height", () => {
    const minimumHeight = calculateDashboardGridMetrics(700, 10);

    expect(minimumHeight.availableHeight).toBe(592);
    expect(minimumHeight.contentHeight).toBe(590);
    expect(minimumHeight.requiresScroll).toBe(false);
  });

  it("does not resize or move existing widgets when the meal widget is restored", () => {
    const before = createDashboardLayout(defaultWidgetLayouts, defaultAppearance, "default");
    const after = restoreWidget(before, "meal");
    const existingBefore = before.widgets.filter(({ type }) => type !== "meal");
    const existingAfter = after.widgets.filter(({ type }) => type !== "meal");

    expect(existingAfter).toEqual(existingBefore);
    expect(after.widgets.find(({ type }) => type === "meal")).toMatchObject({
      visible: true,
      x: 9,
      y: 10,
      w: 3,
      h: 3,
    });
    expect(after.presetId).toBeUndefined();
  });

  it("keeps the preset for an unchanged grid callback and clears it after manual editing", () => {
    const before = createDashboardLayout(defaultWidgetLayouts, defaultAppearance, "default");
    const unchanged = mergeGridLayout(before, toGridLayout(before.widgets, true));
    const movedGrid = toGridLayout(before.widgets, true).map((item) => (
      item.i === "widget-clock" ? { ...item, x: 1 } : item
    ));
    const moved = mergeGridLayout(before, movedGrid);
    const hidden = hideWidget(before, "widget-clock");

    expect(unchanged.presetId).toBe("default");
    expect(moved.presetId).toBeUndefined();
    expect(hidden.presetId).toBeUndefined();
  });
});
