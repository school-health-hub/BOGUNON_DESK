import type { TaskCompletionOutcome } from "../../workspace-data/taskCompletionService";
import type { WorkspaceInboxItem } from "../../workspace-data/types";

export const INBOX_UNDO_TIMEOUT_MS = 7_000;

export type InboxUndoState =
  | { readonly status: "idle" }
  | { readonly status: "available"; readonly item: WorkspaceInboxItem; readonly error: string | null }
  | { readonly status: "pending"; readonly item: WorkspaceInboxItem };

export type InboxUndoStart = {
  readonly state: InboxUndoState;
  readonly shouldRun: boolean;
};

export const createInboxUndoState = (): InboxUndoState => ({ status: "idle" });

export const completeInboxUndo = (
  state: InboxUndoState,
  item: WorkspaceInboxItem,
  outcome: TaskCompletionOutcome,
): InboxUndoState => outcome === "success" ? { status: "available", item, error: null } : state;

export const beginInboxUndo = (state: InboxUndoState): InboxUndoStart => state.status === "available"
  ? { state: { status: "pending", item: state.item }, shouldRun: true }
  : { state, shouldRun: false };

export const resolveInboxUndo = (
  state: InboxUndoState,
  outcome: TaskCompletionOutcome,
): InboxUndoState => {
  if (state.status !== "pending") return state;
  if (outcome === "success") return createInboxUndoState();
  return {
    status: "available",
    item: state.item,
    error: "완료 처리를 되돌리지 못했습니다. 다시 시도해 주세요.",
  };
};

export const expireInboxUndo = (state: InboxUndoState, taskId: string): InboxUndoState => (
  state.status === "available" && state.item.id === taskId ? createInboxUndoState() : state
);

export const scheduleInboxUndoExpiry = (onExpire: () => void): (() => void) => {
  const timer = globalThis.setTimeout(onExpire, INBOX_UNDO_TIMEOUT_MS);
  return () => globalThis.clearTimeout(timer);
};
