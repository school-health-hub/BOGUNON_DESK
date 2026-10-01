import { Inbox, ListChecks, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { TaskCompletionOutcome } from "../../workspace-data/taskCompletionService";
import type { TaskActionStateOutcome } from "../../workspace-data/taskActionStateService";
import type { BogunonNonCompletedTaskStatus, TaskActionStateInput, WorkspaceDataState, WorkspaceInboxItem, WorkspaceInboxReason } from "../../workspace-data/types";
import { WorkspaceDataNotice } from "../../workspace-data/WorkspaceDataNotice";
import { InboxTaskActionPopover } from "./InboxTaskActionPopover";
import {
  createInboxTaskActionDraft,
  createTaskActionStateInput,
  inboxEscapeTarget,
  resolveInboxTaskActionSave,
  setInboxTaskActionFollowUpDate,
  setInboxTaskActionStatus,
  type ActiveInboxTaskActionEditor,
} from "./inboxTaskActionEditor";
import {
  beginInboxUndo,
  completeInboxUndo,
  createInboxUndoState,
  expireInboxUndo,
  resolveInboxUndo,
  scheduleInboxUndoExpiry,
  type InboxUndoState,
} from "./inboxCompletionUndo";

export const inboxFilterIds = ["all", "deadline", "followUp", "attention"] as const;
export type InboxFilterId = (typeof inboxFilterIds)[number];

const filterLabels: Readonly<Record<InboxFilterId, string>> = {
  all: "전체",
  deadline: "기한",
  followUp: "후속 확인",
  attention: "확인·회신",
};

const reasonMatchesFilter = (reason: WorkspaceInboxReason, filter: InboxFilterId): boolean => {
  if (filter === "all") return true;
  if (filter === "deadline") return reason === "overdue" || reason === "dueToday";
  if (filter === "followUp") return reason === "followUp";
  return reason === "needsCheck" || reason === "waitingForReply";
};

const priorityLabel: Readonly<Record<WorkspaceInboxItem["priority"], string>> = { high: "높음", normal: "보통", low: "낮음" };

export const filterInboxItems = (items: readonly WorkspaceInboxItem[], filter: InboxFilterId): readonly WorkspaceInboxItem[] => (
  items.filter((item) => reasonMatchesFilter(item.reason, filter))
);

type InboxPanelProps = {
  readonly state: WorkspaceDataState;
  readonly pendingTaskId: string | null;
  readonly mutationError: string | null;
  readonly onClose: () => void;
  readonly onOpen: (taskId: string, date: string | null) => Promise<void> | void;
  readonly onSetCompleted: (taskId: string, completed: boolean) => Promise<TaskCompletionOutcome>;
  readonly onSetActionState: (input: TaskActionStateInput) => Promise<TaskActionStateOutcome>;
};

type InboxTaskRowProps = {
  readonly item: WorkspaceInboxItem;
  readonly isPending: boolean;
  readonly onOpen: InboxPanelProps["onOpen"];
  readonly onSetCompleted: (item: WorkspaceInboxItem, completed: boolean) => Promise<TaskCompletionOutcome>;
  readonly onOpenActions: (item: WorkspaceInboxItem) => void;
  readonly actionContent: ReactNode;
};

export function InboxTaskRow({ item, isPending, onOpen, onSetCompleted, onOpenActions, actionContent }: InboxTaskRowProps) {
  return (
    <li className={`is-${item.tone}`}>
      <button
        type="button"
        className="inbox-panel__check"
        aria-label={`${item.title} 완료`}
        disabled={isPending}
        onClick={() => onSetCompleted(item, true)}
      />
      <button
        type="button"
        className="inbox-panel__task"
        aria-label={`BOGUNON에서 ${item.title} 열기`}
        onClick={() => onOpen(item.id, item.relevantDate)}
      >
        <strong>{item.title}</strong>
        <span>{item.detail}{item.priority === "normal" ? "" : ` · ${priorityLabel[item.priority]}`}</span>
      </button>
      <button
        type="button"
        className="inbox-panel__actions"
        aria-label={`${item.title} 상태와 후속 확인일 편집`}
        aria-expanded={actionContent !== null}
        aria-haspopup="dialog"
        disabled={isPending}
        onClick={() => onOpenActions(item)}
      >
        <ListChecks size={15} />
      </button>
      {actionContent}
    </li>
  );
}

export function InboxUndoNotice({ state, onUndo }: {
  readonly state: InboxUndoState;
  readonly onUndo: () => void;
}) {
  if (state.status === "idle") return null;
  return (
    <section className="inbox-panel__undo" aria-live="polite">
      <div><strong>{state.item.title} 완료 처리됨</strong>{state.status === "available" && state.error !== null && <span role="alert">{state.error}</span>}</div>
      <button type="button" disabled={state.status === "pending"} onClick={onUndo}>{state.status === "pending" ? "되돌리는 중…" : "되돌리기"}</button>
    </section>
  );
}

export function InboxPanel({ state, pendingTaskId, mutationError, onClose, onOpen, onSetCompleted, onSetActionState }: InboxPanelProps) {
  const [filter, setFilter] = useState<InboxFilterId>("all");
  const [undoState, setUndoState] = useState<InboxUndoState>(createInboxUndoState);
  const [actionEditor, setActionEditor] = useState<ActiveInboxTaskActionEditor | null>(null);
  const hasActionEditor = actionEditor !== null;
  const items = useMemo(() => state.status === "ready"
    ? filterInboxItems(state.data.inboxItems, filter)
    : [], [filter, state]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (inboxEscapeTarget(hasActionEditor) === "actionEditor") setActionEditor(null);
      else onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasActionEditor, onClose]);

  const undoTaskId = undoState.status === "available" ? undoState.item.id : null;
  useEffect(() => {
    if (undoTaskId === null) return undefined;
    return scheduleInboxUndoExpiry(() => setUndoState((current) => expireInboxUndo(current, undoTaskId)));
  }, [undoTaskId]);

  const setCompleted = async (item: WorkspaceInboxItem, completed: boolean): Promise<TaskCompletionOutcome> => {
    const outcome = await onSetCompleted(item.id, completed);
    if (completed) setUndoState((current) => completeInboxUndo(current, item, outcome));
    return outcome;
  };

  const undoCompletion = async (): Promise<void> => {
    const start = beginInboxUndo(undoState);
    if (!start.shouldRun || start.state.status !== "pending") return;
    setUndoState(start.state);
    const outcome = await onSetCompleted(start.state.item.id, false);
    setUndoState((current) => resolveInboxUndo(current, outcome));
  };

  const openActionEditor = (item: WorkspaceInboxItem): void => {
    setActionEditor((current) => current?.item.id === item.id ? null : {
      item,
      draft: createInboxTaskActionDraft(item),
      error: null,
    });
  };

  const updateActionStatus = (status: BogunonNonCompletedTaskStatus): void => {
    setActionEditor((current) => current === null ? null : {
      ...current,
      draft: setInboxTaskActionStatus(current.draft, status),
      error: null,
    });
  };

  const updateActionFollowUpDate = (followUpDate: string): void => {
    setActionEditor((current) => current === null ? null : {
      ...current,
      draft: setInboxTaskActionFollowUpDate(current.draft, followUpDate),
      error: null,
    });
  };

  const saveActionState = async (): Promise<void> => {
    if (actionEditor === null || pendingTaskId !== null) return;
    const outcome = await onSetActionState(createTaskActionStateInput(actionEditor.item, actionEditor.draft));
    setActionEditor((current) => current === null ? null : resolveInboxTaskActionSave(current, outcome));
  };

  const total = state.status === "ready" ? state.data.inboxItems.length : 0;
  return (
    <aside className="inbox-panel" aria-label="미처리 업무">
      <header>
        <div className="inbox-panel__title-icon"><Inbox size={17} /></div>
        <div><strong>미처리 업무</strong><span>{state.status === "ready" ? `${total}건` : "BOGUNON 업무를 확인합니다."}</span></div>
        <button type="button" aria-label="미처리 업무 닫기" onClick={onClose}><X size={16} /></button>
      </header>
      {state.status === "ready" && (
        <div className="inbox-panel__filters" aria-label="미처리 업무 필터">
          {inboxFilterIds.map((id) => <button className={filter === id ? "is-active" : ""} type="button" key={id} onClick={() => setFilter(id)}>{filterLabels[id]}</button>)}
        </div>
      )}
      <div className="inbox-panel__body">
        {state.status !== "ready" ? <WorkspaceDataNotice state={state} /> : items.length === 0 ? (
          <p className="inbox-panel__empty">{total === 0 ? "지금 확인할 미처리 업무가 없습니다." : "이 분류에 해당하는 업무가 없습니다."}</p>
        ) : (
          <ul className="inbox-panel__list">
            {items.map((item) => {
              const isEditingItem = actionEditor?.item.id === item.id;
              return (
                <InboxTaskRow
                  key={item.id}
                  item={item}
                  isPending={pendingTaskId !== null}
                  onOpen={onOpen}
                  onOpenActions={openActionEditor}
                  onSetCompleted={setCompleted}
                  actionContent={isEditingItem && actionEditor !== null ? (
                    <InboxTaskActionPopover
                      item={item}
                      draft={actionEditor.draft}
                      error={actionEditor.error}
                      isSaving={pendingTaskId === item.id}
                      onStatusChange={updateActionStatus}
                      onFollowUpDateChange={updateActionFollowUpDate}
                      onClearFollowUpDate={() => updateActionFollowUpDate("")}
                      onSave={() => void saveActionState()}
                      onCancel={() => setActionEditor(null)}
                      onOpenDetail={() => {
                        setActionEditor(null);
                        void onOpen(item.id, item.relevantDate);
                      }}
                    />
                  ) : null}
                />
              );
            })}
          </ul>
        )}
        {mutationError !== null && <p className="inbox-panel__error" role="alert">{mutationError}</p>}
      </div>
      <InboxUndoNotice state={undoState} onUndo={() => void undoCompletion()} />
    </aside>
  );
}
