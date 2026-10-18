import type { MainChannelMessage } from "./mainChannelSubscription";

export type MainChannelFrame = {
  readonly transfer: number;
  readonly index: number;
  readonly total: number;
  readonly data: string;
};
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_FRAMES = 8192;
const encoder = new TextEncoder();
type Pending = {
  readonly transfer: number;
  readonly total: number;
  readonly chunks: string[];
  bytes: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isEnvelope(value: unknown): value is MainChannelMessage {
  if (!isRecord(value)) return false;
  const payload = value.payload;
  switch (value.event) {
    case "desktop:navigate":
    case "desktop:notice": return typeof payload === "string";
    case "desktop:file-drop": return Array.isArray(payload) && payload.every((path: unknown) => typeof path === "string");
    case "purchase:analysis-start": return typeof payload === "number" && Number.isSafeInteger(payload);
    case "purchase:analysis-error": return isRecord(payload)
      && typeof payload.generation === "number" && Number.isSafeInteger(payload.generation)
      && typeof payload.message === "string";
    case "purchase:analysis": return isRecord(payload)
      && typeof payload.generation === "number" && Number.isSafeInteger(payload.generation)
      && isRecord(payload.result) && Array.isArray(payload.result.items)
      && Array.isArray(payload.result.sources) && Array.isArray(payload.result.candidates);
    default: return false;
  }
}

/** Reassembles only contiguous, bounded frames from the registered native sender. */
export function createMainChannelDecoder(): (frame: MainChannelFrame) => MainChannelMessage | undefined {
  let pending: Pending | undefined;
  let latestTransfer = 0;
  return (frame) => {
    if (!Number.isSafeInteger(frame.transfer) || frame.transfer <= 0
      || !Number.isSafeInteger(frame.index) || !Number.isSafeInteger(frame.total)
      || frame.total <= 0 || frame.total > MAX_FRAMES || frame.index < 0 || frame.index >= frame.total
      || typeof frame.data !== "string" || encoder.encode(frame.data).byteLength > 2048) {
      pending = undefined;
      return undefined;
    }
    if (frame.index === 0 && frame.transfer > latestTransfer) {
      latestTransfer = frame.transfer;
      pending = { transfer: frame.transfer, total: frame.total, chunks: [], bytes: 0 };
    }
    if (pending === undefined || pending.transfer !== frame.transfer
      || pending.total !== frame.total || pending.chunks.length !== frame.index) {
      pending = undefined;
      return undefined;
    }
    pending.bytes += encoder.encode(frame.data).byteLength;
    if (pending.bytes > MAX_BYTES) { pending = undefined; return undefined; }
    pending.chunks.push(frame.data);
    if (pending.chunks.length !== pending.total) return undefined;
    const serialized = pending.chunks.join("");
    pending = undefined;
    try {
      // Validate transport and outer payload shape; nested purchase records retain the trusted Rust serializer schema.
      const message: unknown = JSON.parse(serialized);
      return isEnvelope(message) ? message : undefined;
    } catch {
      // A malformed transport message is discarded without exposing its contents.
      return undefined;
    }
  };
}
