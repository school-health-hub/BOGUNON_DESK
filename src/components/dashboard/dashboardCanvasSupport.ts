import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createDashboardLayout, createDefaultDashboardLayout } from "../../dashboard/layouts";
import { dashboardPresets } from "../../dashboard/presets";
import type { DashboardLayout, DashboardPresetId } from "../../dashboard/types";

export const BASE_VIEWPORT_ROWS = 10;
const MIN_VIEWPORT_FILL_ROWS = 9;
export const DESKTOP_WORKSPACE_VERTICAL_RESERVATION = 142;
const LOW_HEIGHT_WORKSPACE_VERTICAL_RESERVATION = 108;
const LOW_HEIGHT_VIEWPORT_MAX = 720;

export const RESET_DASHBOARD_CONFIRMATION = "현재 데스크 배치를 기본 데스크형으로 되돌릴까요?\n\n계정 설정과 업무 데이터는 그대로 유지됩니다.";

export const resetDashboardLayout = (current: DashboardLayout): DashboardLayout => ({
  ...createDefaultDashboardLayout(),
  appearance: current.appearance,
});

export const getWorkspaceModeClassName = (isEditing: boolean): "is-edit-mode" | "is-view-mode" =>
  isEditing ? "is-edit-mode" : "is-view-mode";

type DashboardGridMetrics = {
  readonly availableHeight: number;
  readonly contentHeight: number;
  readonly margin: number;
  readonly requiresScroll: boolean;
  readonly rowHeight: number;
};

export const calculateDashboardGridMetrics = (
  viewportHeight: number,
  visibleRowCount: number,
  denseGeometry?: { readonly rowHeight: number; readonly margin: number },
): DashboardGridMetrics => {
  const safeVisibleRowCount = Math.max(1, visibleRowCount);
  const sizingRowCount = Math.min(
    BASE_VIEWPORT_ROWS,
    Math.max(MIN_VIEWPORT_FILL_ROWS, safeVisibleRowCount),
  );
  const margin = denseGeometry?.margin ?? (viewportHeight < 840 ? 10 : 14);
  const verticalReservation = viewportHeight <= LOW_HEIGHT_VIEWPORT_MAX
    ? LOW_HEIGHT_WORKSPACE_VERTICAL_RESERVATION
    : DESKTOP_WORKSPACE_VERTICAL_RESERVATION;
  const availableHeight = denseGeometry === undefined
    ? Math.max(520, viewportHeight - verticalReservation)
    : Math.max(1, viewportHeight - 180);
  const rowHeight = denseGeometry === undefined ? Math.max(
    44,
    Math.floor((availableHeight - margin * (sizingRowCount - 1)) / sizingRowCount),
  ) : Math.max(denseGeometry.rowHeight, Math.floor((availableHeight - margin * (safeVisibleRowCount - 1)) / safeVisibleRowCount));
  const contentHeight = rowHeight * safeVisibleRowCount + margin * (safeVisibleRowCount - 1);

  return {
    availableHeight,
    contentHeight,
    margin,
    requiresScroll: denseGeometry === undefined ? safeVisibleRowCount > BASE_VIEWPORT_ROWS : contentHeight > availableHeight,
    rowHeight,
  };
};

export const resolveDashboardGridWidth = (measuredWidth: number | null): number | null =>
  measuredWidth === null ? null : Math.max(measuredWidth, 320);

export const useElementWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    setWidth(element.getBoundingClientRect().width);
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setWidth(entry.contentRect.width);
    });
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  return { ref, width };
};

export const useViewportHeight = () => {
  const [height, setHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    const updateHeight = () => setHeight(window.innerHeight);
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  return height;
};

export const useViewportWidth = () => {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const updateWidth = () => setWidth(window.innerWidth);
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);
  return width;
};

export const applyPreset = (
  current: DashboardLayout,
  presetId: DashboardPresetId,
  confirmChange: (message: string) => boolean,
): DashboardLayout => {
  const preset = dashboardPresets.find((item) => item.id === presetId);
  if (preset === undefined) return current;
  if (!confirmChange("현재 화면 배치를 이 프리셋으로 변경할까요?")) return current;
  return { ...createDashboardLayout(preset.layout.widgets, current.appearance, preset.id), ...(preset.layout.gridProfile === undefined ? {} : { gridProfile: preset.layout.gridProfile }) };
};
