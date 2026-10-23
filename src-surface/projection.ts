import type { DesktopActionId } from "../src/desktop/types";

export const surfaceWidgetIds = ["calendar", "tasks", "dday", "clock", "weather", "launcher"] as const;
export type SurfaceWidgetId = (typeof surfaceWidgetIds)[number];

export const surfaceActionIds = ["official-document", "purchase-helper", "record-helper", "home"] as const satisfies readonly DesktopActionId[];
export type SurfaceActionId = (typeof surfaceActionIds)[number];

export type SurfaceEventKind = "education" | "checkup" | "event" | "report";
export type SurfaceItemKind = "task" | "event";
export type SurfaceWeatherState = "ready" | "loading" | "empty" | "error";

export type SurfaceCalendarEvent = Readonly<{ date: string; kind: SurfaceEventKind; label: string }>;
export type SurfaceTask = Readonly<{ id: string; label: string; dueDate: string | null; completed: boolean; order: number }>;
export type SurfaceDday = Readonly<{ id: string; label: string; targetDate: string; remainingDays: number; kind: SurfaceItemKind }>;
export type SurfaceWeather = Readonly<{
  state: SurfaceWeatherState;
  temperatureCelsius: number | null;
  condition: string | null;
  iconCode: "sunny" | "cloudy" | "rain" | "snow" | null;
  updatedAt: string | null;
}>;
export type SurfaceLauncher = Readonly<{ actionId: SurfaceActionId; label: string; icon: "document" | "purchase" | "record" | "dashboard" }>;
export type SurfaceProjection = Readonly<{
  kind: "synthetic-preview";
  generatedAt: string;
  calendarEvents: readonly SurfaceCalendarEvent[];
  tasks: readonly SurfaceTask[];
  ddays: readonly SurfaceDday[];
  weather: SurfaceWeather;
  launchers: readonly SurfaceLauncher[];
}>;

export const syntheticSurfaceProjection: SurfaceProjection = {
  kind: "synthetic-preview",
  generatedAt: "2026-10-23T09:41:00+09:00",
  calendarEvents: [
    { date: "2026-10-06", kind: "education", label: "합성 교육 일정" },
    { date: "2026-10-14", kind: "checkup", label: "합성 검진 일정" },
    { date: "2026-10-20", kind: "report", label: "합성 보고 일정" },
    { date: "2026-10-23", kind: "event", label: "합성 학교 행사" },
    { date: "2026-10-23", kind: "education", label: "합성 연수 일정" },
  ],
  tasks: [
    { id: "synthetic-task-1", label: "합성 보건실 점검표 확인", dueDate: "2026-10-23", completed: false, order: 1 },
    { id: "synthetic-task-2", label: "합성 교육자료 검토", dueDate: "2026-10-24", completed: false, order: 2 },
    { id: "synthetic-task-3", label: "합성 안내문 정리", dueDate: null, completed: true, order: 3 },
  ],
  ddays: [
    { id: "synthetic-dday-1", label: "합성 연수 신청", targetDate: "2026-10-23", remainingDays: 0, kind: "task" },
    { id: "synthetic-dday-2", label: "합성 건강검사", targetDate: "2026-10-30", remainingDays: 7, kind: "event" },
    { id: "synthetic-dday-3", label: "합성 제출 마감", targetDate: "2026-10-19", remainingDays: -4, kind: "task" },
  ],
  weather: { state: "ready", temperatureCelsius: 18, condition: "맑고 선선함", iconCode: "sunny", updatedAt: "2026-10-23T09:35:00+09:00" },
  launchers: [
    { actionId: "official-document", label: "공문 작업실", icon: "document" },
    { actionId: "purchase-helper", label: "Purchase Helper", icon: "purchase" },
    { actionId: "record-helper", label: "Record Helper", icon: "record" },
    { actionId: "home", label: "메인 Dashboard", icon: "dashboard" },
  ],
};
