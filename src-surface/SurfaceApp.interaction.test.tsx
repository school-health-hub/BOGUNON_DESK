// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SurfaceApp } from "./SurfaceApp";
import { defaultSurfaceLayout, type SurfaceLayout, type SurfaceLayoutStorage } from "./layout";
import { syntheticSurfaceProjection } from "./projection";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const element = (selector: string): HTMLElement => {
  const found = document.querySelector(selector);
  if (!(found instanceof HTMLElement)) throw new Error(`missing test element: ${selector}`);
  return found;
};
const createStorage = () => {
  let saved: SurfaceLayout | null = null;
  const storage: SurfaceLayoutStorage = { load: () => saved, save: (layout) => { saved = layout; } };
  return { storage, saved: () => saved };
};

describe("Surface edit interruption", () => {
  for (const interaction of ["drag", "resize"] as const) {
    it(`cancels an active ${interaction} before mouseup and discards every draft`, () => {
      vi.spyOn(HTMLElement.prototype, "offsetParent", "get")
        .mockImplementation(function (this: HTMLElement) { return this.parentElement; });
      const saved = createStorage();
      const feedback = vi.fn();
      render(<SurfaceApp projection={syntheticSurfaceProjection} storage={saved.storage} onEditingChanged={feedback} />);
      const initialStyle = element('[data-surface-widget="calendar"]').getAttribute("style");
      fireEvent.click(screen.getByRole("button", { name: "위젯 편집" }));
      fireEvent.click(screen.getByRole("button", { name: "날씨 숨기기" }));
      const selector = interaction === "drag" ? ".surface-drag-handle" : ".react-resizable-handle-se";
      fireEvent.mouseDown(element(`[data-surface-widget="calendar"] ${selector}`), { clientX: 100, clientY: 100, button: 0 });
      fireEvent.mouseMove(document, { clientX: 100, clientY: 350 });
      expect(element(".react-grid-placeholder")).toBeTruthy();
      expect(saved.saved()).toEqual(defaultSurfaceLayout);
      fireEvent.keyDown(window, { key: "Escape" });
      expect(document.querySelector(".react-grid-placeholder")).toBeNull();
      expect(document.querySelector(".react-draggable-dragging, .resizing")).toBeNull();
      expect(saved.saved()).toEqual(defaultSurfaceLayout);
      expect(element('[data-surface-widget="calendar"]').getAttribute("style")).toEqual(initialStyle);
      expect(screen.getByRole("article", { name: "날씨" })).toBeTruthy();
      expect(feedback.mock.calls.map(([state]) => state)).toEqual([true, false]);
      fireEvent.mouseMove(document, { clientX: 600, clientY: 600 });
      fireEvent.mouseUp(document, { clientX: 600, clientY: 600 });
      expect(saved.saved()).toEqual(defaultSurfaceLayout);
    });
  }
  it("reports handle pointer and actual resize phases with grid geometry only", () => {
    render(<SurfaceApp projection={syntheticSurfaceProjection} storage={createStorage().storage} />);
    fireEvent.click(screen.getByRole("button", { name: "위젯 편집" }));
    const handle = element('[data-surface-widget="calendar"] .react-resizable-handle-se');
    fireEvent.pointerDown(handle);
    expect(screen.getByLabelText("Resize 입력 진단").textContent).toContain("resize_pointer_started");
    fireEvent.pointerUp(handle);
    expect(screen.getByLabelText("Resize 입력 진단").textContent).toContain("resize_pointer_ended");
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100, button: 0 });
    expect(screen.getByLabelText("Resize 입력 진단").textContent).toContain("resize_started");
    fireEvent.mouseMove(document, { clientX: 100, clientY: 220 });
    fireEvent.mouseUp(document, { clientX: 100, clientY: 220 });
    const diagnostic = screen.getByLabelText("Resize 입력 진단").textContent ?? "";
    expect(diagnostic).toContain("resize_stopped");
    expect(diagnostic).toContain('"before":{"w":6,"h":6}');
    expect(diagnostic).toMatch(/"after":\{"w":6,"h":\d+\}/);
    fireEvent.click(screen.getByRole("button", { name: "편집 완료" }));
    expect(screen.getByLabelText("Resize 입력 진단").textContent).toEqual(diagnostic);
    fireEvent.click(screen.getByRole("button", { name: "위젯 편집" }));
    fireEvent.pointerDown(handle);
    fireEvent.pointerCancel(handle);
    expect(screen.getByLabelText("Resize 입력 진단").textContent).toContain("resize_pointer_cancelled");
  });
});
