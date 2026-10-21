import { describe, expect, it } from "vitest";
import { createMainChannelDecoder, type MainChannelFrame } from "./mainChannelSubscriptionFrames";

function frames(serialized: string, transfer = 1): MainChannelFrame[] {
  const chunks: string[] = [];
  let chunk = "";
  const encoder = new TextEncoder();
  for (const character of serialized) {
    if (encoder.encode(chunk + character).byteLength > 2048) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += character;
  }
  chunks.push(chunk);
  return chunks.map((data, index) => ({ transfer, index, total: chunks.length, data }));
}
function decodeAll(serialized: string) {
  const decode = createMainChannelDecoder();
  return frames(serialized).map(decode).filter((message) => message !== undefined);
}

describe("Main channel transport frames", () => {
  it.each([8191, 8192, 128 * 1024])("reassembles a %i byte business envelope", (size) => {
    // Given a native envelope at or beyond the unsafe public Channel inline threshold.
    const prefix = JSON.stringify({ event: "desktop:notice", payload: "" });
    const payload = "x".repeat(size - prefix.length);
    const serialized = JSON.stringify({ event: "desktop:notice", payload });
    // When native sends bounded frames.
    const messages = decodeAll(serialized);
    // Then the business receiver gets one unchanged envelope.
    expect(new TextEncoder().encode(serialized).byteLength).toBe(size);
    expect(messages).toEqual([{ event: "desktop:notice", payload }]);
  });

  it("preserves Korean, emoji, quotes and backslashes across frame boundaries", () => {
    // Given multibyte and escaped payload content.
    const payload = '한글😀"\\\n'.repeat(1800);
    // When received in bounded UTF8 frames.
    const messages = decodeAll(JSON.stringify({ event: "desktop:notice", payload }));
    // Then encoding and chunk boundaries do not alter the payload.
    expect(messages).toEqual([{ event: "desktop:notice", payload }]);
  });

  it("discards out-of-order transfers and recovers at the next transfer", () => {
    // Given a transfer with a missing frame.
    const decode = createMainChannelDecoder();
    const parts = frames(JSON.stringify({ event: "desktop:notice", payload: "x".repeat(6000) }));
    const first = parts[0];
    const last = parts[2];
    if (first === undefined || last === undefined) throw new Error("Expected three frames");
    // When order is violated, followed by a new complete transfer.
    expect(decode(first)).toBeUndefined();
    expect(decode(last)).toBeUndefined();
    const recovered = frames(JSON.stringify({ event: "desktop:notice", payload: "recovered" }), 2).map(decode);
    // Then partial data never dispatches and the next transfer succeeds.
    expect(recovered).toEqual([{ event: "desktop:notice", payload: "recovered" }]);
  });

  it("rejects invalid bounds, malformed JSON and invalid event payloads", () => {
    // Given malformed native transport inputs.
    const decode = createMainChannelDecoder();
    const invalid = [
      { transfer: 1, index: 0, total: 8193, data: "{}" },
      { transfer: 2, index: 0, total: 1, data: "x".repeat(2049) },
      { transfer: 3, index: 0, total: 1, data: "{" },
      { transfer: 4, index: 0, total: 1, data: "null" },
      { transfer: 5, index: 0, total: 1, data: JSON.stringify({ event: "desktop:notice", payload: 2 }) },
    ];
    // When decoded.
    const messages = invalid.map(decode);
    // Then none is delivered as a business message.
    expect(messages.every((message) => message === undefined)).toBe(true);
  });
  it("discards a transfer containing a duplicate frame", () => {
    // Given a multi-frame transfer whose first frame is duplicated.
    const decode = createMainChannelDecoder();
    const parts = frames(JSON.stringify({ event: "desktop:notice", payload: "x".repeat(6000) }));
    const first = parts[0];
    if (first === undefined) throw new Error("Expected frames");
    // When the duplicate interrupts contiguous frame delivery.
    const messages = [first, ...parts].map(decode);
    // Then the incomplete transfer never dispatches.
    expect(messages.every((message) => message === undefined)).toBe(true);
  });

  it("rejects a replay of a completed transfer", () => {
    // Given an already completed transfer.
    const decode = createMainChannelDecoder();
    const parts = frames(JSON.stringify({ event: "desktop:notice", payload: "once" }));
    expect(parts.map(decode)).toEqual([{ event: "desktop:notice", payload: "once" }]);
    // When the same transfer is replayed.
    const replay = parts.map(decode);
    // Then no second business delivery occurs.
    expect(replay.every((message) => message === undefined)).toBe(true);
  });

  it("discards a transfer when frame total changes midway", () => {
    // Given a valid multi-frame transfer with inconsistent subsequent metadata.
    const decode = createMainChannelDecoder();
    const parts = frames(JSON.stringify({ event: "desktop:notice", payload: "x".repeat(6000) }));
    const first = parts[0];
    const second = parts[1];
    if (first === undefined || second === undefined) throw new Error("Expected frames");
    // When total changes and remaining original frames continue.
    const messages = [first, { ...second, total: second.total + 1 }, ...parts.slice(2)].map(decode);
    // Then incompatible chunks cannot complete a business message.
    expect(messages.every((message) => message === undefined)).toBe(true);
  });
});
