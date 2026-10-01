import type { AuthStatus } from "../auth/types";
import { TaskActionStateConflictError } from "./taskActionStateRepository";
import type {
  TaskActionStateInput,
  TaskActionStateRepository,
  WorkspaceDataState,
} from "./types";

export type TaskActionStateOutcome = "success" | "conflict" | "error" | "ignored";

export const taskActionStateErrorMessage = (outcome: TaskActionStateOutcome): string | null => {
  if (outcome === "conflict") return "BOGUNON에서 변경된 업무입니다. 새로고침 후 다시 시도해 주세요.";
  if (outcome === "error") return "업무 상태를 저장하지 못했습니다. 다시 시도해 주세요.";
  return null;
};

export const taskActionStatePanelErrorMessage = (outcome: TaskActionStateOutcome): string | null => (
  outcome === "conflict" ? taskActionStateErrorMessage(outcome) : null
);

type RunTaskActionStateOptions = {
  readonly authStatus: AuthStatus;
  readonly userId: string | null;
  readonly state: WorkspaceDataState;
  readonly input: TaskActionStateInput;
  readonly repository: TaskActionStateRepository;
  readonly refresh: () => Promise<WorkspaceDataState>;
  readonly publish: (state: WorkspaceDataState) => void;
};

export const runTaskActionState = async (
  options: RunTaskActionStateOptions,
): Promise<TaskActionStateOutcome> => {
  if (options.authStatus !== "signedIn" || options.userId === null || options.state.status !== "ready") {
    return "ignored";
  }
  try {
    await options.repository.setActionState(options.userId, options.input);
    options.publish(await options.refresh());
    return "success";
  } catch (error: unknown) {
    if (error instanceof TaskActionStateConflictError) {
      options.publish(await options.refresh());
      return "conflict";
    }
    return "error";
  }
};
