import type { LucideIcon } from "lucide-react";
import type { DesktopActionId } from "../desktop/types";
import type { WorkspaceEditorTarget } from "../settings/settingsNavigation";

export const commandGroupIds = ["quick", "connection", "screen"] as const;
export type CommandGroupId = (typeof commandGroupIds)[number];

export const commandIds = [
  "quick-add",
  "home",
  "today-tasks",
  "inbox",
  "calculator",
  "purchase-helper",
  "official-document",
  "toolbox",
  "quick-memo",
  "settings",
  "online-health-room",
  "bogunon",
  "work-folder",
  "work-portal",
  "workspace",
  "widget-library",
  "presets",
  "appearance",
  "dock-editor",
] as const;
export type CommandId = (typeof commandIds)[number];

type CommandBase = {
  readonly id: CommandId;
  readonly label: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly group: CommandGroupId;
  readonly icon: LucideIcon;
};

export type CommandDefinition = CommandBase & (
  | { readonly kind: "quickAdd" }
  | { readonly kind: "desktopAction"; readonly actionId: DesktopActionId }
  | { readonly kind: "workspaceEditor"; readonly target: WorkspaceEditorTarget }
  | { readonly kind: "widgetLibrary" }
);

export type CommandExecutionHandlers = {
  readonly openQuickAdd: () => void;
  readonly runDesktopAction: (actionId: DesktopActionId) => Promise<void>;
  readonly openWorkspaceEditor: (target: WorkspaceEditorTarget) => void;
  readonly openWidgetLibrary: () => void;
};
