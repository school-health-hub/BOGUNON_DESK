import type { DashboardLayout, DashboardPresetId, WidgetLayout } from "./types";
import { createDashboardLayout, defaultAppearance, defaultWidgetLayouts, deskWidgetLayouts } from "./layouts";

type DashboardPreset = {
  readonly id: DashboardPresetId;
  readonly name: string;
  readonly description: string;
  readonly layout: DashboardLayout;
};

const hidden = (widget: WidgetLayout): WidgetLayout => ({ ...widget, visible: false });

const pick = (type: WidgetLayout["type"]): WidgetLayout => {
  const found = defaultWidgetLayouts.find((widget) => widget.type === type);
  if (found === undefined) {
    throw new Error(`정의되지 않은 기본 위젯 타입입니다: ${type}`);
  }
  return { ...found };
};

const scheduleWidgets = [
  { ...pick("clock"), x: 0, y: 0, w: 3, h: 2 },
  { ...pick("today-summary"), x: 3, y: 0, w: 5, h: 2 },
  { ...pick("priority-task"), x: 8, y: 0, w: 4, h: 2 },
  { ...pick("monthly-calendar"), x: 0, y: 2, w: 7, h: 8 },
  { ...pick("upcoming-schedule"), x: 7, y: 2, w: 3, h: 4 },
  { ...pick("dday"), x: 10, y: 2, w: 2, h: 4 },
  { ...pick("weekly-schedule"), x: 0, y: 10, w: 9, h: 3 },
  { ...pick("today-tasks"), x: 9, y: 6, w: 3, h: 4 },
  hidden(pick("quick-memo")),
  hidden(pick("quick-launcher")),
  hidden(pick("notifications")),
  hidden(pick("meal")),
  hidden(pick("weather")),
] as const satisfies readonly WidgetLayout[];

const workWidgets = [
  { ...pick("clock"), x: 0, y: 0, w: 3, h: 2 },
  { ...pick("priority-task"), x: 3, y: 0, w: 5, h: 2 },
  { ...pick("today-summary"), x: 8, y: 0, w: 4, h: 2 },
  { ...pick("today-tasks"), x: 0, y: 2, w: 6, h: 7 },
  { ...pick("quick-memo"), x: 6, y: 2, w: 3, h: 4 },
  hidden(pick("quick-launcher")),
  { ...pick("upcoming-schedule"), x: 9, y: 2, w: 3, h: 4 },
  { ...pick("monthly-calendar"), x: 6, y: 6, w: 6, h: 5 },
  { ...pick("notifications"), x: 0, y: 9, w: 5, h: 3 },
  hidden(pick("dday")),
  hidden(pick("weekly-schedule")),
  hidden(pick("meal")),
  hidden(pick("weather")),
] as const satisfies readonly WidgetLayout[];

const minimalWidgets = [
  { ...pick("clock"), x: 0, y: 0, w: 3, h: 2 },
  { ...pick("today-tasks"), x: 3, y: 0, w: 5, h: 5 },
  { ...pick("upcoming-schedule"), x: 8, y: 0, w: 4, h: 3 },
  { ...pick("dday"), x: 8, y: 3, w: 4, h: 2 },
  hidden(pick("today-summary")),
  hidden(pick("priority-task")),
  hidden(pick("monthly-calendar")),
  hidden(pick("quick-memo")),
  hidden(pick("quick-launcher")),
  hidden(pick("weekly-schedule")),
  hidden(pick("notifications")),
  hidden(pick("meal")),
  hidden(pick("weather")),
] as const satisfies readonly WidgetLayout[];

export const dashboardPresets = [
  {
    id: "default",
    name: "기본형",
    description: "현재 BOGUNON DESK의 균형형 배치입니다.",
    layout: createDashboardLayout(defaultWidgetLayouts, defaultAppearance, "default"),
  },
  {
    id: "schedule",
    name: "일정 중심",
    description: "월간 일정과 가까운 마감, 주간 실무일정을 크게 봅니다.",
    layout: createDashboardLayout(scheduleWidgets, defaultAppearance, "schedule"),
  },
  {
    id: "work",
    name: "업무 중심",
    description: "오늘 처리할 업무와 메모, 우선순위 업무를 앞에 둡니다.",
    layout: createDashboardLayout(workWidgets, defaultAppearance, "work"),
  },
  {
    id: "minimal",
    name: "미니멀",
    description: "날짜, 오늘 업무, 가까운 일정, D-Day만 남긴 단순 배치입니다.",
    layout: createDashboardLayout(minimalWidgets, defaultAppearance, "minimal"),
  },
  {
    id: "desk",
    name: "데스크형",
    description: "오늘의 업무, 일정, 메모를 원하는 위치에 배치해 사용하는 개인 데스크형 화면입니다.",
    layout: createDashboardLayout(deskWidgetLayouts, defaultAppearance, "desk"),
  },
] as const satisfies readonly DashboardPreset[];

export const getDashboardPreset = (presetId: DashboardPresetId): DashboardPreset => {
  const preset = dashboardPresets.find((item) => item.id === presetId);
  if (preset === undefined) {
    throw new Error(`정의되지 않은 대시보드 프리셋입니다: ${presetId}`);
  }
  return preset;
};
