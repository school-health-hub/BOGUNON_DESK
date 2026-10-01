import type { ScheduleCategory } from "../types/dashboard";
import type { WorkspaceArea } from "../settings/workspaceFilters";

export type BogunonArea = WorkspaceArea;
export type BogunonTaskStatus = "planned" | "inProgress" | "waitingForReply" | "needsCheck" | "completed" | "onHold";
export type BogunonNonCompletedTaskStatus = Exclude<BogunonTaskStatus, "completed">;
export type BogunonTaskPriority = "low" | "normal" | "high";
export type WorkspaceTodayTaskReason = "dueToday" | "scheduledToday";

export type BogunonTaskRow = {
  readonly id: string;
  readonly title: string;
  readonly area: BogunonArea;
  readonly status: BogunonTaskStatus;
  readonly priority: BogunonTaskPriority;
  readonly scheduled_date: string | null;
  readonly due_date: string | null;
  readonly follow_up_date: string | null;
  readonly completed_at: string | null;
  readonly category: string;
  readonly updated_at: string;
};

export type BogunonEventRow = {
  readonly id: string;
  readonly title: string;
  readonly area: BogunonArea;
  readonly start_date: string;
  readonly end_date: string;
  readonly is_all_day: boolean;
  readonly start_time: string | null;
  readonly end_time: string | null;
  readonly color_key: string | null;
};

export type WorkspaceSourceRows = {
  readonly tasks: readonly BogunonTaskRow[];
  readonly events: readonly BogunonEventRow[];
  readonly ddayTasks: readonly BogunonTaskRow[];
  readonly ddayEvents: readonly BogunonEventRow[];
  readonly notificationTasks: readonly BogunonTaskRow[];
};

export type WorkspaceDateRange = {
  readonly today: string;
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly monthStart: string;
  readonly monthEnd: string;
};

export type WorkspaceTask = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly status: BogunonTaskStatus;
  readonly priority: BogunonTaskPriority;
  readonly todayReason: WorkspaceTodayTaskReason;
};

export type WorkspaceCalendarEvent = {
  readonly id: string;
  readonly targetDate: string;
  readonly title: string;
  readonly category: ScheduleCategory;
};

export type WorkspaceUpcomingEvent = {
  readonly id: string;
  readonly targetDate: string;
  readonly title: string;
  readonly category: ScheduleCategory;
};

export type WorkspaceWeekDay = {
  readonly date: string;
  readonly items: readonly string[];
};

export type WorkspaceDdayItem = {
  readonly id: string;
  readonly targetDate: string;
  readonly title: string;
  readonly source: "task" | "event";
};

export type WorkspaceNotificationItem = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly relevantDate: string | null;
  readonly tone: "info" | "warning";
};

export const workspaceInboxReasons = ["overdue", "dueToday", "followUp", "needsCheck", "waitingForReply"] as const;
export type WorkspaceInboxReason = (typeof workspaceInboxReasons)[number];

export type WorkspaceInboxItem = {
  readonly id: string;
  readonly title: string;
  readonly reason: WorkspaceInboxReason;
  readonly detail: string;
  readonly priority: BogunonTaskPriority;
  readonly status: BogunonNonCompletedTaskStatus;
  readonly followUpDate: string | null;
  readonly updatedAt: string;
  readonly relevantDate: string | null;
  readonly area: WorkspaceArea;
  readonly completed: false;
  readonly tone: "info" | "warning";
};

export type WorkspaceData = {
  readonly todayTasks: readonly WorkspaceTask[];
  readonly calendarEvents: readonly WorkspaceCalendarEvent[];
  readonly weekSchedule: readonly WorkspaceWeekDay[];
  readonly upcomingEvents: readonly WorkspaceUpcomingEvent[];
  readonly ddayItems: readonly WorkspaceDdayItem[];
  readonly notifications: readonly WorkspaceNotificationItem[];
  readonly inboxItems: readonly WorkspaceInboxItem[];
  readonly summary: {
    readonly todayEventCount: number;
    readonly todayTaskCount: number;
    readonly incompleteTaskCount: number;
  };
};

export type WorkspaceDataState =
  | { readonly status: "loading" }
  | { readonly status: "signedOut" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly data: WorkspaceData };

export interface WorkspaceDataRepository {
  load(userId: string, range: WorkspaceDateRange, enabledAreas: readonly WorkspaceArea[]): Promise<WorkspaceSourceRows>;
}

export interface TaskCompletionRepository {
  setCompleted(userId: string, taskId: string, completed: boolean): Promise<TaskCompletionResult>;
}

export type TaskCompletionResult = {
  readonly id: string;
  readonly status: BogunonTaskStatus;
  readonly last_non_completed_status: BogunonNonCompletedTaskStatus;
  readonly completed_at: string | null;
  readonly updated_at: string;
};

export type TaskActionStateInput = {
  readonly taskId: string;
  readonly status: BogunonNonCompletedTaskStatus;
  readonly followUpDate: string | null;
  readonly expectedUpdatedAt: string;
};

export type TaskActionStateResult = {
  readonly id: string;
  readonly status: BogunonNonCompletedTaskStatus;
  readonly last_non_completed_status: BogunonNonCompletedTaskStatus;
  readonly follow_up_date: string | null;
  readonly completed_at: null;
  readonly updated_at: string;
};

export interface TaskActionStateRepository {
  setActionState(userId: string, input: TaskActionStateInput): Promise<TaskActionStateResult>;
}
