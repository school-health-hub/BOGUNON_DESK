// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  createSurfaceNativeBridge,
  isApprovedSurfaceActionId,
  markRendererRuntimeStage,
  parseSurfaceGeneration,
} from "./nativeBridge";
import { syntheticSurfaceProjection } from "./projection";

describe("surface native bridge", () => {
  it("records only a fixed renderer runtime stage on the root element", () => {
    document.body.innerHTML = '<div id="surface-root" data-runtime-stage="html_document_loaded"></div>';
    expect(markRendererRuntimeStage(document, "script_started")).toBe(true);
    expect(document.getElementById("surface-root")?.dataset.runtimeStage).toBe("script_started");
    document.body.innerHTML = "";
    expect(markRendererRuntimeStage(document, "react_mount_complete")).toBe(false);
  });

  it("accepts only the four existing quick-launch action identifiers", () => {
    for (const id of ["official-document", "purchase-helper", "record-helper", "home"]) expect(isApprovedSurfaceActionId(id)).toBe(true);
    expect(isApprovedSurfaceActionId("finance")).toBe(false);
  });

  it("accepts only a positive safe runtime generation", () => {
    expect(parseSurfaceGeneration("?generation=19")).toBe(19);
    for (const search of ["", "?generation=0", "?generation=-1", "?generation=1.5", "?generation=9007199254740992"]) {
      expect(parseSurfaceGeneration(search)).toBeNull();
    }
  });

  it("sends the two commands and one renderer lifecycle signal with binding values", () => {
    const postMessage = vi.fn();
    const bridge = createSurfaceNativeBridge({ postMessage, addEventListener: vi.fn(), removeEventListener: vi.fn() }, 7);
    expect(bridge.openMain("official-document")).toBe(true);
    expect(bridge.openMain("unknown")).toBe(false);
    bridge.requestProjection();
    expect(bridge.notifyRendererReady()).toBe(true);
    expect(bridge.notifyRendererReady()).toBe(false);
    expect(postMessage.mock.calls.map(([value]) => JSON.parse(value as string))).toEqual([
      { generation: 7, sequence: 1, command: "OpenMain" },
      { generation: 7, sequence: 2, command: "RefreshProjection" },
      { generation: 7, sequence: 3, command: "RendererReady" },
    ]);
  });

  it("accepts only the synthetic projection envelope", () => {
    let listener: ((event: Readonly<{ data: unknown }>) => void) | undefined;
    const received = vi.fn();
    const bridge = createSurfaceNativeBridge({
      postMessage: vi.fn(),
      addEventListener: (_type, next) => { listener = next; },
      removeEventListener: vi.fn(),
    }, 1);
    bridge.subscribe(received);
    listener?.({ data: { kind: "SurfaceProjection", projection: syntheticSurfaceProjection } });
    listener?.({ data: { kind: "SurfaceProjection", projection: { schemaVersion: 1, synthetic: false } } });
    listener?.({ data: { kind: "SurfaceProjection", projection: { ...syntheticSurfaceProjection, launchers: [{ actionId: "finance", label: "bad", icon: "dashboard" }] } } });
    expect(received).toHaveBeenCalledOnce();
    expect(received).toHaveBeenCalledWith(syntheticSurfaceProjection);
  });
});
