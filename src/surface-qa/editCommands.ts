import { invoke } from "@tauri-apps/api/core";

export type QaEditCommand = "begin" | "complete" | "cancel";

export async function sendQaEditCommand(command: QaEditCommand): Promise<void> {
  switch (command) {
    case "begin":
      await invoke("begin_desktop_surface_edit");
      return;
    case "complete":
      await invoke("complete_desktop_surface_edit");
      return;
    case "cancel":
      await invoke("cancel_desktop_surface_edit");
  }
}
