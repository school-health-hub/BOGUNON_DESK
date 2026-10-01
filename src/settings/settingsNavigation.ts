import {
  ExternalLink,
  LayoutDashboard,
  LayoutTemplate,
  MonitorCog,
  Palette,
  PanelBottom,
  Sparkles,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { configurableUrlActionIds, type ConfigurableUrlActionId } from "../desktop/types";
import type { AccountLauncherLinks } from "./types";

export const settingsSectionIds = ["account", "screen", "connections", "ai", "device"] as const;
export type SettingsSectionId = (typeof settingsSectionIds)[number];

export type SettingsSectionDefinition = {
  readonly id: SettingsSectionId;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
};

export const settingsNavigationRegistry = {
  account: { id: "account", label: "계정", description: "로그인과 동기화", icon: UserRound },
  screen: { id: "screen", label: "화면", description: "작업 공간 꾸미기", icon: LayoutDashboard },
  connections: { id: "connections", label: "연결", description: "업무 서비스 주소", icon: ExternalLink },
  ai: { id: "ai", label: "AI", description: "AI 서비스 연결", icon: Sparkles },
  device: { id: "device", label: "이 PC", description: "Windows 설정", icon: MonitorCog },
} as const satisfies Record<SettingsSectionId, SettingsSectionDefinition>;

export const settingsNavigationDefinitions = settingsSectionIds.map(
  (sectionId) => settingsNavigationRegistry[sectionId],
);

export type WorkspaceEditorTarget = "workspace" | "presets" | "appearance" | "dock";
export type WorkspaceEditorPanel = Exclude<WorkspaceEditorTarget, "workspace"> | null;

export const resolveWorkspaceEditorPanel = (
  target: WorkspaceEditorTarget,
): WorkspaceEditorPanel => target === "workspace" ? null : target;

export const screenSettingDefinitions = [
  { id: "workspace", label: "화면 꾸미기", description: "현재 화면에서 위젯을 이동하고 크기를 조절합니다.", icon: SlidersHorizontal },
  { id: "presets", label: "배치", description: "업무 방식에 맞는 기본 배치를 선택합니다.", icon: LayoutTemplate },
  { id: "appearance", label: "스타일", description: "배경과 카드 모양을 변경합니다.", icon: Palette },
  { id: "dock", label: "Dock", description: "빠른 실행 항목의 순서와 표시 여부를 정합니다.", icon: PanelBottom },
] as const satisfies readonly {
  readonly id: WorkspaceEditorTarget;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
}[];

type UrlSettingDefinition = {
  readonly id: ConfigurableUrlActionId;
  readonly label: string;
  readonly settingsKey: keyof AccountLauncherLinks;
  readonly unavailableMessage: string;
};

export const urlSettingRegistry = {
  "online-health-room": { id: "online-health-room", label: "온라인 보건실", settingsKey: "onlineHealthRoomUrl", unavailableMessage: "온라인 보건실이 아직 연결되지 않았습니다." },
  bogunon: { id: "bogunon", label: "BOGUNON", settingsKey: "bogunonUrl", unavailableMessage: "BOGUNON이 아직 연결되지 않았습니다." },
  "checkup-tools": { id: "checkup-tools", label: "검진 도구", settingsKey: "checkupToolUrl", unavailableMessage: "검진 도구가 아직 연결되지 않았습니다." },
} as const satisfies Record<ConfigurableUrlActionId, UrlSettingDefinition>;

export const urlSettingDefinitions = configurableUrlActionIds.map(
  (actionId) => urlSettingRegistry[actionId],
);

export const findUrlSetting = (actionId: ConfigurableUrlActionId) =>
  urlSettingRegistry[actionId];
