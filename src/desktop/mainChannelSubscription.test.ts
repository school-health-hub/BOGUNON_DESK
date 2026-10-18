// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MainChannelMessage } from "./mainChannelSubscription";
import type { MainChannelFrame } from "./mainChannelSubscriptionFrames";

const native = vi.hoisted(() => {
  class FakeChannel {
    onmessage: (message: MainChannelFrame) => void = () => undefined;
    transfer = 0;
    constructor() { channels.push(this); }
    send(message: MainChannelMessage) {
      this.transfer += 1;
      this.onmessage({ transfer: this.transfer, index: 0, total: 1, data: JSON.stringify(message) });
    }
  }
  const channels: FakeChannel[] = [];
  const invoke = vi.fn<(command: string, args: unknown) => Promise<number | void>>();
  return { Channel: FakeChannel, channels, invoke };
});
vi.mock("@tauri-apps/api/core", () => ({ Channel: native.Channel, invoke: native.invoke }));
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }
function channel(index = 0) {
  const result = native.channels[index];
  if (result === undefined) throw new Error("Expected native channel");
  return result;
}

beforeEach(() => {
  vi.resetModules();
  native.channels.length = 0;
  native.invoke.mockReset();
  native.invoke.mockImplementation(async (command) => command === "register_main_channel" ? 7 : undefined);
});
afterEach(async () => { window.dispatchEvent(new Event("pagehide")); await flush(); });

