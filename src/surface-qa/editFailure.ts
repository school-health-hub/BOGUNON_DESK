export type EditFailure = "acl_denied" | "caller_denied" | "runtime_inactive" | "frame_write_failed" | "unknown";

export function classifyEditFailure(error: unknown): EditFailure {
  if (error === "caller_denied" || error === "runtime_inactive" || error === "frame_write_failed") return error;
  // Only the pinned release-mode Tauri ACL response is recognized. Never display it.
  if (typeof error === "string" && /^Command (?:begin|complete|cancel)_desktop_surface_edit not allowed by ACL$/.test(error)) return "acl_denied";
  return "unknown";
}
