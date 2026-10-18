import { Channel, invoke } from "@tauri-apps/api/core";
import { createMainChannelDecoder, type MainChannelFrame } from "./mainChannelSubscriptionFrames";
import type { PurchaseAnalysisErrorEvent, PurchaseAnalysisEvent } from "../purchase/types";

export type MainChannelPayloads = {
  readonly "desktop:navigate": string;
  readonly "desktop:notice": string;
  readonly "desktop:file-drop": string[];
  readonly "purchase:analysis-start": number;
  readonly "purchase:analysis": PurchaseAnalysisEvent;
  readonly "purchase:analysis-error": PurchaseAnalysisErrorEvent;
};
export type MainChannelMessage = {
  [K in keyof MainChannelPayloads]: { readonly event: K; readonly payload: MainChannelPayloads[K] }
}[keyof MainChannelPayloads];
export type MainChannelSubscription = { readonly ready: Promise<void>; readonly dispose: () => void };
type Listeners = { [K in keyof MainChannelPayloads]: Set<(payload: MainChannelPayloads[K]) => void> };
type Session = {
  readonly channel: Channel<MainChannelFrame>;
  readonly listeners: Listeners;
  ready: Promise<void>;
  closed: boolean;
  acknowledged: boolean;
  references: number;
};
let current: Session | undefined;
let transaction: Promise<void> = Promise.resolve();

function dispatch<K extends keyof MainChannelPayloads>(session: Session, event: K, payload: MainChannelPayloads[K]): void {
  for (const callback of session.listeners[event]) callback(payload);
}
function receive(session: Session, message: MainChannelMessage): void {
  if (session.closed || current !== session || !session.acknowledged) return;
  switch (message.event) {
    case "desktop:navigate": dispatch(session, message.event, message.payload); return;
    case "desktop:notice": dispatch(session, message.event, message.payload); return;
    case "desktop:file-drop": dispatch(session, message.event, message.payload); return;
    case "purchase:analysis-start": dispatch(session, message.event, message.payload); return;
    case "purchase:analysis": dispatch(session, message.event, message.payload); return;
    case "purchase:analysis-error": dispatch(session, message.event, message.payload); return;
  }
}
function close(session: Session): void {
  if (session.closed) return;
  session.closed = true;
  session.channel.onmessage = () => undefined;
  for (const listeners of Object.values(session.listeners)) listeners.clear();
  if (current === session) current = undefined;
  // Cleanup is serialized behind registration, including a late acknowledgement.
  const cleanup = session.ready.then(async () => {
    const registration = registrations.get(session);
    if (registration !== undefined) await invoke<void>("unregister_main_channel", { registration });
  });
  transaction = cleanup.catch(() => {
    // A failed native teardown cannot restore this closed JavaScript session.
    console.warn("Main channel cleanup failed.");
  });
}
const registrations = new WeakMap<Session, number>();
function createSession(): Session {
  const channel = new Channel<MainChannelFrame>();
  const session: Session = {
    channel,
    listeners: {
      "desktop:navigate": new Set(), "desktop:notice": new Set(), "desktop:file-drop": new Set(),
      "purchase:analysis-start": new Set(), "purchase:analysis": new Set(), "purchase:analysis-error": new Set(),
    },
    ready: Promise.resolve(), closed: false, acknowledged: false, references: 0,
  };
  const decode = createMainChannelDecoder();
  channel.onmessage = (frame) => {
    if (session.closed || current !== session || !session.acknowledged) return;
    const message = decode(frame);
    if (message !== undefined) receive(session, message);
  };
  session.ready = transaction.then(async () => {
    const registration = await invoke<number>("register_main_channel", { channel });
    registrations.set(session, registration);
    session.acknowledged = true;
  });
  transaction = session.ready.catch(() => {
    session.closed = true;
    session.channel.onmessage = () => undefined;
    for (const listeners of Object.values(session.listeners)) listeners.clear();
    if (current === session) current = undefined;
  });
  return session;
}

export function subscribeMainChannel<K extends keyof MainChannelPayloads>(
  event: K, callback: (payload: MainChannelPayloads[K]) => void,
): MainChannelSubscription {
  const session = current ?? createSession();
  current = session;
  session.references += 1;
  // Each subscription owns its wrapper, even when callers reuse a callback.
  const listener = (payload: MainChannelPayloads[K]) => callback(payload);
  session.listeners[event].add(listener);
  let disposed = false;
  return {
    ready: session.ready,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      session.listeners[event].delete(listener);
      session.references -= 1;
      if (session.references === 0) close(session);
    },
  };
}

// Page teardown is best effort: abrupt reload/process termination cannot await native acknowledgement.
if (typeof window !== "undefined") window.addEventListener("pagehide", () => {
  if (current !== undefined) close(current);
});
