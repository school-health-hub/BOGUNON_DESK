import type { ComponentType } from "react";
import type { DesktopActionId } from "../desktop/types";

export const DOCK_LAYOUT_VERSION = 2;

export const dockItemIds = [
  "home",
  "online-health-room",
  "bogunon",
  "toolbox",
  "official-document",
  "aed-check",
  "record-helper",
  "checkup-tools",
  "work-folder",
  "quick-memo",
  "settings",
] as const;

export type DockItemId = (typeof dockItemIds)[number];

export const defaultDockItemIds = [
  "home",
  "online-health-room",
  "bogunon",
  "toolbox",
  "work-folder",
  "quick-memo",
  "settings",
] as const satisfies readonly DockItemId[];

export const optionalDockItemIds = ["official-document"] as const satisfies readonly DockItemId[];

export type DockItemDefinition = {
  readonly id: DockItemId;
  readonly actionId: DesktopActionId;
  readonly label: string;
  readonly icon: ComponentType<{ readonly size?: number; readonly strokeWidth?: number }>;
};

export type DockLayoutItem = {
  readonly id: DockItemId;
  readonly visible: boolean;
};

export type DockLayout = {
  readonly version: typeof DOCK_LAYOUT_VERSION;
  readonly items: readonly DockLayoutItem[];
};
