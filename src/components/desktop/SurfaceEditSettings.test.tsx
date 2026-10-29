// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SurfaceEditSettings } from "./SurfaceEditSettings";

afterEach(cleanup);

describe("SurfaceEditSettings", () => {
  it("offers only the fixed begin action while idle", () => {
    const onBegin = vi.fn();
    render(<SurfaceEditSettings mode="idle" busy={false} onBegin={onBegin} onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /편집 시작/ }));
    expect(onBegin).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /완료/ })).toBeNull();
  });

  it("offers complete and cancel while editing", () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    render(<SurfaceEditSettings mode="editing" busy={false} onBegin={vi.fn()} onComplete={onComplete} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /완료/ }));
    fireEvent.click(screen.getByRole("button", { name: /취소/ }));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
