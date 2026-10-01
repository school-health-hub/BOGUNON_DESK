import { describe, expect, it, vi } from "vitest";
import {
  createTaskActionStateRepository,
  TaskActionStateConflictError,
  TaskActionStateError,
} from "./taskActionStateRepository";
import type { TaskActionStateInput, TaskActionStateResult } from "./types";

type Operation = { readonly method: string; readonly args: readonly unknown[] };
type RepositoryClient = Parameters<typeof createTaskActionStateRepository>[0];

const input: TaskActionStateInput = {
  taskId: "task-1",
  status: "waitingForReply",
  followUpDate: "2026-10-05",
  expectedUpdatedAt: "2026-10-01T09:00:00.000Z",
};

const result: TaskActionStateResult = {
  id: "task-1",
  status: "waitingForReply",
  last_non_completed_status: "waitingForReply",
  follow_up_date: "2026-10-05",
  completed_at: null,
  updated_at: "2026-10-01T09:01:00.000Z",
};

const createClient = (operations: Operation[], response: { readonly data: unknown; readonly error: { readonly message: string } | null }): RepositoryClient => {
  const single = vi.fn(async () => response);
  return {
    from: vi.fn(() => { throw new Error("tasks.update must not be used"); }),
    rpc: vi.fn((name: string, args: Readonly<Record<string, unknown>>) => {
      operations.push({ method: "rpc", args: [name, args] });
      return { single };
    }),
  } as unknown as RepositoryClient;
};

describe("task action state repository", () => {
  it("calls only the narrow RPC with the authoritative concurrency fields", async () => {
    const operations: Operation[] = [];
    const repository = createTaskActionStateRepository(createClient(operations, { data: result, error: null }));

    await expect(repository.setActionState("user-1", input)).resolves.toEqual(result);
    expect(operations).toEqual([{
      method: "rpc",
      args: ["set_task_action_state", {
        p_task_id: "task-1",
        p_status: "waitingForReply",
        p_follow_up_date: "2026-10-05",
        p_expected_updated_at: "2026-10-01T09:00:00.000Z",
      }],
    }]);
  });

  it("passes a null follow-up date for an explicit clear", async () => {
    const operations: Operation[] = [];
    const repository = createTaskActionStateRepository(createClient(operations, {
      data: { ...result, follow_up_date: null },
      error: null,
    }));

    await repository.setActionState("user-1", { ...input, followUpDate: null });
    expect(operations[0]?.args[1]).toMatchObject({ p_follow_up_date: null });
  });

  it("normalizes the stable conflict marker to a typed conflict error", async () => {
    const repository = createTaskActionStateRepository(createClient([], {
      data: null,
      error: { message: "TASK_ACTION_STATE_CONFLICT" },
    }));

    await expect(repository.setActionState("user-1", input)).rejects.toBeInstanceOf(TaskActionStateConflictError);
  });

  it.each([
    { data: null, error: { message: "network failed" } },
    { data: null, error: null },
    { data: { ...result, status: "completed" }, error: null },
  ])("preserves generic RPC and response failures as a typed generic error", async (response) => {
    const repository = createTaskActionStateRepository(createClient([], response));
    await expect(repository.setActionState("user-1", input)).rejects.toBeInstanceOf(TaskActionStateError);
  });
});
