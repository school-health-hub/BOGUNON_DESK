import { describe, expect, it, vi } from "vitest";
import {
  QuickAddValidationError,
  createInitialEventInput,
  createInitialTaskInput,
  submitQuickWorkItem,
} from "./workItemCreateService";
import type { WorkItemCreateRepository } from "./workItemCreateTypes";

const repository = (): WorkItemCreateRepository => ({
  createTask: vi.fn().mockResolvedValue("task-1"),
  createEvent: vi.fn().mockResolvedValue("event-1"),
});

describe("quick work item service", () => {
  it("provides the requested task and event defaults for today", () => {
    expect(createInitialTaskInput("2026-09-22")).toEqual({
      kind: "task", title: "", date: "2026-09-22", dueDate: "", area: "healthWork", category: "other", priority: "normal",
    });
    expect(createInitialEventInput("2026-09-22")).toEqual({
      kind: "event", title: "", date: "2026-09-22", area: "schoolSchedule",
    });
  });

  it("trims a valid task and refreshes after creation", async () => {
    const target = repository();
    const refresh = vi.fn();
    const result = await submitQuickWorkItem({
      authStatus: "signedIn", userId: "user-1", repository: target, refresh,
      input: { ...createInitialTaskInput("2026-09-22"), title: "  안내문 확인  " },
    });
    expect(target.createTask).toHaveBeenCalledWith("user-1", {
      title: "안내문 확인", area: "healthWork", category: "other", priority: "normal", scheduledDate: "2026-09-22", dueDate: null,
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "success", kind: "task", id: "task-1" });
  });

  it("keeps a valid optional task due date without restricting its relation to the scheduled date", async () => {
    const target = repository();

    await submitQuickWorkItem({
      authStatus: "signedIn", userId: "user-1", repository: target, refresh: vi.fn(),
      input: { ...createInitialTaskInput("2026-10-02"), title: "제출 업무", dueDate: "2026-09-30" },
    });

    expect(target.createTask).toHaveBeenCalledWith("user-1", {
      title: "제출 업무", area: "healthWork", category: "other", priority: "normal", scheduledDate: "2026-10-02", dueDate: "2026-09-30",
    });
  });

  it("creates an event and refreshes after creation", async () => {
    const target = repository();
    const refresh = vi.fn();
    const result = await submitQuickWorkItem({
      authStatus: "signedIn", userId: "user-1", repository: target, refresh,
      input: { ...createInitialEventInput("2026-09-22"), title: " 교직원 연수 " },
    });
    expect(target.createEvent).toHaveBeenCalledWith("user-1", {
      title: "교직원 연수", area: "schoolSchedule", date: "2026-09-22",
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(result).toEqual({ status: "success", kind: "event", id: "event-1" });
  });

  it.each([
    ["empty title", { ...createInitialTaskInput("2026-09-22"), title: "   " }],
    ["long title", { ...createInitialTaskInput("2026-09-22"), title: "가".repeat(121) }],
    ["invalid area", { ...createInitialTaskInput("2026-09-22"), title: "업무", area: "project" }],
    ["invalid category", { ...createInitialTaskInput("2026-09-22"), title: "업무", category: "unknown" }],
    ["invalid priority", { ...createInitialTaskInput("2026-09-22"), title: "업무", priority: "urgent" }],
    ["invalid task date", { ...createInitialTaskInput("2026-09-22"), title: "업무", date: "2026-02-30" }],
    ["invalid task due date", { ...createInitialTaskInput("2026-09-22"), title: "업무", dueDate: "2026-02-30" }],
    ["invalid event area", { ...createInitialEventInput("2026-09-22"), title: "일정", area: "project" }],
    ["invalid event date", { ...createInitialEventInput("2026-09-22"), title: "일정", date: "not-a-date" }],
  ])("rejects %s", async (_name, input) => {
    await expect(submitQuickWorkItem({
      authStatus: "signedIn", userId: "user-1", repository: repository(), refresh: vi.fn(), input,
    })).rejects.toBeInstanceOf(QuickAddValidationError);
  });

  it("does not write or refresh while signed out", async () => {
    const target = repository();
    const refresh = vi.fn();
    const result = await submitQuickWorkItem({
      authStatus: "signedOut", userId: null, repository: target, refresh,
      input: { ...createInitialTaskInput("2026-09-22"), title: "업무" },
    });
    expect(result).toEqual({ status: "signedOut" });
    expect(target.createTask).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
