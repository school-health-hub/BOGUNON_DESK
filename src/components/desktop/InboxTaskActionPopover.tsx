import { CalendarDays, ExternalLink, X } from "lucide-react";
import type { FormEvent } from "react";
import type { BogunonNonCompletedTaskStatus, WorkspaceInboxItem } from "../../workspace-data/types";
import {
  inboxTaskActionStatusOptions,
  parseInboxTaskActionStatus,
  type InboxTaskActionDraft,
} from "./inboxTaskActionEditor";

type InboxTaskActionPopoverProps = {
  readonly item: WorkspaceInboxItem;
  readonly draft: InboxTaskActionDraft;
  readonly error: string | null;
  readonly isSaving: boolean;
  readonly onStatusChange: (status: BogunonNonCompletedTaskStatus) => void;
  readonly onFollowUpDateChange: (value: string) => void;
  readonly onClearFollowUpDate: () => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
  readonly onOpenDetail: () => void;
};

export function InboxTaskActionPopover({
  item,
  draft,
  error,
  isSaving,
  onStatusChange,
  onFollowUpDateChange,
  onClearFollowUpDate,
  onSave,
  onCancel,
  onOpenDetail,
}: InboxTaskActionPopoverProps) {
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSave();
  };

  return (
    <form
      className="inbox-task-action"
      aria-label={`${item.title} 상태 편집`}
      role="dialog"
      onSubmit={submit}
    >
      <header>
        <strong>업무 상태</strong>
        <button type="button" aria-label="업무 상태 편집 닫기" disabled={isSaving} onClick={onCancel}><X size={14} /></button>
      </header>
      <label>
        <span>현재 상태</span>
        <select
          aria-label="현재 상태"
          disabled={isSaving}
          value={draft.status}
          onChange={(event) => {
            const status = parseInboxTaskActionStatus(event.currentTarget.value);
            if (status !== null) onStatusChange(status);
          }}
        >
          {inboxTaskActionStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label>
        <span><CalendarDays size={13} /> 후속 확인일</span>
        <div className="inbox-task-action__date">
          <input
            aria-label="후속 확인일"
            disabled={isSaving}
            type="date"
            value={draft.followUpDate}
            onChange={(event) => onFollowUpDateChange(event.currentTarget.value)}
          />
          <button type="button" disabled={isSaving || draft.followUpDate === ""} onClick={onClearFollowUpDate}>지우기</button>
        </div>
      </label>
      {draft.status === "waitingForReply" && <p className="inbox-task-action__hint">후속 확인일을 함께 정하면 놓치지 않고 다시 확인할 수 있습니다.</p>}
      {error !== null && <p className="inbox-task-action__error" role="alert">{error}</p>}
      <footer>
        <button className="inbox-task-action__detail" type="button" disabled={isSaving} onClick={onOpenDetail}>
          BOGUNON에서 자세히 편집 <ExternalLink size={12} />
        </button>
        <div>
          <button type="button" disabled={isSaving} onClick={onCancel}>취소</button>
          <button className="is-primary" type="submit" disabled={isSaving}>{isSaving ? "저장 중…" : "저장"}</button>
        </div>
      </footer>
    </form>
  );
}
