import type {
  CalendarEvent,
  DDayItem,
  HealthTask,
  NotificationItem,
  UpcomingSchedule,
  WeekDay,
} from "../types/dashboard";

export const calendarEvents = [
  { day: 2, title: "감염병 예방교육", category: "교육" },
  { day: 4, title: "1학년 구강검진", category: "검진" },
  { day: 7, title: "응급처치 연수", category: "교육" },
  { day: 9, title: "보건소 협의회", category: "행사" },
  { day: 11, title: "학생 건강조사", category: "검진" },
  { day: 15, title: "AED 정기점검", category: "보고" },
  { day: 17, title: "결핵검진 안내", category: "검진" },
  { day: 18, title: "교직원 결핵검진", category: "검진" },
  { day: 23, title: "마약류 결과보고", category: "보고" },
  { day: 25, title: "건강동아리 활동", category: "행사" },
  { day: 30, title: "월말 약품 점검", category: "보고" },
] as const satisfies readonly CalendarEvent[];

export const initialTasks = [
  { id: "task-1", title: "결핵검진 안내문 최종 확인", completed: true, time: "09:00" },
  { id: "task-2", title: "보건소 담당자 전화", completed: true, time: "10:30" },
  { id: "task-3", title: "약품 주문 품의 진행 상황 확인", completed: true },
  { id: "task-4", title: "AED 점검표 작성", completed: true, time: "13:30" },
  { id: "task-5", title: "마약류 예방교육 설문 링크 발송", completed: false, time: "15:00" },
  { id: "task-6", title: "상담 학생 건강상태 확인", completed: false },
] as const satisfies readonly HealthTask[];

export const upcomingSchedules = [
  { targetDate: "2026-09-18", date: "09.18", weekday: "금", title: "교직원 결핵검진", category: "검진" },
  { targetDate: "2026-09-23", date: "09.23", weekday: "수", title: "마약류 예방교육 결과보고", category: "보고" },
  { targetDate: "2026-09-25", date: "09.25", weekday: "금", title: "건강동아리 캠페인", category: "행사" },
  { targetDate: "2026-09-30", date: "09.30", weekday: "수", title: "보건실 약품 재고 점검", category: "보고" },
  { targetDate: "2026-10-07", date: "10.07", weekday: "수", title: "2학기 감염병 예방교육", category: "교육" },
] as const satisfies readonly UpcomingSchedule[];

export const dDayItems = [
  { targetDate: "2026-09-18", title: "교직원 결핵검진" },
  { targetDate: "2026-09-23", title: "마약류 예방교육 결과보고" },
  { targetDate: "2026-10-01", title: "2학기 건강검진 결과 제출" },
  { targetDate: "2026-10-12", title: "체육대회" },
] as const satisfies readonly DDayItem[];

export const weekSchedule: readonly WeekDay[] = [
  { day: "월", items: ["약품 재고 확인"] },
  { day: "화", items: ["AED 점검", "보건소 통화"] },
  { day: "수", items: ["교직원 검진 준비"] },
  { day: "목", items: ["설문 링크 발송", "학생 상담"] },
  { day: "금", items: ["결핵검진"] },
  { day: "토", items: [] },
  { day: "일", items: [] },
] as const;

export const notifications = [
  { id: "note-1", title: "결핵검진 명단 확인 필요", detail: "미확인 교직원 3명", tone: "warning" },
  { id: "note-2", title: "AED 점검표가 준비되었습니다", detail: "오늘 17:00까지 작성", tone: "info" },
  { id: "note-3", title: "약품 주문 품의가 승인되었습니다", detail: "행정실 · 12분 전", tone: "success" },
] as const satisfies readonly NotificationItem[];
