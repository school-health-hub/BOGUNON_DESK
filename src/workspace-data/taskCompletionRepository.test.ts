import { describe, expect, it, vi } from "vitest";
import { createTaskCompletionRepository } from "./taskCompletionRepository";
import type { TaskCompletionResult } from "./types";

type Operation = { readonly method: string; readonly args: readonly unknown[] };

type RepositoryClient = Parameters<typeof createTaskCompletionRepository>[0];

const completionResult: TaskCompletionResult = {
  id: "task-1",
  status: "inProgress",
  last_non_completed_status: "inProgress",
  completed_at: null,
  updated_at: "2026-09-28T12:00:00.000Z",
};

const createClient = (operations: Operation[], result: { readonly data: TaskCompletionResult | null; readonly error: unknown }) => {
  const single = vi.fn(async () => result);
  return {
    from: vi.fn(() => { throw new Error("tasks.update must not be used"); }),
    rpc: vi.fn((name: string, args: Readonly<Record<string, unknown>>) => {
      operations.push({ method: "rpc", args: [name, args] });
      return { single };
    }),
  } as unknown as RepositoryClient;
};

describe("task completion repository", () => {
  it("uses the completion RPC and returns its authoritative completed state", async () => {
    const operations: Operation[] = [];
    const result = { ...completionResult, status: "completed" as const, completed_at: "2026-09-28T12:00:00.000Z" };
    const client = createClient(operations, { data: result, error: null });
    const repository = createTaskCompletionRepository(client);
    await expect(repository.setCompleted("user-1", "task-1", true)).resolves.toEqual(result);
    expect(operations).toEqual([
      { method: "rpc", args: ["set_task_completed", { p_task_id: "task-1", p_completed: true }] },
    ]);
  });

  it("passes false and returns the restored non-completed status", async () => {
    const operations: Operation[] = [];
    const repository = createTaskCompletionRepository(createClient(operations, { data: completionResult, error: null }));
    await expect(repository.setCompleted("user-1", "task-1", false)).resolves.toEqual(completionResult);
    expect(operations).toEqual([
      { method: "rpc", args: ["set_task_completed", { p_task_id: "task-1", p_completed: false }] },
    ]);
  });

  it.each([
    { data: null, error: null },
    { data: null, error: { message: "rpc failed" } },
  ])("throws TaskCompletionError for an invalid RPC result", async (result) => {
    const repository = createTaskCompletionRepository(createClient([], result));
    await expect(repository.setCompleted("user-1", "task-1", false)).rejects.toMatchObject({
      name: "TaskCompletionError",
      message: "완료 상태를 저장하지 못했습니다.",
    });
  });
});
