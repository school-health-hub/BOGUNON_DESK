// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GridLayoutProps, Layout } from "react-grid-layout";
import { afterEach, expect, it, vi } from "vitest";
import { SurfaceApp } from "./SurfaceApp";
import { defaultSurfaceLayout, toGridLayout, type SurfaceLayout } from "./layout";
import { syntheticSurfaceProjection } from "./projection";

const captured = vi.hoisted(() => {
  const callbacks: ((layout: Layout) => void)[] = [];
  return { callbacks };
});
vi.mock("react-grid-layout", async (original) => {
  const actual = await original<typeof import("react-grid-layout")>();
  return { ...actual, GridLayout: (props: GridLayoutProps) => {
    if (props.onLayoutChange !== undefined) captured.callbacks.push(props.onLayoutChange);
    return <actual.GridLayout {...props} />;
  } };
});
afterEach(cleanup);

it("rejects cancelled grid callbacks even after a new edit is admitted", () => {
  let saved: SurfaceLayout | null = null;
  render(<SurfaceApp projection={syntheticSurfaceProjection} storage={{ load: () => saved, save: (next) => { saved = next; } }} />);
  fireEvent.click(screen.getByRole("button", { name: "위젯 편집" }));
  const stale = captured.callbacks[captured.callbacks.length - 1];
  if (stale === undefined) throw new Error("missing grid callback");
  fireEvent.keyDown(window, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "위젯 편집" }));
  act(() => stale(toGridLayout(defaultSurfaceLayout).map((item) => item.i === "calendar" ? { ...item, h: 8, y: 3 } : item)));
  fireEvent.click(screen.getByRole("button", { name: "편집 완료" }));
  expect(saved).toEqual(defaultSurfaceLayout);
});
