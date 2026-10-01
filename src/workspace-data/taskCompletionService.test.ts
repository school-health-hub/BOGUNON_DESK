import { describe, expect, it, vi } from "vitest";
import { applyTaskCompletion, createTaskMutationGuard, runTaskCompletion } from "./taskCompletionService";
import type { BogunonTaskStatus, TaskCompletionRepository, TaskCompletionResult, WorkspaceData, WorkspaceDataState } from "./types";

const data: WorkspaceData = {
  todayTasks: [
    { id: "first", title: "첫 업무", completed: false, status: "inProgress", priority: "high", todayReason: "dueToday" },
    { id: "second", title: "다음 업무", completed: false, status: "waitingForReply", priority: "normal", todayReason: "scheduledToday" },
  ],
  calendarEvents: [],
  weekSchedule: [],
  upcomingEvents: [],
  ddayItems: [
    { id: "first", targetDate: "2026-09-24", title: "첫 업무", source: "task" },
  ],
  notifications: [
    { id: "first", title: "첫 업무", detail: "오늘 마감", relevantDate: "2026-09-23", tone: "warning" },
  ],
  inboxItems: [{
    id: "first", title: "첫 업무", reason: "dueToday", detail: "오늘 마감", priority: "high",
    status: "inProgress", followUpDate: null, updatedAt: "2026-10-01T09:00:00.000Z",
    relevantDate: "2026-09-23", area: "healthWork", completed: false, tone: "warning",
  }],
  summary: { todayEventCount: 0, todayTaskCount: 2, incompleteTaskCount: 2 },
};

describe("task completion mutation", () => {
  const completionResult = (id: string, status: BogunonTaskStatus): TaskCompletionResult => ({
    id,
    status,
    last_non_completed_status: status === "completed" ? "planned" : status,
    completed_at: status === "completed" ? "2026-09-28T12:00:00.000Z" : null,
    updated_at: "2026-09-28T12:00:00.000Z",
  });

  it("applies an authoritative completed status and recalculates the priority task", () => {
    const next = applyTaskCompletion(data, "first", "completed");
    expect(next.todayTasks.find((task) => task.id === "first")).toMatchObject({ completed: true, status: "completed" });
    expect(next.summary.incompleteTaskCount).toBe(1);
    expect(next.inboxItems).toEqual([]);
    expect(next.todayTasks.find((task) => !task.completed)?.id).toBe("second");
    expect(next.todayTasks.map((task) => task.id)).toEqual(["second", "first"]);
  });

  it.each(["planned", "inProgress", "waitingForReply", "needsCheck", "onHold"] as const)(
    "uses the authoritative %s status when undoing completion",
    (status) => {
      const completed = applyTaskCompletion(data, "second", "completed");
      expect(applyTaskCompletion(completed, "second", status).todayTasks.find((task) => task.id === "second")).toMatchObject({
        completed: false,
        status,
      });
    },
  );

  it("publishes the authoritative RPC state before the refreshed state", async () => {
    const repository: TaskCompletionRepository = { setCompleted: vi.fn(async () => completionResult("first", "completed")) };
    const refreshed: WorkspaceDataState = {
      status: "ready",
      data: { ...applyTaskCompletion(data, "first", "completed"), ddayItems: [], notifications: [] },
    };
    const publish = vi.fn();
    const result = await runTaskCompletion({
      authStatus: "signedIn", userId: "user-1", state: { status: "ready", data },
      taskId: "first", completed: true, repository, refresh: vi.fn(async () => refreshed), publish,
    });
    expect(result).toBe("success");
    expect(repository.setCompleted).toHaveBeenCalledWith("user-1", "first", true);
    expect(publish).toHaveBeenNthCalledWith(1, {
      status: "ready",
      data: applyTaskCompletion(data, "first", "completed"),
    });
    expect(publish).toHaveBeenLastCalledWith(refreshed);
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ddayItems: [], notifications: [] }),
    }));
  });

  it.each(["inProgress", "waitingForReply", "needsCheck", "onHold"] as const)(
    "does not publish planned while restoring %s",
    async (status) => {
      const completedData = applyTaskCompletion(data, "first", "completed");
      const previous: WorkspaceDataState = { status: "ready", data: completedData };
      const repository: TaskCompletionRepository = { setCompleted: vi.fn(async () => completionResult("first", status)) };
      const refreshed: WorkspaceDataState = { status: "ready", data: applyTaskCompletion(completedData, "first", status) };
      const publish = vi.fn<(state: WorkspaceDataState) => void>();

      await runTaskCompletion({
        authStatus: "signedIn", userId: "user-1", state: previous,
        taskId: "first", completed: false, repository, refresh: vi.fn(async () => refreshed), publish,
      });

      expect(publish).toHaveBeenNthCalledWith(1, {
        status: "ready",
        data: applyTaskCompletion(completedData, "first", status),
      });
      const publishedStatuses = publish.mock.calls.map(([publishedState]) => (
        publishedState.status === "ready"
          ? publishedState.data.todayTasks.find((task) => task.id === "first")?.status
          : null
      ));
      expect(publishedStatuses).not.toContain("planned");
    },
  );

  it("restores the previous UI state when the write fails", async () => {
    const previous: WorkspaceDataState = { status: "ready", data };
    const repository: TaskCompletionRepository = { setCompleted: vi.fn(async () => { throw new Error("network"); }) };
    const publish = vi.fn();
    const result = await runTaskCompletion({
      authStatus: "signedIn", userId: "user-1", state: previous,
      taskId: "first", completed: true, repository, refresh: vi.fn(), publish,
    });
    expect(result).toBe("error");
    expect(publish).not.toHaveBeenCalled();
  });

  it("does not mutate while signed out", async () => {
    const repository: TaskCompletionRepository = { setCompleted: vi.fn() };
    const result = await runTaskCompletion({
      authStatus: "signedOut", userId: null, state: { status: "signedOut" },
      taskId: "first", completed: true, repository, refresh: vi.fn(), publish: vi.fn(),
    });
    expect(result).toBe("ignored");
    expect(repository.setCompleted).not.toHaveBeenCalled();
  });

  it("prevents duplicate writes while one operation is pending", async () => {
    let release = (): void => undefined;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const operation = vi.fn(async () => waiting);
    const guard = createTaskMutationGuard();
    const first = guard.run(operation);
    await expect(guard.run(operation)).resolves.toBe(false);
    release();
    await expect(first).resolves.toBe(true);
    expect(operation).toHaveBeenCalledOnce();
  });
});
