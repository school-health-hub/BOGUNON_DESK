import { describe, expect, it, vi } from "vitest";
import { createEditStateChannel } from "./editState";
import { sendQaEditCommand } from "./editCommands";

const transport = vi.hoisted(() => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: transport.invoke,
  Channel: class { onmessage: (value: unknown) => void = () => undefined; },
}));

describe("fixed edit feedback channel", () => {
  it("accepts only the three status values without leaking arbitrary payloads", () => {
    const receive = vi.fn();
    const channel = createEditStateChannel(receive);
    for (const value of ["editing", "idle", "closed", "unknown", { capability: "private" }, null, true]) channel.onmessage(value);
    expect(receive.mock.calls).toEqual([["editing"], ["idle"], ["closed"]]);
  });

  it("binds feedback to the existing begin command without another invoke permission", async () => {
    const receive = vi.fn();
    await sendQaEditCommand("begin", receive);
    const [name, args] = transport.invoke.mock.lastCall ?? [];
    expect(name).toBe("begin_desktop_surface_edit");
    args.onState.onmessage("editing");
    args.onState.onmessage("idle");
    expect(receive.mock.calls).toEqual([["editing"], ["idle"]]);
    await sendQaEditCommand("cancel", receive);
    expect(transport.invoke).toHaveBeenLastCalledWith("cancel_desktop_surface_edit");
  });
});
