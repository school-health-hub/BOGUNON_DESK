import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";
import { bogunonWorkspaceRepository } from "./bogunonWorkspaceRepository";
import { loadWorkspaceData } from "./workspaceDataService";
import type { WorkspaceDataState } from "./types";
import type { WorkspaceFilters } from "../settings/workspaceFilters";
import { loadWorkspaceFilters, subscribeWorkspaceFilters } from "../settings/workspaceFilters";
import { taskCompletionRepository } from "./taskCompletionRepository";
import { createTaskMutationGuard, runTaskCompletion, type TaskCompletionOutcome } from "./taskCompletionService";
import { taskActionStateRepository } from "./taskActionStateRepository";
import { runTaskActionState, taskActionStatePanelErrorMessage, type TaskActionStateOutcome } from "./taskActionStateService";
import type { TaskActionStateInput } from "./types";

type WorkspaceDataContextValue = {
  readonly state: WorkspaceDataState;
  readonly refresh: () => void;
  readonly setTaskCompleted: (taskId: string, completed: boolean) => Promise<TaskCompletionOutcome>;
  readonly setTaskActionState: (input: TaskActionStateInput) => Promise<TaskActionStateOutcome>;
  readonly pendingTaskId: string | null;
  readonly taskMutationError: string | null;
  readonly taskActionStateError: string | null;
};

const WorkspaceDataContext = createContext<WorkspaceDataContextValue | null>(null);

const localDateKey = (date: Date): string => (
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
);

export function WorkspaceDataProvider({ children }: { readonly children: ReactNode }) {
  const auth = useAuth();
  const { now } = useWidgetSession();
  const [state, setState] = useState<WorkspaceDataState>({ status: "loading" });
  const [refreshSequence, setRefreshSequence] = useState(0);
  const [filters, setFilters] = useState<WorkspaceFilters>(loadWorkspaceFilters);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [taskMutationError, setTaskMutationError] = useState<string | null>(null);
  const [taskActionStateError, setTaskActionStateError] = useState<string | null>(null);
  const mutationGuard = useRef(createTaskMutationGuard());
  const dateKey = localDateKey(now);

  useEffect(() => {
    let active = true;
    if (auth.state.status === "signedIn") setState({ status: "loading" });
    void loadWorkspaceData({
      authStatus: auth.state.status,
      userId: auth.state.user?.id ?? null,
      now,
      repository: bogunonWorkspaceRepository,
      filters,
    }).then((nextState) => {
      if (active) setState(nextState);
    });
    return () => {
      active = false;
    };
  }, [auth.state.status, auth.state.user?.id, dateKey, filters, refreshSequence]);

  useEffect(() => subscribeWorkspaceFilters(setFilters), []);

  const loadCurrentState = useCallback((): Promise<WorkspaceDataState> => loadWorkspaceData({
    authStatus: auth.state.status,
    userId: auth.state.user?.id ?? null,
    now,
    repository: bogunonWorkspaceRepository,
    filters,
  }), [auth.state.status, auth.state.user?.id, filters, now]);

  const setTaskCompleted = useCallback(async (taskId: string, completed: boolean): Promise<TaskCompletionOutcome> => {
    const snapshot = state;
    let outcome: TaskCompletionOutcome = "ignored";
    const started = await mutationGuard.current.run(async () => {
      setPendingTaskId(taskId);
      setTaskMutationError(null);
      setTaskActionStateError(null);
      outcome = await runTaskCompletion({
        authStatus: auth.state.status,
        userId: auth.state.user?.id ?? null,
        state: snapshot,
        taskId,
        completed,
        repository: taskCompletionRepository,
        refresh: loadCurrentState,
        publish: setState,
      });
      if (outcome === "error") setTaskMutationError("완료 상태를 저장하지 못했습니다.");
      setPendingTaskId(null);
    });
    return started ? outcome : "ignored";
  }, [auth.state.status, auth.state.user?.id, loadCurrentState, state]);

  const setTaskActionState = useCallback(async (input: TaskActionStateInput): Promise<TaskActionStateOutcome> => {
    const snapshot = state;
    let outcome: TaskActionStateOutcome = "ignored";
    const started = await mutationGuard.current.run(async () => {
      setPendingTaskId(input.taskId);
      setTaskMutationError(null);
      setTaskActionStateError(null);
      outcome = await runTaskActionState({
        authStatus: auth.state.status,
        userId: auth.state.user?.id ?? null,
        state: snapshot,
        input,
        repository: taskActionStateRepository,
        refresh: loadCurrentState,
        publish: setState,
      });
      setTaskActionStateError(taskActionStatePanelErrorMessage(outcome));
      setPendingTaskId(null);
    });
    return started ? outcome : "ignored";
  }, [auth.state.status, auth.state.user?.id, loadCurrentState, state]);

  const value = useMemo<WorkspaceDataContextValue>(() => ({
    state,
    refresh: () => setRefreshSequence((current) => current + 1),
    setTaskCompleted,
    setTaskActionState,
    pendingTaskId,
    taskMutationError,
    taskActionStateError,
  }), [state, setTaskCompleted, setTaskActionState, pendingTaskId, taskMutationError, taskActionStateError]);

  return <WorkspaceDataContext.Provider value={value}>{children}</WorkspaceDataContext.Provider>;
}

export const useWorkspaceData = (): WorkspaceDataContextValue => {
  const value = useContext(WorkspaceDataContext);
  if (value === null) throw new Error("WorkspaceDataProvider가 필요합니다.");
  return value;
};