describe("shared Main channel", () => {
  it("shares one registration and preserves payload ordering after acknowledgement", async () => {
    // Given two consumers of the same native session.
    const { subscribeMainChannel } = await import("./mainChannelSubscription");
    const seen: (string | number)[] = [];
    const first = subscribeMainChannel("desktop:notice", (payload) => seen.push(payload));
    const second = subscribeMainChannel("purchase:analysis-start", (payload) => seen.push(payload));
    // When native delivers ordered messages after readiness.
    await Promise.all([first.ready, second.ready]);
    channel().send({ event: "desktop:notice", payload: "ready" });
    channel().send({ event: "purchase:analysis-start", payload: 42 });
    // Then both use one registration and observe unchanged payloads.
    expect(native.invoke).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(["ready", 42]);
    first.dispose();
    await flush();
    expect(native.invoke).toHaveBeenCalledTimes(1);
    second.dispose();
    await flush();
    expect(native.invoke).toHaveBeenLastCalledWith("unregister_main_channel", { registration: 7 });
  });

  it("preserves all six event payload schemas", async () => {
    // Given subscribers for every Main event.
    const { subscribeMainChannel } = await import("./mainChannelSubscription");
    const seen: unknown[] = [];
    const subscriptions = [
      subscribeMainChannel("desktop:navigate", (payload) => seen.push(payload)),
      subscribeMainChannel("desktop:notice", (payload) => seen.push(payload)),
      subscribeMainChannel("desktop:file-drop", (payload) => seen.push(payload)),
      subscribeMainChannel("purchase:analysis-start", (payload) => seen.push(payload)),
      subscribeMainChannel("purchase:analysis", (payload) => seen.push(payload)),
      subscribeMainChannel("purchase:analysis-error", (payload) => seen.push(payload)),
    ];
    await Promise.all(subscriptions.map((subscription) => subscription.ready));
    const result = { generation: 2, result: { items: [], sources: [], candidates: [] } };
    const failure = { generation: 2, message: "failed" };
    // When native delivers all event variants in order.
    channel().send({ event: "desktop:navigate", payload: "purchase" });
    channel().send({ event: "desktop:notice", payload: "notice" });
    channel().send({ event: "desktop:file-drop", payload: ["C:/input.csv"] });
    channel().send({ event: "purchase:analysis-start", payload: 2 });
    channel().send({ event: "purchase:analysis", payload: result });
    channel().send({ event: "purchase:analysis-error", payload: failure });
    // Then payloads are forwarded without transport metadata or transformation.
    expect(seen).toEqual(["purchase", "notice", ["C:/input.csv"], 2, result, failure]);
  });

  it("closes callbacks immediately when disposed before a late registration acknowledgement", async () => {
    // Given a pending native registration.
    const registration = deferred<number>();
    native.invoke.mockImplementation((command) => command === "register_main_channel" ? registration.promise : Promise.resolve());
    const { subscribeMainChannel } = await import("./mainChannelSubscription");
    const seen = vi.fn<(payload: string) => void>();
    const subscription = subscribeMainChannel("desktop:notice", seen);
    const lateMessage = channel().onmessage;
    // When unmounted before acknowledgement, including already queued messages.
    subscription.dispose();
    lateMessage({ transfer: 1, index: 0, total: 1, data: JSON.stringify({ event: "desktop:notice", payload: "before" }) });
    registration.resolve(9);
    await subscription.ready;
    await flush();
    lateMessage({ transfer: 2, index: 0, total: 1, data: JSON.stringify({ event: "desktop:notice", payload: "after" }) });
    // Then no old callback runs and the late registration is removed.
    expect(seen).not.toHaveBeenCalled();
    expect(native.invoke).toHaveBeenLastCalledWith("unregister_main_channel", { registration: 9 });
  });

  it("waits for old unregister acknowledgement before registering a replacement", async () => {
    // Given a closed registration whose unregister is still pending.
    const firstAck = deferred<number>();
    const removed = deferred<void>();
    let registrations = 0;
    native.invoke.mockImplementation((command) => {
      if (command === "unregister_main_channel") return removed.promise;
      registrations += 1;
      return registrations === 1 ? firstAck.promise : Promise.resolve(12);
    });
    const { subscribeMainChannel } = await import("./mainChannelSubscription");
    const old = subscribeMainChannel("desktop:notice", () => undefined);
    await flush();
    old.dispose();
    const seen = vi.fn<(payload: string) => void>();
    const replacement = subscribeMainChannel("desktop:notice", seen);
    // When the old register completes while its cleanup is pending.
    firstAck.resolve(11);
    await flush();
    expect(registrations).toBe(1);
    removed.resolve();
    await replacement.ready;
    channel().send({ event: "desktop:notice", payload: "stale" });
    channel(1).send({ event: "desktop:notice", payload: "current" });
    // Then replacement registration follows unregister and only its callback runs.
    expect(native.invoke.mock.calls.map(([command]) => command)).toEqual([
      "register_main_channel", "unregister_main_channel", "register_main_channel",
    ]);
    expect(seen.mock.calls).toEqual([["current"]]);
  });

  it("discards messages before registration readiness", async () => {
    // Given an unacknowledged channel.
    const ack = deferred<number>();
    native.invoke.mockReturnValue(ack.promise);
    const { subscribeMainChannel } = await import("./mainChannelSubscription");
    const seen = vi.fn<(payload: string) => void>();
    const subscription = subscribeMainChannel("desktop:notice", seen);
    // When native delivers before and after acknowledgement.
    channel().send({ event: "desktop:notice", payload: "early" });
    ack.resolve(1);
    await subscription.ready;
    channel().send({ event: "desktop:notice", payload: "ready" });
    // Then only the ready session is eligible.
    expect(seen.mock.calls).toEqual([["ready"]]);
  });

  it("silences all consumers synchronously on pagehide", async () => {
    // Given a registered page with a captured native callback.
    const { subscribeMainChannel } = await import("./mainChannelSubscription");
    const seen = vi.fn<(payload: string) => void>();
    const subscription = subscribeMainChannel("desktop:notice", seen);
    await subscription.ready;
    const queued = channel().onmessage;
    // When page teardown starts.
    window.dispatchEvent(new Event("pagehide"));
    queued({ transfer: 1, index: 0, total: 1, data: JSON.stringify({ event: "desktop:notice", payload: "late" }) });
    await flush();
    // Then even an already queued callback is inert and native cleanup is requested.
    expect(seen).not.toHaveBeenCalled();
    expect(native.invoke).toHaveBeenLastCalledWith("unregister_main_channel", { registration: 7 });
  });

  it("rejects readiness without delivering callbacks on registration failure", async () => {
    // Given native registration failure.
    native.invoke.mockRejectedValue(new Error("native unavailable"));
    const { subscribeMainChannel } = await import("./mainChannelSubscription");
    const seen = vi.fn<(payload: string) => void>();
    const subscription = subscribeMainChannel("desktop:notice", seen);
    // When readiness fails.
    await expect(subscription.ready).rejects.toThrow("native unavailable");
    channel().send({ event: "desktop:notice", payload: "late" });
    // Then no failed session callback runs.
    expect(seen).not.toHaveBeenCalled();
    subscription.dispose();
  });
  it("registers a replacement after unregister rejection without reviving old callbacks", async () => {
    // Given a closed session waiting for native unregister.
    const removed = deferred<void>();
    let unregisters = 0;
    native.invoke.mockImplementation((command) => {
      if (command === "register_main_channel") return Promise.resolve(7);
      unregisters += 1;
      return unregisters === 1 ? removed.promise : Promise.resolve();
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { subscribeMainChannel } = await import("./mainChannelSubscription");
    const oldCallback = vi.fn<(payload: string) => void>();
    const old = subscribeMainChannel("desktop:notice", oldCallback);
    await old.ready;
    const queued = channel().onmessage;
    old.dispose();
    const currentCallback = vi.fn<(payload: string) => void>();
    const replacement = subscribeMainChannel("desktop:notice", currentCallback);
    await flush();
    expect(native.invoke.mock.calls.map(([command]) => command)).toEqual([
      "register_main_channel", "unregister_main_channel",
    ]);
    // When unregister rejects, replacement can establish a new native session.
    removed.reject(new Error("private native failure detail"));
    await replacement.ready;
    queued({ transfer: 1, index: 0, total: 1, data: JSON.stringify({ event: "desktop:notice", payload: "stale" }) });
    channel(1).send({ event: "desktop:notice", payload: "current" });
    // Then only the replacement callback runs and cleanup logs no native details.
    expect(native.invoke.mock.calls.map(([command]) => command)).toEqual([
      "register_main_channel", "unregister_main_channel", "register_main_channel",
    ]);
    expect(oldCallback).not.toHaveBeenCalled();
    expect(currentCallback.mock.calls).toEqual([["current"]]);
    expect(warning.mock.calls).toEqual([["Main channel cleanup failed."]]);
    warning.mockRestore();
  });
});
