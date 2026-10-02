import { Bot, FileText, FolderOpen, Home, NotebookPen, Settings, Stethoscope, Wrench } from "lucide-react";
import { toolboxToolRegistry } from "../tools/toolRegistry";
import { dockItemIds, type DockItemDefinition, type DockItemId } from "./types";

export const dockRegistry = {
  home: { id: "home", actionId: "home", label: "홈", icon: Home },
  "online-health-room": { id: "online-health-room", actionId: "online-health-room", label: "온라인 보건실", icon: Stethoscope },
  bogunon: { id: "bogunon", actionId: "bogunon", label: "BOGUNON", icon: Bot },
  toolbox: { id: "toolbox", actionId: "toolbox", label: "업무 도구", icon: Wrench },
  "official-document": { id: "official-document", actionId: "official-document", label: "공문 작업실", icon: FileText },
  "aed-check": { id: "aed-check", actionId: "aed-check", label: toolboxToolRegistry["aed-check"].label, icon: toolboxToolRegistry["aed-check"].icon },
  "record-helper": { id: "record-helper", actionId: "record-helper", label: toolboxToolRegistry["record-helper"].label, icon: toolboxToolRegistry["record-helper"].icon },
  "checkup-tools": { id: "checkup-tools", actionId: "checkup-tools", label: toolboxToolRegistry["checkup-tools"].label, icon: toolboxToolRegistry["checkup-tools"].icon },
  "work-folder": { id: "work-folder", actionId: "work-folder", label: "업무 폴더", icon: FolderOpen },
  "quick-memo": { id: "quick-memo", actionId: "quick-memo", label: "빠른 메모", icon: NotebookPen },
  settings: { id: "settings", actionId: "settings", label: "설정", icon: Settings },
} as const satisfies Record<DockItemId, DockItemDefinition>;

export const dockDefinitions = dockItemIds.map((id) => dockRegistry[id]);
