import { getSupabaseClient } from "../auth/supabaseClient";
import type {
  BogunonNonCompletedTaskStatus,
  BogunonTaskStatus,
  TaskCompletionRepository,
  TaskCompletionResult,
} from "./types";

type TaskCompletionClient = Pick<ReturnType<typeof getSupabaseClient>, "rpc">;

const taskStatuses = ["planned", "inProgress", "waitingForReply", "needsCheck", "completed", "onHold"] as const;
const nonCompletedTaskStatuses = ["planned", "inProgress", "waitingForReply", "needsCheck", "onHold"] as const;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const isTaskStatus = (value: unknown): value is BogunonTaskStatus => (
  typeof value === "string" && taskStatuses.some((status) => status === value)
);

const isNonCompletedTaskStatus = (value: unknown): value is BogunonNonCompletedTaskStatus => (
  typeof value === "string" && nonCompletedTaskStatuses.some((status) => status === value)
);

const isTaskCompletionResult = (value: unknown): value is TaskCompletionResult => (
  isRecord(value)
  && typeof value.id === "string"
  && isTaskStatus(value.status)
  && isNonCompletedTaskStatus(value.last_non_completed_status)
  && (typeof value.completed_at === "string" || value.completed_at === null)
  && typeof value.updated_at === "string"
);

export class TaskCompletionError extends Error {
  constructor() {
    super("완료 상태를 저장하지 못했습니다.");
    this.name = "TaskCompletionError";
  }
}

export const createTaskCompletionRepository = (
  client: TaskCompletionClient,
): TaskCompletionRepository => ({
  async setCompleted(_userId, taskId, completed) {
    const { data, error } = await client.rpc("set_task_completed", {
      p_task_id: taskId,
      p_completed: completed,
    }).single();
    if (error !== null || !isTaskCompletionResult(data)) throw new TaskCompletionError();
    return data;
  },
});

export const taskCompletionRepository: TaskCompletionRepository = {
  setCompleted: (userId, taskId, completed) => (
    createTaskCompletionRepository(getSupabaseClient()).setCompleted(userId, taskId, completed)
  ),
};
