// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SurfaceApp } from "./SurfaceApp";
import { defaultSurfaceLayout, type SurfaceLayout, type SurfaceLayoutStorage } from "./layout";
import { syntheticSurfaceProjection } from "./projection";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const createMemoryStorage = (): SurfaceLayoutStorage & Readonly<{ saved: () => SurfaceLayout | null }> => {
  let value: SurfaceLayout | null = null;
  return { load: () => value, save: (layout) => { value = layout; }, saved: () => value };
};

describe("SurfaceApp", () => {
  it("enforces calendar resize bounds and retains completed geometry", () => {
    const storage = createMemoryStorage();
    render(<SurfaceApp projection={syntheticSurfaceProjection} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "위젯 편집" }));
    for (const title of ["오늘 할 일", "D-Day", "시계·날짜", "날씨", "빠른 실행"]) fireEvent.click(screen.getByRole("button", { name: `${title} 숨기기` }));
    const resize = document.querySelector('[data-surface-widget="calendar"] .react-resizable-handle-se');
    if (!(resize instanceof HTMLElement)) throw new Error("calendar handle missing");
    fireEvent.mouseDown(resize, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.mouseMove(document, { clientX: 5100, clientY: 5100 });
    fireEvent.mouseUp(document, { clientX: 5100, clientY: 5100 });
    fireEvent.click(screen.getByRole("button", { name: "편집 완료" }));
    expect(storage.saved()?.widgets.find(({ id }) => id === "calendar")).toMatchObject({ width: 12, height: 8 });
    fireEvent.click(screen.getByRole("button", { name: "위젯 편집" }));
    fireEvent.mouseDown(resize, { clientX: 5100, clientY: 5100, button: 0 });
    fireEvent.mouseMove(document, { clientX: 0, clientY: 0 });
    fireEvent.mouseUp(document, { clientX: 0, clientY: 0 });
    fireEvent.click(screen.getByRole("button", { name: "편집 완료" }));
    expect(storage.saved()?.widgets.find(({ id }) => id === "calendar")).toMatchObject({ width: 5, height: 5 });
  });

  it("rejects resizing into another visible widget", () => {
    const storage = createMemoryStorage();
    render(<SurfaceApp projection={syntheticSurfaceProjection} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "위젯 편집" }));
    const resize = document.querySelector('[data-surface-widget="calendar"] .react-resizable-handle-se');
    if (!(resize instanceof HTMLElement)) throw new Error("calendar handle missing");
    fireEvent.mouseDown(resize, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.mouseMove(document, { clientX: 800, clientY: 100 });
    fireEvent.mouseUp(document, { clientX: 800, clientY: 100 });
    fireEvent.click(screen.getByRole("button", { name: "편집 완료" }));
    expect(storage.saved()?.widgets).toEqual(defaultSurfaceLayout.widgets);
  });
  it("moves the calendar and resizes through the real grid handle, then cancels exactly", () => {
    // jsdom has no layout engine; RGL requires a positioned offset parent to admit drag.
    const offsetParent = vi.spyOn(HTMLElement.prototype, "offsetParent", "get")
      .mockImplementation(function (this: HTMLElement) { return this.parentElement; });
    const storage = createMemoryStorage();
    render(<SurfaceApp projection={syntheticSurfaceProjection} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "위젯 편집" }));
    const calendar = document.querySelector('[data-surface-widget="calendar"]');
    const handle = calendar?.querySelector(".surface-drag-handle");
    if (!(calendar instanceof HTMLElement) || !(handle instanceof HTMLElement)) throw new Error("calendar drag handle missing");
    const before = calendar.style.transform;
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.mouseMove(document, { clientX: 100, clientY: 380 });
    fireEvent.mouseUp(document, { clientX: 100, clientY: 380 });
    expect(calendar.style.transform).not.toEqual(before);
    const resize = calendar.querySelector(".react-resizable-handle-se");
    if (!(resize instanceof HTMLElement)) throw new Error("calendar resize handle missing");
    const height = calendar.style.height;
    fireEvent.mouseDown(resize, { clientX: 200, clientY: 200, button: 0 });
    fireEvent.mouseMove(document, { clientX: 200, clientY: 400 });
    fireEvent.mouseUp(document, { clientX: 200, clientY: 400 });
    expect(calendar.style.height).not.toEqual(height);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(storage.saved()).toEqual(defaultSurfaceLayout);
    const restored = document.querySelector('[data-surface-widget="calendar"]');
    if (!(restored instanceof HTMLElement)) throw new Error("restored calendar missing");
    expect(restored.style.transform).toEqual(before);
    offsetParent.mockRestore();
  });
  it("reports native editing transitions including Escape and completion", () => {
    const onEditingChanged = vi.fn();
    const storage = createMemoryStorage();
    const props = { projection: syntheticSurfaceProjection, storage, onEditingChanged, isBrowserPreview: false };
    const { rerender } = render(<SurfaceApp {...props} />);
    rerender(<SurfaceApp {...props} nativeEditCommand={{ sequence: 1, command: "BeginEdit" }} />);
    expect(onEditingChanged).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onEditingChanged).toHaveBeenLastCalledWith(false);
    rerender(<SurfaceApp {...props} nativeEditCommand={{ sequence: 2, command: "BeginEdit" }} />);
    rerender(<SurfaceApp {...props} nativeEditCommand={{ sequence: 3, command: "CompleteEdit" }} />);
    expect(onEditingChanged.mock.calls.map(([value]) => value)).toEqual([true, false, true, false]);
  });
  it("renders exactly the six approved synthetic widgets", () => {
    render(<SurfaceApp projection={syntheticSurfaceProjection} storage={createMemoryStorage()} />);
    for (const title of ["월간 일정", "오늘 할 일", "D-Day", "시계·날짜", "날씨", "빠른 실행"]) {
      expect(screen.getByRole("article", { name: title })).toBeTruthy();
    }
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(screen.getByText(/합성 데이터 전용/)).toBeTruthy();
  });

  it("hides and restores a widget only while editing", () => {
    const storage = createMemoryStorage();
    render(<SurfaceApp projection={syntheticSurfaceProjection} storage={storage} />);
    expect(screen.queryByRole("button", { name: "날씨 숨기기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "위젯 편집" }));
    fireEvent.click(screen.getByRole("button", { name: "날씨 숨기기" }));
    expect(screen.queryByRole("article", { name: "날씨" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "+ 날씨" }));
    expect(screen.getByRole("article", { name: "날씨" })).toBeTruthy();
    expect(storage.saved()?.widgets.find(({ id }) => id === "weather")?.visible).toBe(true);
  });

  it("restores the default layout after edits", () => {
    const storage = createMemoryStorage();
    render(<SurfaceApp projection={syntheticSurfaceProjection} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "위젯 편집" }));
    fireEvent.click(screen.getByRole("button", { name: "D-Day 숨기기" }));
    fireEvent.click(screen.getByRole("button", { name: /기본 배치/ }));
    expect(storage.saved()).toEqual(defaultSurfaceLayout);
    expect(screen.getByRole("article", { name: "D-Day" })).toBeTruthy();
  });

  it("commits native edits for the current session", () => {
    const storage = createMemoryStorage();
    const { rerender } = render(<SurfaceApp projection={syntheticSurfaceProjection} storage={storage} nativeEditCommand={null} isBrowserPreview={false} />);
    rerender(<SurfaceApp projection={syntheticSurfaceProjection} storage={storage} nativeEditCommand={{ sequence: 1, command: "BeginEdit" }} isBrowserPreview={false} />);
    expect(screen.getByText("Surface 편집 중")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "날씨 숨기기" }));
    expect(storage.saved()).toEqual(defaultSurfaceLayout);
    rerender(<SurfaceApp projection={syntheticSurfaceProjection} storage={storage} nativeEditCommand={{ sequence: 2, command: "CompleteEdit" }} isBrowserPreview={false} />);
    expect(screen.queryByText("Surface 편집 중")).toBeNull();
    expect(storage.saved()?.widgets.find(({ id }) => id === "weather")?.visible).toBe(false);
  });

  it("restores the exact pre-edit layout on native cancel and Escape", () => {
    const storage = createMemoryStorage();
    const { rerender } = render(<SurfaceApp projection={syntheticSurfaceProjection} storage={storage} nativeEditCommand={null} isBrowserPreview={false} />);
    rerender(<SurfaceApp projection={syntheticSurfaceProjection} storage={storage} nativeEditCommand={{ sequence: 1, command: "BeginEdit" }} isBrowserPreview={false} />);
    fireEvent.click(screen.getByRole("button", { name: "D-Day 숨기기" }));
    rerender(<SurfaceApp projection={syntheticSurfaceProjection} storage={storage} nativeEditCommand={{ sequence: 2, command: "CancelEdit" }} isBrowserPreview={false} />);
    expect(storage.saved()).toEqual(defaultSurfaceLayout);
    expect(screen.getByRole("article", { name: "D-Day" })).toBeTruthy();

    rerender(<SurfaceApp projection={syntheticSurfaceProjection} storage={storage} nativeEditCommand={{ sequence: 3, command: "BeginEdit" }} isBrowserPreview={false} />);
    fireEvent.click(screen.getByRole("button", { name: "날씨 숨기기" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(storage.saved()).toEqual(defaultSurfaceLayout);
    expect(screen.getByRole("article", { name: "날씨" })).toBeTruthy();
  });

  it("suppresses Quick Launcher while editing", () => {
    const onOpenMain = vi.fn();
    render(<SurfaceApp projection={syntheticSurfaceProjection} storage={createMemoryStorage()} onOpenMain={onOpenMain}
      nativeEditCommand={{ sequence: 1, command: "BeginEdit" }} isBrowserPreview={false} />);
    const launcher = screen.getByRole("button", { name: /공문 작업실/ });
    expect(launcher).toHaveProperty("disabled", true);
    fireEvent.click(launcher);
    expect(onOpenMain).not.toHaveBeenCalled();
  });
});
