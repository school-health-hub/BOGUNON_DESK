import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../auth/supabaseClient";
import type {
  BogunonEventRow,
  BogunonTaskRow,
  WorkspaceDataRepository,
  WorkspaceDateRange,
} from "./types";

export const TASK_SELECT_COLUMNS = "id,title,area,status,priority,scheduled_date,due_date,follow_up_date,completed_at,category,updated_at";
export const EVENT_SELECT_COLUMNS = "id,title,area,start_date,end_date,is_all_day,start_time,end_time,color_key";

const queryStart = (range: WorkspaceDateRange): string => (
  range.weekStart < range.monthStart ? range.weekStart : range.monthStart
);

const queryEnd = (range: WorkspaceDateRange): string => (
  range.weekEnd > range.monthEnd ? range.weekEnd : range.monthEnd
);

type WorkspaceClient = Pick<SupabaseClient, "from">;

export const createBogunonWorkspaceRepository = (client: WorkspaceClient): WorkspaceDataRepository => ({
  async load(userId, range, enabledAreas) {
    if (enabledAreas.length === 0) return {
      tasks: [],
      events: [],
      ddayTasks: [],
      ddayEvents: [],
      notificationTasks: [],
    };
    const ddayTaskQuery = (priority: BogunonTaskRow["priority"]) => client
      .from("tasks")
      .select(TASK_SELECT_COLUMNS)
      .eq("user_id", userId)
      .in("area", enabledAreas)
      .gte("due_date", range.today)
      .not("status", "in", "(completed,onHold)")
      .eq("priority", priority)
      .order("due_date")
      .order("title")
      .limit(4);
    const [
      tasksResult,
      currentEventsResult,
      upcomingEventsResult,
      highDdayTasksResult,
      normalDdayTasksResult,
      lowDdayTasksResult,
      ddayEventsResult,
      notificationStatusResult,
      notificationDueResult,
      notificationFollowUpResult,
    ] = await Promise.all([
      client
        .from("tasks")
        .select(TASK_SELECT_COLUMNS)
        .eq("user_id", userId)
        .in("area", enabledAreas)
        .or(`and(scheduled_date.gte.${range.weekStart},scheduled_date.lte.${range.weekEnd}),and(due_date.gte.${range.weekStart},due_date.lte.${range.weekEnd})`),
      client
        .from("events")
        .select(EVENT_SELECT_COLUMNS)
        .eq("user_id", userId)
        .in("area", enabledAreas)
        .lte("start_date", queryEnd(range))
        .gte("end_date", queryStart(range))
        .order("start_date"),
      client
        .from("events")
        .select(EVENT_SELECT_COLUMNS)
        .eq("user_id", userId)
        .in("area", enabledAreas)
        .gte("start_date", range.today)
        .order("start_date")
        .limit(5),
      ddayTaskQuery("high"),
      ddayTaskQuery("normal"),
      ddayTaskQuery("low"),
      client
        .from("events")
        .select(EVENT_SELECT_COLUMNS)
        .eq("user_id", userId)
        .in("area", enabledAreas)
        .gte("start_date", range.today)
        .order("start_date")
        .order("title")
        .limit(4),
      client
        .from("tasks")
        .select(TASK_SELECT_COLUMNS)
        .eq("user_id", userId)
        .in("area", enabledAreas)
        .in("status", ["needsCheck", "waitingForReply"]),
      client
        .from("tasks")
        .select(TASK_SELECT_COLUMNS)
        .eq("user_id", userId)
        .in("area", enabledAreas)
        .lte("due_date", range.today)
        .not("status", "in", "(completed,onHold)")
        .order("due_date", { ascending: false }),
      client
        .from("tasks")
        .select(TASK_SELECT_COLUMNS)
        .eq("user_id", userId)
        .in("area", enabledAreas)
        .lte("follow_up_date", range.today)
        .not("status", "in", "(completed,onHold)")
        .order("follow_up_date", { ascending: false }),
    ]);

    if (
      tasksResult.error !== null
      || currentEventsResult.error !== null
      || upcomingEventsResult.error !== null
      || highDdayTasksResult.error !== null
      || normalDdayTasksResult.error !== null
      || lowDdayTasksResult.error !== null
      || ddayEventsResult.error !== null
      || notificationStatusResult.error !== null
      || notificationDueResult.error !== null
      || notificationFollowUpResult.error !== null
    ) {
      throw new Error("BOGUNON 일정과 업무를 불러오지 못했습니다.");
    }

    const events = new Map<string, BogunonEventRow>();
    const currentEvents = (currentEventsResult.data ?? []) as BogunonEventRow[];
    const upcomingEvents = (upcomingEventsResult.data ?? []) as BogunonEventRow[];
    for (const event of [...currentEvents, ...upcomingEvents]) {
      events.set(event.id, event);
    }
    const notificationTasks = new Map<string, BogunonTaskRow>();
    const notificationRows = [
      ...((notificationStatusResult.data ?? []) as BogunonTaskRow[]),
      ...((notificationDueResult.data ?? []) as BogunonTaskRow[]),
      ...((notificationFollowUpResult.data ?? []) as BogunonTaskRow[]),
    ];
    for (const task of notificationRows) notificationTasks.set(task.id, task);
    return {
      tasks: (tasksResult.data ?? []) as BogunonTaskRow[],
      events: [...events.values()],
      ddayTasks: [
        ...((highDdayTasksResult.data ?? []) as BogunonTaskRow[]),
        ...((normalDdayTasksResult.data ?? []) as BogunonTaskRow[]),
        ...((lowDdayTasksResult.data ?? []) as BogunonTaskRow[]),
      ],
      ddayEvents: (ddayEventsResult.data ?? []) as BogunonEventRow[],
      notificationTasks: [...notificationTasks.values()],
    };
  },
});

export const bogunonWorkspaceRepository: WorkspaceDataRepository = {
  load: (userId, range, enabledAreas) => createBogunonWorkspaceRepository(getSupabaseClient()).load(userId, range, enabledAreas),
};
