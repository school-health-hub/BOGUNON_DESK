// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SurfaceRoot } from "./main";
import { syntheticSurfaceProjection } from "./projection";

describe("surface renderer readiness", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/surface.html?generation=7");
  });

  it("announces ready only after the native projection is rendered", async () => {
    let listener: ((event: Readonly<{ data: unknown }>) => void) | undefined;
    const postMessage = vi.fn();
    Object.defineProperty(window, "chrome", {
      configurable: true,
      value: {
        webview: {
          postMessage,
          addEventListener: (_type: "message", next: typeof listener) => { listener = next; },
          removeEventListener: vi.fn(),
        },
      },
    });

    render(<SurfaceRoot />);
    expect(postMessage.mock.calls.map(([value]) => JSON.parse(value as string))).toEqual([
      { generation: 7, sequence: 1, command: "RefreshProjection" },
    ]);

    await act(async () => {
      listener?.({ data: { kind: "SurfaceProjection", projection: syntheticSurfaceProjection } });
    });

    expect(await screen.findByText("합성 보건실 점검표 확인")).not.toBeNull();
    expect(postMessage.mock.calls.map(([value]) => JSON.parse(value as string))).toEqual([
      { generation: 7, sequence: 1, command: "RefreshProjection" },
      { generation: 7, sequence: 2, command: "RendererReady" },
    ]);
  });
});
