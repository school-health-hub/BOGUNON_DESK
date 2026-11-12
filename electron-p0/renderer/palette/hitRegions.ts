import type { MonitorRect } from '../../monitor-protocol.js';

export function clipPaletteHitRegions(
  rects: readonly MonitorRect[],
  viewport: { readonly width: number; readonly height: number },
): readonly MonitorRect[] {
  return rects.flatMap((rect): readonly MonitorRect[] => {
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
      || rect.width <= 0 || rect.height <= 0) return [];

    const x = Math.max(0, rect.x);
    const y = Math.max(0, rect.y);
    const width = Math.min(viewport.width, rect.x + rect.width) - x;
    const height = Math.min(viewport.height, rect.y + rect.height) - y;
    return width > 0 && height > 0 ? [{ x, y, width, height }] : [];
  });
}
