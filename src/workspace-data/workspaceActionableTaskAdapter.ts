import { differenceInLocalCalendarDays, parseLocalDate } from "../dashboard/dateSource";
import type { WorkspaceArea } from "../settings/workspaceFilters";
import type { BogunonTaskPriority, BogunonTaskRow, WorkspaceInboxItem, WorkspaceInboxReason } from "./types";

const reasonRank: Readonly<Record<WorkspaceInboxReason, number>> = { overdue: 0, dueToday: 1, followUp: 2, needsCheck: 3, waitingForReply: 4 };
const priorityRank: Readonly<Record<BogunonTaskPriority, number>> = { high: 0, normal: 1, low: 2 };

const dateDifference = (value: string | null, now: Date): number | null => {
  if (value === null) return null;
  const date = parseLocalDate(value);
  return date === null ? null : differenceInLocalCalendarDays(date, now);
};

const formatMonthDay = (value: string): string => {
  const date = parseLocalDate(value);
  return date === null ? value : `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, "0")}`;
};

const createCandidate = (task: BogunonTaskRow, now: Date): WorkspaceInboxItem | null => {
  if (task.status === "completed") return null;
  const base = {
    id: task.id,
    title: task.title,
    priority: task.priority,
    status: task.status,
    followUpDate: task.follow_up_date,
    updatedAt: task.updated_at,
    area: task.area,
    completed: false as const,
  };
  const dueDifference = dateDifference(task.due_date, now);
  if (dueDifference !== null && dueDifference < 0) return { ...base, detail: `마감 ${Math.abs(dueDifference)}일 지남`, tone: "warning", reason: "overdue", relevantDate: task.due_date };
  if (dueDifference === 0) return { ...base, detail: "오늘 마감", tone: "warning", reason: "dueToday", relevantDate: task.due_date };
  const followUpDifference = dateDifference(task.follow_up_date, now);
  if (followUpDifference !== null && followUpDifference <= 0) return {
    ...base, detail: followUpDifference === 0 ? "오늘 후속 확인" : `후속 확인 ${Math.abs(followUpDifference)}일 지남`, tone: "warning", reason: "followUp", relevantDate: task.follow_up_date,
  };
  if (task.status === "needsCheck") return { ...base, detail: "BOGUNON 확인 필요", tone: "warning", reason: "needsCheck", relevantDate: task.follow_up_date ?? task.due_date };
  if (task.status === "waitingForReply") return {
    ...base,
    detail: followUpDifference !== null && followUpDifference > 0 && task.follow_up_date !== null ? `회신 대기 · 확인 ${formatMonthDay(task.follow_up_date)}` : "회신 대기",
    tone: "info",
    reason: "waitingForReply",
    relevantDate: followUpDifference !== null && followUpDifference > 0 ? task.follow_up_date : null,
  };
  return null;
};

const compareCandidates = (left: WorkspaceInboxItem, right: WorkspaceInboxItem): number => (
  reasonRank[left.reason] - reasonRank[right.reason]
  || priorityRank[left.priority] - priorityRank[right.priority]
  || (left.relevantDate === null ? 1 : right.relevantDate === null ? -1 : left.relevantDate.localeCompare(right.relevantDate))
  || left.title.localeCompare(right.title)
);

export const adaptWorkspaceActionableTasks = (tasks: readonly BogunonTaskRow[], now: Date, enabledAreas: readonly WorkspaceArea[]): readonly WorkspaceInboxItem[] => {
  const allowedAreas = new Set(enabledAreas);
  const candidates = new Map<string, WorkspaceInboxItem>();
  for (const task of tasks) {
    if (!allowedAreas.has(task.area) || task.status === "completed" || task.status === "onHold") continue;
    const candidate = createCandidate(task, now);
    if (candidate === null) continue;
    const existing = candidates.get(task.id);
    if (existing === undefined || compareCandidates(candidate, existing) < 0) candidates.set(task.id, candidate);
  }
  return [...candidates.values()].sort(compareCandidates);
};
