export const desktopActionIds = [
  "home",
  "today-tasks",
  "inbox",
  "calculator",
  "purchase-helper",
  "official-document",
  "online-health-room",
  "bogunon",
  "toolbox",
  "aed-check",
  "record-helper",
  "bogunon-school-settings",
  "checkup-tools",
  "work-folder",
  "work-portal",
  "quick-memo",
  "settings",
] as const;

export type DesktopActionId = (typeof desktopActionIds)[number];

export type InternalDesktopTarget = "home" | "today-tasks" | "inbox" | "calculator" | "purchase-helper" | "official-document" | "toolbox" | "work-folder" | "quick-memo" | "settings";

export type DesktopAction =
  | { readonly id: DesktopActionId; readonly kind: "internal"; readonly target: InternalDesktopTarget }
  | { readonly id: DesktopActionId; readonly kind: "externalUrl"; readonly configured: boolean }
  | { readonly id: DesktopActionId; readonly kind: "localFolder"; readonly configured: boolean }
  | { readonly id: DesktopActionId; readonly kind: "localFile"; readonly configured: boolean }
  | { readonly id: DesktopActionId; readonly kind: "command"; readonly configured: boolean };

export type DesktopActionOutcome = {
  readonly status: "completed" | "unavailable";
  readonly message: string | null;
};

export type BogunonSearchResultTarget = {
  readonly kind: "task" | "event";
  readonly id: string;
  readonly date: string | null;
};

export type DesktopSettings = {
  readonly closeToTray: boolean;
  readonly onboardingVersion: number;
};

export type LauncherSettings = {
  readonly onlineHealthRoomUrl: string | null;
  readonly bogunonUrl: string | null;
  readonly checkupToolUrl: string | null;
  readonly workPortalUrl: string | null;
  readonly workPortalAutoOpenDelay: WorkPortalAutoOpenDelay;
};

export const workPortalAutoOpenDelays = ["off", "20s", "45s"] as const;
export type WorkPortalAutoOpenDelay = (typeof workPortalAutoOpenDelays)[number];

export const parseWorkPortalAutoOpenDelay = (value: string): WorkPortalAutoOpenDelay =>
  workPortalAutoOpenDelays.find((delay) => delay === value) ?? "off";

export const configurableUrlActionIds = [
  "online-health-room",
  "bogunon",
  "checkup-tools",
] as const;

export type ConfigurableUrlActionId = (typeof configurableUrlActionIds)[number];

export const parseDesktopActionId = (value: string): DesktopActionId | null =>
  desktopActionIds.find((actionId) => actionId === value) ?? null;
