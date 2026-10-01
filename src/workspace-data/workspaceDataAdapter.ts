import { getWeekDates, parseLocalDate } from "../dashboard/dateSource";
import type { ScheduleCategory } from "../types/dashboard";
import type {
  BogunonArea,
  BogunonEventRow,
  WorkspaceCalendarEvent,
  WorkspaceData,
  WorkspaceDateRange,
  WorkspaceSourceRows,
} from "./types";
import type { WorkspaceArea } from "../settings/workspaceFilters";
import { adaptWorkspaceDdayItems } from "./workspaceDdayAdapter";
import { adaptWorkspaceNotifications } from "./workspaceNotificationAdapter";
import { adaptWorkspaceActionableTasks } from "./workspaceActionableTaskAdapter";
import { compareTodayTasks } from "./workspaceTodayTaskAdapter";

export const formatWorkspaceDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addLocalDays = (date: Date, days: number): Date => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
};

const areaCategory: Readonly<Record<BogunonArea, ScheduleCategory>> = {
  healthWork: "검진",
  schoolSchedule: "행사",
  exercise: "행사",
  personal: "보고",
  project: "보고",
};

const colorCategory: Readonly<Record<string, ScheduleCategory>> = {
  blue: "교육",
  mint: "검진",
  yellow: "행사",
  coral: "행사",
  lavender: "보고",
  pink: "보고",
};

export const mapEventCategory = (event: Pick<BogunonEventRow, "area" | "color_key">): ScheduleCategory => (
  event.color_key === null ? areaCategory[event.area] : colorCategory[event.color_key] ?? areaCategory[event.area]
);

export const createWorkspaceDateRange = (now: Date): WorkspaceDateRange => {
  const weekDates = getWeekDates(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    today: formatWorkspaceDate(now),
    weekStart: formatWorkspaceDate(weekDates[0]),
    weekEnd: formatWorkspaceDate(weekDates[6]),
    monthStart: formatWorkspaceDate(monthStart),
    monthEnd: formatWorkspaceDate(monthEnd),
  };
};

const eventOverlapsDate = (event: BogunonEventRow, date: string): boolean => (
  event.start_date <= date && event.end_date >= date
);

const expandMonthlyEvent = (
  event: BogunonEventRow,
  range: WorkspaceDateRange,
): readonly WorkspaceCalendarEvent[] => {
  const eventStart = parseLocalDate(event.start_date);
  const monthStart = parseLocalDate(range.monthStart);
  const monthEnd = parseLocalDate(range.monthEnd);
  if (eventStart === null || monthStart === null || monthEnd === null) return [];

  const first = event.start_date < range.monthStart ? monthStart : eventStart;
  const last = event.end_date > range.monthEnd ? monthEnd : parseLocalDate(event.end_date);
  if (last === null || first > last) return [];

  const items: WorkspaceCalendarEvent[] = [];
  for (let date = first; date <= last; date = addLocalDays(date, 1)) {
    items.push({
      id: `${event.id}:${formatWorkspaceDate(date)}`,
      targetDate: formatWorkspaceDate(date),
      title: event.title,
      category: mapEventCategory(event),
    });
  }
  return items;
};

export const adaptWorkspaceData = (
  rows: WorkspaceSourceRows,
  now: Date,
  enabledAreas: readonly WorkspaceArea[],
): WorkspaceData => {
  const range = createWorkspaceDateRange(now);
  const allowedAreas = new Set(enabledAreas);
  const tasks = rows.tasks.filter((task) => allowedAreas.has(task.area));
  const events = rows.events.filter((event) => allowedAreas.has(event.area));
  const todayTasksById = new Map(tasks.filter((task) => (
    task.scheduled_date === range.today
    || (task.due_date === range.today && task.status !== "completed")
  )).map((task) => [task.id, task]));
  const todayTasks = [...todayTasksById.values()]
    .map((task) => ({
      id: task.id,
      title: task.title,
      completed: task.status === "completed",
      status: task.status,
      priority: task.priority,
      todayReason: task.due_date === range.today ? "dueToday" as const : "scheduledToday" as const,
    }))
    .sort(compareTodayTasks);

  const weekDates = getWeekDates(now).map(formatWorkspaceDate);
  const weekSchedule = weekDates.map((date) => {
    const eventTitles = events.filter((event) => eventOverlapsDate(event, date)).map((event) => event.title);
    const taskTitles = tasks.filter((task) => (
      task.scheduled_date === date || (task.due_date === date && task.status !== "completed")
    )).map((task) => task.title);
    return { date, items: [...new Set([...eventTitles, ...taskTitles])] };
  });

  const calendarEvents = events.flatMap((event) => expandMonthlyEvent(event, range));
  const upcomingEvents = [...events]
    .filter((event) => event.end_date >= range.today)
    .sort((left, right) => {
      const leftDate = left.start_date < range.today ? range.today : left.start_date;
      const rightDate = right.start_date < range.today ? range.today : right.start_date;
      return leftDate.localeCompare(rightDate) || left.title.localeCompare(right.title);
    })
    .slice(0, 5)
    .map((event) => ({
      id: event.id,
      targetDate: event.start_date < range.today ? range.today : event.start_date,
      title: event.title,
      category: mapEventCategory(event),
    }));
  const todayEventCount = events.filter((event) => eventOverlapsDate(event, range.today)).length;
  const ddayItems = adaptWorkspaceDdayItems(rows, now, enabledAreas);
  const notifications = adaptWorkspaceNotifications(rows, now, enabledAreas);
  const inboxItems = adaptWorkspaceActionableTasks(rows.notificationTasks, now, enabledAreas);

  return {
    todayTasks,
    calendarEvents,
    weekSchedule,
    upcomingEvents,
    ddayItems,
    notifications,
    inboxItems,
    summary: {
      todayEventCount,
      todayTaskCount: todayTasks.length,
      incompleteTaskCount: todayTasks.filter((task) => !task.completed).length,
    },
  };
};
