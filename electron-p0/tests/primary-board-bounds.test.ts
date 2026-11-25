import { expect, it } from 'vitest';
import { desktopBoardBounds } from '../main/desktop-board-bounds';
import { parseBoardPlacement, validateDesktopSurfaceDocument } from '../main/desktop-surface-mode';

it('reserves 22 percent of a single work area in DIP while preserving its origin offsets', () => {
  const workArea = { x: -1536, y: 20, width: 1536, height: 820 };
  expect(desktopBoardBounds(workArea, 1)).toEqual({ x: -1198, y: 20, width: 1198, height: 820 });
  expect(workArea.x).toBe(-1536);
});

it('retains the existing schema and restores an optional board preference', () => {
  const legacy = { version: 2, mode: 'palette', profiles: {}, dockProfileKey: null };
  expect(validateDesktopSurfaceDocument(legacy)).toEqual(legacy);
  const next = { ...legacy, boardPlacement: { preset: 'shared', target: null, iconSpace: 25 } };
  expect(validateDesktopSurfaceDocument(next)).toEqual(next);
  expect(() => parseBoardPlacement({ ...next.boardPlacement, iconSpace: 99 })).toThrow();
  expect(desktopBoardBounds({ x: 10, y: 0, width: 1000, height: 700 }, 1, 25))
    .toEqual({ x: 260, y: 0, width: 750, height: 700 });
});

it('preserves the existing work area for multi-display profiles', () => {
  const workArea = { x: -1280, y: -120, width: 1280, height: 720 };
  expect(desktopBoardBounds(workArea, 2)).toEqual(workArea);
});

it.each([
  [1920, 1040, 422],
  [1600, 860, 352],
  [1366, 728, 301],
  [1536, 832, 338],
  [1280, 688, 282],
  [1093, 582, 240],
])('fits the right-hand board into a %i × %i DIP work area', (width, height, inset) => {
  const workArea = { x: 0, y: 0, width, height };
  const board = desktopBoardBounds(workArea, 1);
  expect(board).toEqual({ x: inset, y: 0, width: width - inset, height });
});
