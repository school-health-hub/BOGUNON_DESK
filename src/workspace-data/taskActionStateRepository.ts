import { getSupabaseClient } from "../auth/supabaseClient";
import type {
  BogunonNonCompletedTaskStatus,
  TaskActionStateRepository,
  TaskActionStateResult,
} from "./types";

type TaskActionStateClient = Pick<ReturnType<typeof getSupabaseClient>, "rpc">;

const conflictMarker = "TASK_ACTION_STATE_CONFLICT";
const nonCompletedTaskStatuses = ["planned", "inProgress", "waitingForReply", "needsCheck", "onHold"] as const;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const isNonCompletedTaskStatus = (value: unknown): value is BogunonNonCompletedTaskStatus => (
  typeof value === "string" && nonCompletedTaskStatuses.some((status) => status === value)
);

const isTaskActionStateResult = (value: unknown): value is TaskActionStateResult => (
  isRecord(value)
  && typeof value.id === "string"
  && isNonCompletedTaskStatus(value.status)
  && isNonCompletedTaskStatus(value.last_non_completed_status)
  && (typeof value.follow_up_date === "string" || value.follow_up_date === null)
  && value.completed_at === null
  && typeof value.updated_at === "string"
);

export class TaskActionStateConflictError extends Error {
  readonly name = "TaskActionStateConflictError";

  constructor() {
    super(conflictMarker);
  }
}

export class TaskActionStateError extends Error {
  readonly name = "TaskActionStateError";

  constructor() {
    super("업무 상태를 저장하지 못했습니다.");
  }
}

export const createTaskActionStateRepository = (
  client: TaskActionStateClient,
): TaskActionStateRepository => ({
  async setActionState(_userId, input) {
    const { data, error } = await client.rpc("set_task_action_state", {
      p_task_id: input.taskId,
      p_status: input.status,
      p_follow_up_date: input.followUpDate,
      p_expected_updated_at: input.expectedUpdatedAt,
    }).single();
    if (error?.message.includes(conflictMarker) === true) throw new TaskActionStateConflictError();
    if (error !== null || !isTaskActionStateResult(data)) throw new TaskActionStateError();
    return data;
  },
});

export const taskActionStateRepository: TaskActionStateRepository = {
  setActionState: (userId, input) => (
    createTaskActionStateRepository(getSupabaseClient()).setActionState(userId, input)
  ),
};
