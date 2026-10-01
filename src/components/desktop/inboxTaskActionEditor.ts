import type {
  BogunonNonCompletedTaskStatus,
  TaskActionStateInput,
  WorkspaceInboxItem,
} from "../../workspace-data/types";
import type { TaskActionStateOutcome } from "../../workspace-data/taskActionStateService";

export const inboxTaskActionStatusOptions: readonly {
  readonly value: BogunonNonCompletedTaskStatus;
  readonly label: string;
}[] = [
  { value: "planned", label: "예정" },
  { value: "inProgress", label: "진행 중" },
  { value: "waitingForReply", label: "회신 대기" },
  { value: "needsCheck", label: "확인 필요" },
  { value: "onHold", label: "보류" },
];

export type InboxTaskActionDraft = {
  readonly status: BogunonNonCompletedTaskStatus;
  readonly followUpDate: string;
};

export type ActiveInboxTaskActionEditor = {
  readonly item: WorkspaceInboxItem;
  readonly draft: InboxTaskActionDraft;
  readonly error: string | null;
};

export const parseInboxTaskActionStatus = (value: string): BogunonNonCompletedTaskStatus | null => (
  inboxTaskActionStatusOptions.find((option) => option.value === value)?.value ?? null
);

export const createInboxTaskActionDraft = (item: WorkspaceInboxItem): InboxTaskActionDraft => ({
  status: item.status,
  followUpDate: item.followUpDate ?? "",
});

export const setInboxTaskActionStatus = (
  draft: InboxTaskActionDraft,
  status: BogunonNonCompletedTaskStatus,
): InboxTaskActionDraft => ({ ...draft, status });

export const setInboxTaskActionFollowUpDate = (
  draft: InboxTaskActionDraft,
  followUpDate: string,
): InboxTaskActionDraft => ({ ...draft, followUpDate });

export const createTaskActionStateInput = (
  item: WorkspaceInboxItem,
  draft: InboxTaskActionDraft,
): TaskActionStateInput => ({
  taskId: item.id,
  status: draft.status,
  followUpDate: draft.followUpDate === "" ? null : draft.followUpDate,
  expectedUpdatedAt: item.updatedAt,
});

export const resolveInboxTaskActionSave = (
  current: ActiveInboxTaskActionEditor,
  outcome: TaskActionStateOutcome,
): ActiveInboxTaskActionEditor | null => {
  if (outcome === "success" || outcome === "conflict") return null;
  if (outcome === "error") return {
    ...current,
    error: "업무 상태를 저장하지 못했습니다. 다시 시도해 주세요.",
  };
  return current;
};

export const inboxEscapeTarget = (hasActionEditor: boolean): "actionEditor" | "panel" => (
  hasActionEditor ? "actionEditor" : "panel"
);
