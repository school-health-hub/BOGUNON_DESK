import { Activity, BookOpenCheck, Calculator, ClipboardCheck, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react";
import type { ConfigurableUrlActionId, DesktopActionId } from "../desktop/types";
import type { AccountLauncherLinks } from "../settings/types";

export const healthToolIds = ["aed-check", "checkup-tools"] as const;
export type HealthToolId = (typeof healthToolIds)[number];
export const internalToolIds = ["calculator", "purchase-helper", "official-document", "record-helper"] as const;
export type InternalToolId = (typeof internalToolIds)[number];
export type ToolboxToolId = HealthToolId | InternalToolId;

export const healthToolCategoryIds = ["health", "records", "general"] as const;
export type HealthToolCategoryId = (typeof healthToolCategoryIds)[number];

export type HealthToolCategoryDefinition = {
  readonly id: HealthToolCategoryId;
  readonly label: string;
};

export type ExternalToolDefinition = {
  readonly id: HealthToolId;
  readonly label: string;
  readonly description: string;
  readonly category: HealthToolCategoryId;
  readonly icon: LucideIcon;
  readonly kind: "externalAction";
  readonly launchActionId: DesktopActionId;
  readonly settingsActionId: ConfigurableUrlActionId;
  readonly settingsKey: keyof Pick<AccountLauncherLinks, "bogunonUrl" | "checkupToolUrl">;
};

export type InternalToolDefinition = {
  readonly id: InternalToolId;
  readonly label: string;
  readonly description: string;
  readonly category: HealthToolCategoryId;
  readonly icon: LucideIcon;
  readonly kind: "internalTool";
  readonly launchActionId: DesktopActionId;
};

export type ToolboxToolDefinition = ExternalToolDefinition | InternalToolDefinition;

export const healthToolRegistry = {
  "aed-check": {
    id: "aed-check",
    label: "AED 점검",
    description: "BOGUNON에서 AED 관리 열기",
    category: "health",
    icon: Activity,
    kind: "externalAction",
    launchActionId: "aed-check",
    settingsActionId: "bogunon",
    settingsKey: "bogunonUrl",
  },
  "checkup-tools": {
    id: "checkup-tools",
    label: "검진 도구",
    description: "학생 건강검진 업무 도구",
    category: "health",
    icon: ClipboardCheck,
    kind: "externalAction",
    launchActionId: "checkup-tools",
    settingsActionId: "checkup-tools",
    settingsKey: "checkupToolUrl",
  },
} as const satisfies Record<HealthToolId, ExternalToolDefinition>;

export const internalToolRegistry = {
  calculator: {
    id: "calculator",
    label: "계산기",
    description: "계산·퍼센트·날짜·단위 변환",
    category: "general",
    icon: Calculator,
    kind: "internalTool",
    launchActionId: "calculator",
  },
  "record-helper": {
    id: "record-helper",
    label: "생기부 도우미",
    description: "비식별 메모를 바탕으로 학생 기록 문구를 준비",
    category: "records",
    icon: BookOpenCheck,
    kind: "internalTool",
    launchActionId: "record-helper",
  },
  "purchase-helper": {
    id: "purchase-helper",
    label: "품의 도우미",
    description: "견적·구매목록을 품의용 품목내역으로 정리",
    category: "records",
    icon: FileSpreadsheet,
    kind: "internalTool",
    launchActionId: "purchase-helper",
  },
  "official-document": {
    id: "official-document",
    label: "공문 작업실",
    description: "공문 초안·수정·핵심정리를 한 곳에서",
    category: "records",
    icon: FileText,
    kind: "internalTool",
    launchActionId: "official-document",
  },
} as const satisfies Record<InternalToolId, InternalToolDefinition>;

export const healthToolDefinitions = Object.values(healthToolRegistry);
export const toolboxToolRegistry = { ...healthToolRegistry, ...internalToolRegistry } as const;
export const toolboxToolDefinitions = Object.values(toolboxToolRegistry) as readonly ToolboxToolDefinition[];

export const healthToolCategoryRegistry = {
  health: { id: "health", label: "보건 업무" },
  records: { id: "records", label: "기록·행정" },
  general: { id: "general", label: "일반 도구" },
} as const satisfies Record<HealthToolCategoryId, HealthToolCategoryDefinition>;

export const healthToolCategories = healthToolCategoryIds.map((categoryId) => ({
  ...healthToolCategoryRegistry[categoryId],
  tools: toolboxToolDefinitions.filter((tool) => tool.category === categoryId),
}));
