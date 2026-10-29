// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SurfaceApp } from "./SurfaceApp";
import { defaultSurfaceLayout, type SurfaceLayout, type SurfaceLayoutStorage } from "./layout";
import { syntheticSurfaceProjection } from "./projection";

afterEach(cleanup);

const createMemoryStorage = (): SurfaceLayoutStorage & Readonly<{ saved: () => SurfaceLayout | null }> => {
  let value: SurfaceLayout | null = null;
  return { load: () => value, save: (layout) => { value = layout; }, saved: () => value };
};

describe("SurfaceApp", () => {
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
