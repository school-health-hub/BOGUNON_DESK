import { describe, expect, it, vi } from "vitest";
import { TaskActionStateConflictError } from "./taskActionStateRepository";
import {
  runTaskActionState,
  taskActionStateErrorMessage,
  taskActionStatePanelErrorMessage,
} from "./taskActionStateService";
import type {
  TaskActionStateInput,
  TaskActionStateRepository,
  TaskActionStateResult,
  WorkspaceDataState,
} from "./types";

const input: TaskActionStateInput = {
  taskId: "task-1",
  status: "needsCheck",
  followUpDate: "2026-10-07",
  expectedUpdatedAt: "2026-10-01T09:00:00.000Z",
};

const result: TaskActionStateResult = {
  id: "task-1",
  status: "needsCheck",
  last_non_completed_status: "needsCheck",
  follow_up_date: "2026-10-07",
  completed_at: null,
  updated_at: "2026-10-01T09:01:00.000Z",
};

const emptyReadyState: WorkspaceDataState = {
  status: "ready",
  data: {
    todayTasks: [], calendarEvents: [], weekSchedule: [], upcomingEvents: [], ddayItems: [], notifications: [], inboxItems: [],
    summary: { todayEventCount: 0, todayTaskCount: 0, incompleteTaskCount: 0 },
  },
};

describe("task action state mutation", () => {
  it("maps conflicts and generic failures to distinct user-facing messages", () => {
    expect(taskActionStateErrorMessage("conflict")).toBe("BOGUNON에서 변경된 업무입니다. 새로고침 후 다시 시도해 주세요.");
    expect(taskActionStateErrorMessage("error")).toBe("업무 상태를 저장하지 못했습니다. 다시 시도해 주세요.");
    expect(taskActionStateErrorMessage("success")).toBeNull();
  });

  it("keeps only stale conflicts as a panel-level error", () => {
    expect(taskActionStatePanelErrorMessage("conflict")).toBe("BOGUNON에서 변경된 업무입니다. 새로고침 후 다시 시도해 주세요.");
    expect(taskActionStatePanelErrorMessage("error")).toBeNull();
    expect(taskActionStatePanelErrorMessage("success")).toBeNull();
  });

  it("publishes the normal refreshed Workspace after a successful RPC", async () => {
    const repository: TaskActionStateRepository = { setActionState: vi.fn(async () => result) };
    const refreshed = { ...emptyReadyState };
    const publish = vi.fn();
    const refresh = vi.fn(async () => refreshed);

    await expect(runTaskActionState({
      authStatus: "signedIn", userId: "user-1", state: emptyReadyState, input, repository, refresh, publish,
    })).resolves.toBe("success");
    expect(repository.setActionState).toHaveBeenCalledWith("user-1", input);
    expect(refresh).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(refreshed);
  });

  it("refreshes stale Workspace data and reports a distinct conflict without a false success", async () => {
    const repository: TaskActionStateRepository = {
      setActionState: vi.fn(async () => { throw new TaskActionStateConflictError(); }),
    };
    const refreshed = { ...emptyReadyState };
    const publish = vi.fn();

    await expect(runTaskActionState({
      authStatus: "signedIn", userId: "user-1", state: emptyReadyState, input, repository,
      refresh: vi.fn(async () => refreshed), publish,
    })).resolves.toBe("conflict");
    expect(publish).toHaveBeenCalledWith(refreshed);
  });

  it("keeps generic failures distinct and does not publish stale success", async () => {
    const repository: TaskActionStateRepository = {
      setActionState: vi.fn(async () => { throw new Error("network"); }),
    };
    const publish = vi.fn();
    const refresh = vi.fn();

    await expect(runTaskActionState({
      authStatus: "signedIn", userId: "user-1", state: emptyReadyState, input, repository, refresh, publish,
    })).resolves.toBe("error");
    expect(refresh).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("does not mutate while signed out", async () => {
    const repository: TaskActionStateRepository = { setActionState: vi.fn() };
    await expect(runTaskActionState({
      authStatus: "signedOut", userId: null, state: { status: "signedOut" }, input, repository,
      refresh: vi.fn(), publish: vi.fn(),
    })).resolves.toBe("ignored");
    expect(repository.setActionState).not.toHaveBeenCalled();
  });
});
