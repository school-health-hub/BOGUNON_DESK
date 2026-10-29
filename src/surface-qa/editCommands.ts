import { invoke } from "@tauri-apps/api/core";

import { createEditStateChannel, type SurfaceEditState } from "./editState";

export type QaEditCommand = "begin" | "complete" | "cancel";

export async function sendQaEditCommand(command: QaEditCommand, onState?: (state: SurfaceEditState) => void): Promise<void> {
  switch (command) {
    case "begin":
      await invoke("begin_desktop_surface_edit", onState === undefined ? undefined : { onState: createEditStateChannel(onState) });
      return;
    case "complete":
      await invoke("complete_desktop_surface_edit");
      return;
    case "cancel":
      await invoke("cancel_desktop_surface_edit");
  }
}
