import type { DesktopAction, DesktopActionId } from "./types";

export const desktopActionRegistry = {
  home: { id: "home", kind: "internal", target: "home" },
  "today-tasks": { id: "today-tasks", kind: "internal", target: "today-tasks" },
  inbox: { id: "inbox", kind: "internal", target: "inbox" },
  calculator: { id: "calculator", kind: "internal", target: "calculator" },
  "purchase-helper": { id: "purchase-helper", kind: "internal", target: "purchase-helper" },
  "official-document": { id: "official-document", kind: "internal", target: "official-document" },
  "online-health-room": { id: "online-health-room", kind: "externalUrl", configured: false },
  bogunon: { id: "bogunon", kind: "externalUrl", configured: false },
  toolbox: { id: "toolbox", kind: "internal", target: "toolbox" },
  "aed-check": { id: "aed-check", kind: "command", configured: false },
  "record-helper": { id: "record-helper", kind: "internal", target: "record-helper" },
  "bogunon-school-settings": { id: "bogunon-school-settings", kind: "command", configured: false },
  "checkup-tools": { id: "checkup-tools", kind: "externalUrl", configured: false },
  "work-folder": { id: "work-folder", kind: "internal", target: "work-folder" },
  "work-portal": { id: "work-portal", kind: "externalUrl", configured: false },
  "quick-memo": { id: "quick-memo", kind: "internal", target: "quick-memo" },
  settings: { id: "settings", kind: "internal", target: "settings" },
} as const satisfies Record<DesktopActionId, DesktopAction>;
