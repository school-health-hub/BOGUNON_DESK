import {
  Blocks,
  Calculator,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe2,
  Home,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  Inbox,
  Palette,
  PanelBottom,
  Plus,
  Settings,
  StickyNote,
  Stethoscope,
  Wrench,
} from "lucide-react";
import {
  commandIds,
  type CommandDefinition,
  type CommandExecutionHandlers,
  type CommandGroupId,
  type CommandId,
} from "./types";

export { commandGroupIds, commandIds } from "./types";

export const commandGroupDefinitions = [
  { id: "quick", label: "빠른 실행" },
  { id: "connection", label: "연결" },
  { id: "screen", label: "화면" },
] as const satisfies readonly { readonly id: CommandGroupId; readonly label: string }[];

export const commandRegistry = {
  "quick-add": { id: "quick-add", label: "빠른 추가", description: "업무 또는 일정을 BOGUNON에 바로 저장합니다.", keywords: ["추가", "업무 추가", "일정 추가", "등록"], group: "quick", icon: Plus, kind: "quickAdd" },
  home: { id: "home", label: "홈", description: "업무 화면 맨 위로 이동합니다.", keywords: ["홈", "처음", "대시보드"], group: "quick", icon: Home, kind: "desktopAction", actionId: "home" },
  "today-tasks": { id: "today-tasks", label: "오늘의 보건업무", description: "오늘 처리할 보건업무로 이동합니다.", keywords: ["오늘", "업무", "할 일", "체크리스트"], group: "quick", icon: ListChecks, kind: "desktopAction", actionId: "today-tasks" },
  inbox: { id: "inbox", label: "미처리 업무", description: "마감·후속 확인·회신 대기 업무를 한곳에서 확인합니다.", keywords: ["inbox", "인박스", "미처리", "마감", "회신", "확인", "후속", "할 일"], group: "quick", icon: Inbox, kind: "desktopAction", actionId: "inbox" },
  calculator: { id: "calculator", label: "계산기", description: "일반 계산·퍼센트·날짜·단위 변환 도구를 엽니다.", keywords: ["계산기", "계산", "퍼센트", "비율", "증감률", "날짜 계산", "단위 변환", "calculator"], group: "quick", icon: Calculator, kind: "desktopAction", actionId: "calculator" },
  "purchase-helper": { id: "purchase-helper", label: "품의 도우미", description: "견적서와 구매목록을 품의용 표로 정리합니다.", keywords: ["품의", "구매", "견적", "견적서", "물품", "품목", "엑셀", "장바구니", "행정"], group: "quick", icon: FileSpreadsheet, kind: "desktopAction", actionId: "purchase-helper" },
  "official-document": { id: "official-document", label: "공문 작업실", description: "공문 초안·수정·핵심정리를 한 곳에서 준비합니다.", keywords: ["공문", "기안", "수정", "핵심정리", "행정", "문서"], group: "quick", icon: FileText, kind: "desktopAction", actionId: "official-document" },
  toolbox: { id: "toolbox", label: "업무 도구", description: "AED·생기부·검진 도구를 엽니다.", keywords: ["도구", "aed", "생기부", "검진"], group: "quick", icon: Wrench, kind: "desktopAction", actionId: "toolbox" },
  "quick-memo": { id: "quick-memo", label: "빠른 메모", description: "현재 실행 중에만 유지되는 임시 메모를 엽니다.", keywords: ["메모", "기록", "노트", "임시", "memo"], group: "quick", icon: StickyNote, kind: "desktopAction", actionId: "quick-memo" },
  settings: { id: "settings", label: "설정", description: "계정과 연결, 이 PC 설정을 엽니다.", keywords: ["설정", "계정", "연결"], group: "quick", icon: Settings, kind: "desktopAction", actionId: "settings" },
  "online-health-room": { id: "online-health-room", label: "온라인 보건실", description: "등록된 온라인 보건실을 엽니다.", keywords: ["온라인", "보건실", "교직원"], group: "connection", icon: Stethoscope, kind: "desktopAction", actionId: "online-health-room" },
  bogunon: { id: "bogunon", label: "BOGUNON", description: "연결된 BOGUNON을 기본 브라우저에서 엽니다.", keywords: ["bogunon", "보그논", "업무", "일정"], group: "connection", icon: Globe2, kind: "desktopAction", actionId: "bogunon" },
  "work-folder": { id: "work-folder", label: "업무 폴더", description: "이 PC에 등록한 업무 폴더를 엽니다.", keywords: ["폴더", "업무 폴더", "즐겨찾기", "파일", "문서"], group: "connection", icon: FolderOpen, kind: "desktopAction", actionId: "work-folder" },
  "work-portal": { id: "work-portal", label: "업무포털 열기", description: "등록한 업무포털을 기본 브라우저에서 엽니다.", keywords: ["업무포털", "포털", "나이스", "neis", "교육청"], group: "connection", icon: Globe2, kind: "desktopAction", actionId: "work-portal" },
  workspace: { id: "workspace", label: "화면 꾸미기", description: "위젯을 이동하고 크기를 조절합니다.", keywords: ["꾸미기", "편집", "위젯"], group: "screen", icon: LayoutDashboard, kind: "workspaceEditor", target: "workspace" },
  "widget-library": { id: "widget-library", label: "위젯", description: "화면에 표시할 위젯을 선택합니다.", keywords: ["위젯", "추가", "라이브러리"], group: "screen", icon: Blocks, kind: "widgetLibrary" },
  presets: { id: "presets", label: "배치", description: "업무 방식에 맞는 화면 배치를 선택합니다.", keywords: ["프리셋", "배치", "레이아웃"], group: "screen", icon: LayoutTemplate, kind: "workspaceEditor", target: "presets" },
  appearance: { id: "appearance", label: "스타일", description: "배경과 카드 모양을 변경합니다.", keywords: ["화면", "스타일", "배경", "테마"], group: "screen", icon: Palette, kind: "workspaceEditor", target: "appearance" },
  "dock-editor": { id: "dock-editor", label: "Dock", description: "Dock 항목의 순서와 표시 여부를 바꿉니다.", keywords: ["dock", "독", "편집", "순서"], group: "screen", icon: PanelBottom, kind: "workspaceEditor", target: "dock" },
} as const satisfies Record<CommandId, CommandDefinition>;

export const commandDefinitions = commandIds.map((commandId) => commandRegistry[commandId]);

const normalized = (value: string): string => value.trim().toLocaleLowerCase();

const assertNever = (value: never): never => {
  throw new TypeError(`지원하지 않는 command kind: ${String(value)}`);
};

export const filterCommands = (query: string): readonly CommandDefinition[] => {
  const target = normalized(query);
  if (target.length === 0) return commandDefinitions;
  return commandDefinitions.filter((command) => normalized([
    command.label,
    command.description,
    ...command.keywords,
  ].join(" ")).includes(target));
};

export const executeCommand = async (
  commandId: CommandId,
  handlers: CommandExecutionHandlers,
): Promise<void> => {
  const command = commandRegistry[commandId];
  switch (command.kind) {
    case "quickAdd":
      handlers.openQuickAdd();
      return;
    case "desktopAction":
      await handlers.runDesktopAction(command.actionId);
      return;
    case "workspaceEditor":
      handlers.openWorkspaceEditor(command.target);
      return;
    case "widgetLibrary":
      handlers.openWidgetLibrary();
      return;
    default:
      return assertNever(command);
  }
};
