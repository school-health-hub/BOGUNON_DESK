// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SurfaceRoot } from "./SurfaceRoot";

afterEach(cleanup);

describe("disconnected Surface", () => {
  it("shows unavailable data and disabled actions without side effects", () => {
    const access = vi.fn(() => { throw new Error("Forbidden browser access"); });
    const targets = [
      [window, "localStorage"], [window, "sessionStorage"],
      [window, "indexedDB"], [document, "cookie"],
      [window, "__TAURI_INTERNALS__"],
    ] as const;
    const descriptors = targets.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key));
    targets.forEach(([target, key]) => Object.defineProperty(target, key, { configurable: true, get: access, set: access }));
    try {
      render(<SurfaceRoot />);
      expect(screen.getByRole("heading", { name: "Surface 준비 중" })).toBeTruthy();
      expect(screen.getByText("Unavailable")).toBeTruthy();
      expect(screen.getByText("실제 업무 데이터가 없습니다.")).toBeTruthy();
      for (const name of ["OpenMain", "RefreshProjection"]) {
        const button = screen.getByRole("button", { name });
        expect(button.hasAttribute("disabled")).toBe(true);
        fireEvent.click(button);
      }
      expect(document.querySelectorAll("a, iframe, input, form")).toHaveLength(0);
      expect(access).toHaveBeenCalledTimes(0);
    } finally {
      targets.forEach(([target, key], index) => {
        const descriptor = descriptors[index];
        if (descriptor) Object.defineProperty(target, key, descriptor);
        else Reflect.deleteProperty(target, key);
      });
    }
  });
});
