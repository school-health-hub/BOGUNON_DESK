import {
  Bot,
  BriefcaseBusiness,
  Calculator,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  GraduationCap,
  Home,
  ListChecks,
  NotebookPen,
  PackageSearch,
  School,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { DesktopActionId } from "../desktop/types";

export const workspaceCategoryIds = [
  "home",
  "schedule-work",
  "documents-education",
  "inventory-purchase",
  "school",
  "settings",
] as const;

export type WorkspaceCategoryId = (typeof workspaceCategoryIds)[number];

export const workspaceCategoryRegistry = {
  home: { id: "home", label: "홈", icon: Home },
  "schedule-work": { id: "schedule-work", label: "일정·업무", icon: CalendarDays },
  "documents-education": { id: "documents-education", label: "문서·교육자료", icon: FileText },
  "inventory-purchase": { id: "inventory-purchase", label: "물품·품의", icon: PackageSearch },
  school: { id: "school", label: "학교", icon: School },
  settings: { id: "settings", label: "설정", icon: Settings },
} as const satisfies Record<WorkspaceCategoryId, Readonly<{ id: WorkspaceCategoryId; label: string; icon: LucideIcon }>>;

export const workspaceModuleIds = [
  "home",
  "toolbox",
  "today-tasks",
  "local-calendar",
  "quick-memo",
  "work-folder",
  "calculator",
  "record-helper",
  "official-document",
  "newsletter",
  "education-video-finder",
  "purchase-helper",
  "personal-inventory",
  "finance",
  "school-profile",
  "school-admin",
  "school-workspace",
  "online-health-room",
  "work-portal",
  "aed-check",
  "checkup-tools",
  "bogunon",
  "settings",
] as const;

export type WorkspaceModuleId = (typeof workspaceModuleIds)[number];
export type WorkspaceStorageScope = "device" | "device-encrypted" | "session" | "file" | "mixed" | "school-shared" | "external";
export type WorkspaceLifecycle =
  | "persistent-home"
  | "request-panel"
  | "utility-dialog"
  | "quick-surface"
  | "unmount-confirm-clear"
  | "unmount-confirm-discard"
  | "controlled-open"
  | "keep-alive-hidden"
  | "unmount-preserve-store"
  | "unmount-guard-draft"
  | "security-boundary"
  | "external-launch"
  | "settings-workspace";
export type WorkspaceAccess = "local" | "account-optional" | "school-role" | "configured-external";
export type WorkspaceImplementation = "implemented" | "conditional";

export type WorkspaceEntry =
  | Readonly<{ kind: "desktop-action"; actionId: DesktopActionId }>
  | Readonly<{ kind: "p0-owner"; owner: "newsletter" | "education-video" | "inventory" | "finance" | "school-profile" | "school-admin" | "school-workspace" }>
  | Readonly<{ kind: "local-calendar" }>;

export type WorkspaceDefinition = Readonly<{
  id: WorkspaceModuleId;
  label: string;
  categoryId: WorkspaceCategoryId;
  icon: LucideIcon;
  entry: WorkspaceEntry;
  implementation: WorkspaceImplementation;
  storageScope: WorkspaceStorageScope;
  lifecycle: WorkspaceLifecycle;
  access: WorkspaceAccess;
  quickLaunch: boolean;
}>;

export const workspaceRegistry = {
  home: { id: "home", label: "홈", categoryId: "home", icon: Home, entry: { kind: "desktop-action", actionId: "home" }, implementation: "implemented", storageScope: "device", lifecycle: "persistent-home", access: "local", quickLaunch: true },
  toolbox: { id: "toolbox", label: "빠른 실행", categoryId: "home", icon: Search, entry: { kind: "desktop-action", actionId: "toolbox" }, implementation: "implemented", storageScope: "session", lifecycle: "utility-dialog", access: "local", quickLaunch: true },
  "today-tasks": { id: "today-tasks", label: "업무 관리", categoryId: "schedule-work", icon: ListChecks, entry: { kind: "desktop-action", actionId: "today-tasks" }, implementation: "implemented", storageScope: "device", lifecycle: "request-panel", access: "local", quickLaunch: true },
  "local-calendar": { id: "local-calendar", label: "개인 일정", categoryId: "schedule-work", icon: CalendarDays, entry: { kind: "local-calendar" }, implementation: "implemented", storageScope: "device", lifecycle: "utility-dialog", access: "local", quickLaunch: true },
  "quick-memo": { id: "quick-memo", label: "빠른 메모", categoryId: "schedule-work", icon: NotebookPen, entry: { kind: "desktop-action", actionId: "quick-memo" }, implementation: "implemented", storageScope: "device", lifecycle: "quick-surface", access: "local", quickLaunch: true },
  "work-folder": { id: "work-folder", label: "업무 폴더", categoryId: "schedule-work", icon: FolderOpen, entry: { kind: "desktop-action", actionId: "work-folder" }, implementation: "implemented", storageScope: "device", lifecycle: "utility-dialog", access: "local", quickLaunch: true },
  calculator: { id: "calculator", label: "업무 계산기", categoryId: "schedule-work", icon: Calculator, entry: { kind: "desktop-action", actionId: "calculator" }, implementation: "implemented", storageScope: "session", lifecycle: "utility-dialog", access: "local", quickLaunch: true },
  "record-helper": { id: "record-helper", label: "생기부 도우미", categoryId: "documents-education", icon: GraduationCap, entry: { kind: "desktop-action", actionId: "record-helper" }, implementation: "implemented", storageScope: "session", lifecycle: "unmount-confirm-clear", access: "local", quickLaunch: true },
  "official-document": { id: "official-document", label: "공문작업실", categoryId: "documents-education", icon: FileText, entry: { kind: "desktop-action", actionId: "official-document" }, implementation: "implemented", storageScope: "file", lifecycle: "unmount-confirm-discard", access: "local", quickLaunch: true },
  newsletter: { id: "newsletter", label: "보건소식지 제작소", categoryId: "documents-education", icon: FileSpreadsheet, entry: { kind: "p0-owner", owner: "newsletter" }, implementation: "implemented", storageScope: "mixed", lifecycle: "keep-alive-hidden", access: "local", quickLaunch: false },
  "education-video-finder": { id: "education-video-finder", label: "교육영상 Finder", categoryId: "documents-education", icon: Search, entry: { kind: "p0-owner", owner: "education-video" }, implementation: "implemented", storageScope: "device", lifecycle: "unmount-preserve-store", access: "local", quickLaunch: false },
  "purchase-helper": { id: "purchase-helper", label: "품의 도우미", categoryId: "inventory-purchase", icon: FileSpreadsheet, entry: { kind: "desktop-action", actionId: "purchase-helper" }, implementation: "implemented", storageScope: "mixed", lifecycle: "controlled-open", access: "local", quickLaunch: true },
  "personal-inventory": { id: "personal-inventory", label: "개인 Inventory", categoryId: "inventory-purchase", icon: PackageSearch, entry: { kind: "p0-owner", owner: "inventory" }, implementation: "implemented", storageScope: "device", lifecycle: "unmount-preserve-store", access: "local", quickLaunch: false },
  finance: { id: "finance", label: "MY FINANCE", categoryId: "schedule-work", icon: Wallet, entry: { kind: "p0-owner", owner: "finance" }, implementation: "implemented", storageScope: "device-encrypted", lifecycle: "unmount-guard-draft", access: "local", quickLaunch: false },
  "school-profile": { id: "school-profile", label: "학교 연결", categoryId: "school", icon: School, entry: { kind: "p0-owner", owner: "school-profile" }, implementation: "implemented", storageScope: "device", lifecycle: "unmount-preserve-store", access: "account-optional", quickLaunch: false },
  "school-admin": { id: "school-admin", label: "학교 행정", categoryId: "school", icon: BriefcaseBusiness, entry: { kind: "p0-owner", owner: "school-admin" }, implementation: "implemented", storageScope: "device", lifecycle: "unmount-preserve-store", access: "local", quickLaunch: false },
  "school-workspace": { id: "school-workspace", label: "학교 공동 공간", categoryId: "school", icon: ShieldCheck, entry: { kind: "p0-owner", owner: "school-workspace" }, implementation: "conditional", storageScope: "school-shared", lifecycle: "security-boundary", access: "school-role", quickLaunch: false },
  "online-health-room": { id: "online-health-room", label: "온라인 보건실", categoryId: "school", icon: Stethoscope, entry: { kind: "desktop-action", actionId: "online-health-room" }, implementation: "implemented", storageScope: "external", lifecycle: "external-launch", access: "configured-external", quickLaunch: true },
  "work-portal": { id: "work-portal", label: "업무포털", categoryId: "school", icon: BriefcaseBusiness, entry: { kind: "desktop-action", actionId: "work-portal" }, implementation: "implemented", storageScope: "external", lifecycle: "external-launch", access: "configured-external", quickLaunch: true },
  "aed-check": { id: "aed-check", label: "AED 점검", categoryId: "school", icon: ShieldCheck, entry: { kind: "desktop-action", actionId: "aed-check" }, implementation: "implemented", storageScope: "external", lifecycle: "external-launch", access: "configured-external", quickLaunch: true },
  "checkup-tools": { id: "checkup-tools", label: "검진 도구", categoryId: "school", icon: ListChecks, entry: { kind: "desktop-action", actionId: "checkup-tools" }, implementation: "implemented", storageScope: "external", lifecycle: "external-launch", access: "configured-external", quickLaunch: true },
  bogunon: { id: "bogunon", label: "BOGUNON", categoryId: "school", icon: Bot, entry: { kind: "desktop-action", actionId: "bogunon" }, implementation: "implemented", storageScope: "external", lifecycle: "external-launch", access: "configured-external", quickLaunch: true },
  settings: { id: "settings", label: "설정", categoryId: "settings", icon: Settings, entry: { kind: "desktop-action", actionId: "settings" }, implementation: "implemented", storageScope: "device", lifecycle: "settings-workspace", access: "local", quickLaunch: true },
} as const satisfies Record<WorkspaceModuleId, WorkspaceDefinition>;

export const workspaceDefinitions = workspaceModuleIds.map((id) => workspaceRegistry[id]);

export const workspaceActionRoutes = {
  home: "home",
  "today-tasks": "today-tasks",
  inbox: "today-tasks",
  calculator: "calculator",
  "purchase-helper": "purchase-helper",
  "official-document": "official-document",
  "online-health-room": "online-health-room",
  bogunon: "bogunon",
  toolbox: "toolbox",
  "aed-check": "aed-check",
  "record-helper": "record-helper",
  "bogunon-school-settings": "school-profile",
  "checkup-tools": "checkup-tools",
  "work-folder": "work-folder",
  "work-portal": "work-portal",
  "quick-memo": "quick-memo",
  settings: "settings",
} as const satisfies Record<DesktopActionId, WorkspaceModuleId>;
