import { Channel } from "@tauri-apps/api/core";

export type SurfaceEditState = "idle" | "editing" | "closed";

/** Fixed status only; this channel cannot issue commands or carry projection data. */
export function createEditStateChannel(onState: (state: SurfaceEditState) => void): Channel<unknown> {
  const channel = new Channel<unknown>();
  channel.onmessage = (state: unknown) => {
    if (state === "idle" || state === "editing" || state === "closed") onState(state);
  };
  return channel;
}
