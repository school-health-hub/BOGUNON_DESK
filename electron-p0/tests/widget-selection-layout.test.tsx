// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { GridLayout as LibraryGrid } from "react-grid-layout";
import { GridLayout } from "../renderer/adapters/GridLayout";

type GridProps = ComponentProps<typeof LibraryGrid>;
const recorded = vi.hoisted((): { props: GridProps | null } => ({ props: null }));
vi.mock("react-grid-layout", () => ({ GridLayout: (props: GridProps) => { recorded.props = props; return <div />; } }));
afterEach(() => { cleanup(); recorded.props = null; });

const current = (): GridProps => {
  if (recorded.props === null) throw new Error("Grid not rendered");
  return recorded.props;
};
const item = { i: "widget-clock", x: 1, y: 27, w: 2, h: 3 };

it("does not persist automatic compaction after visibility or width changes", () => {
  const save = vi.fn();
  const view = render(<GridLayout width={900} layout={[item]} onLayoutChange={save}><div key={item.i} /></GridLayout>);
  current().onLayoutChange?.([{ ...item, y: 0 }]);
  view.rerender(<GridLayout width={1200} layout={[]} onLayoutChange={save}>{null}</GridLayout>);
  current().onLayoutChange?.([]);
  expect(save).not.toHaveBeenCalled();
});

it.each(["drag", "resize"] as const)("persists an explicit %s result and forwards its existing callback", kind => {
  const save = vi.fn(), stopped = vi.fn();
  render(<GridLayout width={900} layout={[item]} onLayoutChange={save} onDragStop={stopped} onResizeStop={stopped}><div key={item.i} /></GridLayout>);
  const changed = [{ ...item, x: 3, y: 9 }];
  const callback = kind === "drag" ? current().onDragStop : current().onResizeStop;
  callback?.(changed, item, changed[0], null, new Event("mouseup"), null);
  expect(save).toHaveBeenCalledExactlyOnceWith(changed);
  expect(stopped).toHaveBeenCalledOnce();
});
