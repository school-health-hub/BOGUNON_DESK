import { describe, expect, it } from 'vitest';
import type { MonitorRect } from '../monitor-protocol.js';
import { clipPaletteHitRegions } from '../renderer/palette/hitRegions.js';

describe('clipPaletteHitRegions', () => {
  it.each([
    [{ x: -10, y: 20, width: 30, height: 40 }, { x: 0, y: 20, width: 20, height: 40 }],
    [{ x: 20, y: -10, width: 30, height: 40 }, { x: 20, y: 0, width: 30, height: 30 }],
    [{ x: 90, y: 20, width: 30, height: 40 }, { x: 90, y: 20, width: 10, height: 40 }],
    [{ x: 20, y: 70, width: 30, height: 40 }, { x: 20, y: 70, width: 30, height: 10 }],
    [{ x: -0.25, y: 79.5, width: 10.75, height: 2.25 }, { x: 0, y: 79.5, width: 10.5, height: 0.5 }],
    [{ x: 1.25, y: 2.5, width: 3.75, height: 4.5 }, { x: 1.25, y: 2.5, width: 3.75, height: 4.5 }],
  ])('clips CSS/DIP region %j to viewport without scaling', (rect, expected) => {
    // Given
    const rects = Object.freeze([Object.freeze(rect)]);
    // When
    const result = clipPaletteHitRegions(rects, { width: 100, height: 80 });
    // Then
    expect(result).toEqual([expected]);
  });

  it.each([
    { x: -30, y: 0, width: 30, height: 10 },
    { x: 100, y: 0, width: 10, height: 10 },
    { x: 0, y: -10, width: 10, height: 10 },
    { x: 0, y: 80, width: 10, height: 10 },
    { x: 0, y: 0, width: 0, height: 10 },
    { x: 0, y: 0, width: 10, height: 0 },
    { x: 0, y: 0, width: -10, height: 10 },
    { x: 0, y: 0, width: 10, height: -10 },
    { x: NaN, y: 0, width: 10, height: 10 },
    { x: 0, y: Infinity, width: 10, height: 10 },
    { x: 0, y: 0, width: Infinity, height: 10 },
    { x: 0, y: 0, width: 10, height: NaN },
  ])('omits invisible or invalid region %j', (rect) => {
    // Given
    const viewport = { width: 100, height: 80 };
    // When
    const result = clipPaletteHitRegions([rect], viewport);
    // Then
    expect(result).toEqual([]);
  });

  it('keeps input geometry immutable while preserving region order and count', () => {
    // Given
    const rects: readonly MonitorRect[] = Object.freeze([
      Object.freeze({ x: -10, y: 0, width: 20, height: 20 }),
      Object.freeze({ x: 30, y: 20, width: 10, height: 10 }),
    ]);
    // When
    const result = clipPaletteHitRegions(rects, { width: 100, height: 80 });
    // Then
    expect({ rects, result }).toEqual({
      rects: [{ x: -10, y: 0, width: 20, height: 20 }, { x: 30, y: 20, width: 10, height: 10 }],
      result: [{ x: 0, y: 0, width: 10, height: 20 }, { x: 30, y: 20, width: 10, height: 10 }],
    });
  });
});
