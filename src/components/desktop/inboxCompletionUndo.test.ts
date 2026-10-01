import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INBOX_UNDO_TIMEOUT_MS,
  beginInboxUndo,
  completeInboxUndo,
  createInboxUndoState,
  expireInboxUndo,
  resolveInboxUndo,
  scheduleInboxUndoExpiry,
} from "./inboxCompletionUndo";
import type { WorkspaceInboxItem } from "../../workspace-data/types";

const item: WorkspaceInboxItem = {
  id: "task-1",
  title: "결핵검진 결과 정리",
  reason: "dueToday",
  detail: "오늘 마감",
  priority: "normal",
  status: "inProgress",
  followUpDate: null,
  updatedAt: "2026-10-01T09:00:00.000Z",
  relevantDate: "2026-10-01",
  area: "healthWork",
  completed: false,
  tone: "warning",
};

describe("Inbox completion undo", () => {
  afterEach(() => vi.useRealTimers());

  it("exposes the completed task only after a successful mutation", () => {
    const initial = createInboxUndoState();
    expect(completeInboxUndo(initial, item, "success")).toEqual({ status: "available", item, error: null });
    expect(completeInboxUndo(initial, item, "error")).toEqual(initial);
    expect(completeInboxUndo(initial, item, "ignored")).toEqual(initial);
  });

  it("starts one Undo mutation and blocks a duplicate while pending", () => {
    const available = completeInboxUndo(createInboxUndoState(), item, "success");
    const first = beginInboxUndo(available);
    expect(first.shouldRun).toBe(true);
    expect(first.state).toEqual({ status: "pending", item });
    expect(beginInboxUndo(first.state)).toEqual({ state: first.state, shouldRun: false });
  });

  it("clears a successful Undo and keeps a failed Undo retryable", () => {
    const pending = beginInboxUndo(completeInboxUndo(createInboxUndoState(), item, "success")).state;
    expect(resolveInboxUndo(pending, "success")).toEqual({ status: "idle" });
    expect(resolveInboxUndo(pending, "error")).toEqual({
      status: "available",
      item,
      error: "완료 처리를 되돌리지 못했습니다. 다시 시도해 주세요.",
    });
  });

  it("expires the Undo after the deterministic timeout", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const cancel = scheduleInboxUndoExpiry(onExpire);

    vi.advanceTimersByTime(INBOX_UNDO_TIMEOUT_MS - 1);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledOnce();
    cancel();
  });

  it("does not expire a newer completion from an older timeout", () => {
    const first = completeInboxUndo(createInboxUndoState(), item, "success");
    const secondItem = { ...item, id: "task-2", title: "응급약품 재고 확인" };
    const second = completeInboxUndo(first, secondItem, "success");
    expect(expireInboxUndo(second, item.id)).toEqual(second);
    expect(expireInboxUndo(second, secondItem.id)).toEqual({ status: "idle" });
  });
});
