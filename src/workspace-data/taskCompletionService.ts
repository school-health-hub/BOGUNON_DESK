import type { AuthStatus } from "../auth/types";
import type { BogunonTaskStatus, TaskCompletionRepository, WorkspaceData, WorkspaceDataState } from "./types";
import { compareTodayTasks } from "./workspaceTodayTaskAdapter";

export type TaskCompletionOutcome = "success" | "error" | "ignored";

export const applyTaskCompletion = (
  data: WorkspaceData,
  taskId: string,
  status: BogunonTaskStatus,
): WorkspaceData => {
  const completed = status === "completed";
  const todayTasks = data.todayTasks.map((task) => task.id === taskId ? {
    ...task,
    completed,
    status,
  } : task).sort(compareTodayTasks);
  return {
    ...data,
    todayTasks,
    inboxItems: completed ? data.inboxItems.filter((item) => item.id !== taskId) : data.inboxItems,
    summary: {
      ...data.summary,
      incompleteTaskCount: todayTasks.filter((task) => !task.completed).length,
    },
  };
};

type RunTaskCompletionOptions = {
  readonly authStatus: AuthStatus;
  readonly userId: string | null;
  readonly state: WorkspaceDataState;
  readonly taskId: string;
  readonly completed: boolean;
  readonly repository: TaskCompletionRepository;
  readonly refresh: () => Promise<WorkspaceDataState>;
  readonly publish: (state: WorkspaceDataState) => void;
};

export const runTaskCompletion = async (options: RunTaskCompletionOptions): Promise<TaskCompletionOutcome> => {
  if (options.authStatus !== "signedIn" || options.userId === null || options.state.status !== "ready") {
    return "ignored";
  }
  const previous = options.state;
  try {
    const result = await options.repository.setCompleted(options.userId, options.taskId, options.completed);
    options.publish({ status: "ready", data: applyTaskCompletion(previous.data, options.taskId, result.status) });
    options.publish(await options.refresh());
    return "success";
  } catch {
    return "error";
  }
};

export const createTaskMutationGuard = () => {
  let pending = false;
  return {
    run: async (operation: () => Promise<void>): Promise<boolean> => {
      if (pending) return false;
      pending = true;
      try {
        await operation();
        return true;
      } finally {
        pending = false;
      }
    },
  };
};
