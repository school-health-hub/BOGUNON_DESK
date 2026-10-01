export const scheduleCategories = ["교육", "검진", "행사", "보고"] as const;

export type ScheduleCategory = (typeof scheduleCategories)[number];

export type CalendarEvent = {
  readonly day: number;
  readonly title: string;
  readonly category: ScheduleCategory;
};

export type HealthTask = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly time?: string;
};

export type UpcomingSchedule = {
  readonly targetDate: string;
  readonly date: string;
  readonly weekday: string;
  readonly title: string;
  readonly category: ScheduleCategory;
};

export type DDayItem = {
  readonly targetDate: string;
  readonly title: string;
};

export type WeekDay = {
  readonly day: string;
  readonly items: readonly string[];
};

export type NotificationItem = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly tone: "info" | "warning" | "success";
};
