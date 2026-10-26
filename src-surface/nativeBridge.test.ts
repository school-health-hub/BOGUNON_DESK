import { describe, expect, it, vi } from "vitest";
import { createSurfaceNativeBridge, isApprovedSurfaceActionId, parseSurfaceGeneration } from "./nativeBridge";
import { syntheticSurfaceProjection } from "./projection";

describe("surface native bridge", () => {
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

  it("sends only the existing two-field command contract plus binding values", () => {
    const postMessage = vi.fn();
    const bridge = createSurfaceNativeBridge({ postMessage, addEventListener: vi.fn(), removeEventListener: vi.fn() }, 7);
    expect(bridge.openMain("official-document")).toBe(true);
    expect(bridge.openMain("unknown")).toBe(false);
    bridge.requestProjection();
    expect(postMessage.mock.calls.map(([value]) => JSON.parse(value as string))).toEqual([
      { generation: 7, sequence: 1, command: "OpenMain" },
      { generation: 7, sequence: 2, command: "RefreshProjection" },
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
