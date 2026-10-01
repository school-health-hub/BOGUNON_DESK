import { describe, expect, it } from "vitest";
import {
  createInboxTaskActionDraft,
  createTaskActionStateInput,
  inboxEscapeTarget,
  inboxTaskActionStatusOptions,
  resolveInboxTaskActionSave,
  setInboxTaskActionFollowUpDate,
  setInboxTaskActionStatus,
} from "./inboxTaskActionEditor";
import type { WorkspaceInboxItem } from "../../workspace-data/types";

const item: WorkspaceInboxItem = {
  id: "task-1",
  title: "회신 확인",
  reason: "waitingForReply",
  detail: "회신 대기",
  priority: "normal",
  status: "waitingForReply",
  followUpDate: "2026-10-05",
  updatedAt: "2026-10-01T09:00:00.000Z",
  relevantDate: "2026-10-05",
  area: "healthWork",
  completed: false,
  tone: "info",
};

describe("Inbox task action editor", () => {
  it("offers only the five non-completed BOGUNON statuses", () => {
    expect(inboxTaskActionStatusOptions).toEqual([
      { value: "planned", label: "예정" },
      { value: "inProgress", label: "진행 중" },
      { value: "waitingForReply", label: "회신 대기" },
      { value: "needsCheck", label: "확인 필요" },
      { value: "onHold", label: "보류" },
    ]);
    expect(inboxTaskActionStatusOptions.map(({ value }) => value)).not.toContain("completed");
  });

  it("preserves follow-up date when only status changes", () => {
    const draft = setInboxTaskActionStatus(createInboxTaskActionDraft(item), "needsCheck");
    expect(createTaskActionStateInput(item, draft)).toEqual({
      taskId: "task-1",
      status: "needsCheck",
      followUpDate: "2026-10-05",
      expectedUpdatedAt: "2026-10-01T09:00:00.000Z",
    });
  });

  it("preserves status when only follow-up date changes", () => {
    const draft = setInboxTaskActionFollowUpDate(createInboxTaskActionDraft(item), "2026-10-08");
    expect(createTaskActionStateInput(item, draft)).toMatchObject({
      status: "waitingForReply",
      followUpDate: "2026-10-08",
    });
  });

  it("converts an explicit clear to null", () => {
    const draft = setInboxTaskActionFollowUpDate(createInboxTaskActionDraft(item), "");
    expect(createTaskActionStateInput(item, draft).followUpDate).toBeNull();
  });

  it("closes after success or conflict and keeps generic failures retryable", () => {
    const current = { item, draft: createInboxTaskActionDraft(item), error: null };
    expect(resolveInboxTaskActionSave(current, "success")).toBeNull();
    expect(resolveInboxTaskActionSave(current, "conflict")).toBeNull();
    expect(resolveInboxTaskActionSave(current, "error")).toMatchObject({
      item,
      error: "업무 상태를 저장하지 못했습니다. 다시 시도해 주세요.",
    });
    expect(resolveInboxTaskActionSave(current, "ignored")).toBe(current);
  });

  it("routes Escape to the popover before the containing Inbox panel", () => {
    expect(inboxEscapeTarget(true)).toBe("actionEditor");
    expect(inboxEscapeTarget(false)).toBe("panel");
  });
});
