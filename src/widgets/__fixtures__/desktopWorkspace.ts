import type { WorkspaceData } from "../../workspace-data/types";

/** Synthetic presentation fixture only; never imported by the production entrypoint. */
export const syntheticWorkspace: WorkspaceData = {
  todayTasks: [
    { id: "qa-task-1", title: "합성 · 응급처치 교육 자료 최종 점검", completed: false, status: "inProgress", priority: "high", todayReason: "dueToday" },
    { id: "qa-task-2", title: "합성 · 건강검진 안내문 검토", completed: false, status: "needsCheck", priority: "normal", todayReason: "scheduledToday" },
    { id: "qa-task-3", title: "합성 · 보건실 물품 수량 확인", completed: false, status: "waitingForReply", priority: "normal", todayReason: "dueToday" },
    { id: "qa-task-4", title: "합성 · 안전교육 일정 정리", completed: true, status: "completed", priority: "low", todayReason: "scheduledToday" },
    { id: "qa-task-5", title: "합성 · 주간 업무 보고 초안", completed: false, status: "planned", priority: "normal", todayReason: "scheduledToday" },
  ],
  calendarEvents: [
    { id: "qa-event-1", targetDate: "2026-10-05", title: "합성 · 응급처치 교육", category: "교육" },
    { id: "qa-event-2", targetDate: "2026-10-07", title: "합성 · 건강검진 안내", category: "검진" },
    { id: "qa-event-3", targetDate: "2026-10-12", title: "합성 · 안전교육 주간", category: "행사" },
    { id: "qa-event-4", targetDate: "2026-10-14", title: "합성 · 월간 업무 보고", category: "보고" },
    { id: "qa-event-5", targetDate: "2026-10-19", title: "합성 · 감염병 예방교육 자료 준비", category: "교육" },
    { id: "qa-event-6", targetDate: "2026-10-21", title: "합성 · 응급처치 교육 자료 최종 점검", category: "교육" },
    { id: "qa-event-7", targetDate: "2026-10-21", title: "합성 · 검진 결과 안내 일정", category: "검진" },
    { id: "qa-event-8", targetDate: "2026-10-21", title: "합성 · 보고 자료 검토", category: "보고" },
    { id: "qa-event-9", targetDate: "2026-10-23", title: "합성 · 건강검진 일정 확인", category: "검진" },
    { id: "qa-event-10", targetDate: "2026-10-26", title: "합성 · 보건 행사 준비", category: "행사" },
    { id: "qa-event-11", targetDate: "2026-10-30", title: "합성 · 월말 실적 정리", category: "보고" },
  ],
  weekSchedule: [
    { date: "2026-10-19", items: ["합성 · 예방교육 자료 준비"] },
    { date: "2026-10-20", items: [] },
    { date: "2026-10-21", items: ["합성 · 응급처치 교육", "합성 · 검진 안내 검토", "합성 · 보고 자료 확인"] },
    { date: "2026-10-22", items: ["합성 · 물품 점검"] },
    { date: "2026-10-23", items: ["합성 · 건강검진 확인"] },
    { date: "2026-10-24", items: [] }, { date: "2026-10-25", items: [] },
  ],
  upcomingEvents: [
    { id: "qa-upcoming-1", targetDate: "2026-10-21", title: "합성 · 응급처치 교육 자료 최종 점검", category: "교육" },
    { id: "qa-upcoming-2", targetDate: "2026-10-23", title: "합성 · 건강검진 일정 확인", category: "검진" },
    { id: "qa-upcoming-3", targetDate: "2026-10-26", title: "합성 · 보건 행사 준비", category: "행사" },
    { id: "qa-upcoming-4", targetDate: "2026-10-30", title: "합성 · 월말 실적 정리", category: "보고" },
  ],
  ddayItems: [
    { id: "qa-dday-1", targetDate: "2026-10-23", title: "합성 · 건강검진", source: "event" },
    { id: "qa-dday-2", targetDate: "2026-10-30", title: "합성 · 월간 보고", source: "task" },
    { id: "qa-dday-3", targetDate: "2026-11-04", title: "합성 · 응급처치 교육", source: "event" },
  ],
  notifications: [], inboxItems: [],
  summary: { todayEventCount: 3, todayTaskCount: 5, incompleteTaskCount: 4 },
};
