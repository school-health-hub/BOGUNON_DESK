import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createBogunonWorkspaceRepository,
  EVENT_SELECT_COLUMNS,
  TASK_SELECT_COLUMNS,
} from "./bogunonWorkspaceRepository";
import type { WorkspaceDateRange } from "./types";

type QueryResult = { readonly data: readonly unknown[]; readonly error: null };
type Operation = { readonly table: string; readonly method: string; readonly args: readonly unknown[] };

interface FakeQuery extends PromiseLike<QueryResult> {
  select(...args: readonly unknown[]): FakeQuery;
  eq(...args: readonly unknown[]): FakeQuery;
  or(...args: readonly unknown[]): FakeQuery;
  lte(...args: readonly unknown[]): FakeQuery;
  gte(...args: readonly unknown[]): FakeQuery;
  order(...args: readonly unknown[]): FakeQuery;
  limit(...args: readonly unknown[]): FakeQuery;
  in(...args: readonly unknown[]): FakeQuery;
  not(...args: readonly unknown[]): FakeQuery;
}

const createFakeQuery = (table: string, operations: Operation[], data: readonly unknown[] = []): FakeQuery => {
  const record = (method: string, args: readonly unknown[]): FakeQuery => {
    operations.push({ table, method, args });
    return query;
  };
  const query: FakeQuery = {
    select: (...args) => record("select", args),
    eq: (...args) => record("eq", args),
    or: (...args) => record("or", args),
    lte: (...args) => record("lte", args),
    gte: (...args) => record("gte", args),
    order: (...args) => record("order", args),
    limit: (...args) => record("limit", args),
    in: (...args) => record("in", args),
    not: (...args) => record("not", args),
    then: (onfulfilled, onrejected) => Promise.resolve({ data, error: null }).then(onfulfilled, onrejected),
  };
  return query;
};

describe("BOGUNON workspace select boundary", () => {
  it("selects only the task fields required by the Desk home", () => {
    expect(TASK_SELECT_COLUMNS.split(",")).toEqual([
      "id", "title", "area", "status", "priority", "scheduled_date", "due_date",
      "follow_up_date", "completed_at", "category", "updated_at",
    ]);
    expect(TASK_SELECT_COLUMNS).not.toMatch(/memo|description/);
  });

  it("selects only the event fields required by the Desk home", () => {
    expect(EVENT_SELECT_COLUMNS.split(",")).toEqual([
      "id", "title", "area", "start_date", "end_date", "is_all_day",
      "start_time", "end_time", "color_key",
    ]);
    expect(EVENT_SELECT_COLUMNS).not.toMatch(/memo|description|event_details/);
  });

  it("queries only the signed-in user's tasks and events", async () => {
    const operations: Operation[] = [];
    const from = vi.fn((table: string) => createFakeQuery(table, operations));
    const client = { from } as unknown as Pick<SupabaseClient, "from">;
    const repository = createBogunonWorkspaceRepository(client);
    const range: WorkspaceDateRange = {
      today: "2026-09-23",
      weekStart: "2026-09-21",
      weekEnd: "2026-09-27",
      monthStart: "2026-09-01",
      monthEnd: "2026-09-30",
    };

    await repository.load("user-1", range, ["healthWork", "schoolSchedule"]);

    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "tasks", "events", "events", "tasks", "tasks", "tasks", "events",
      "tasks", "tasks", "tasks",
    ]);
    expect(operations.filter(({ method, args }) => method === "eq" && args[0] === "user_id")).toEqual([
      { table: "tasks", method: "eq", args: ["user_id", "user-1"] },
      { table: "events", method: "eq", args: ["user_id", "user-1"] },
      { table: "events", method: "eq", args: ["user_id", "user-1"] },
      { table: "tasks", method: "eq", args: ["user_id", "user-1"] },
      { table: "tasks", method: "eq", args: ["user_id", "user-1"] },
      { table: "tasks", method: "eq", args: ["user_id", "user-1"] },
      { table: "events", method: "eq", args: ["user_id", "user-1"] },
      { table: "tasks", method: "eq", args: ["user_id", "user-1"] },
      { table: "tasks", method: "eq", args: ["user_id", "user-1"] },
      { table: "tasks", method: "eq", args: ["user_id", "user-1"] },
    ]);
    expect(operations.filter(({ method, args }) => method === "eq" && args[0] === "priority")).toEqual([
      { table: "tasks", method: "eq", args: ["priority", "high"] },
      { table: "tasks", method: "eq", args: ["priority", "normal"] },
      { table: "tasks", method: "eq", args: ["priority", "low"] },
    ]);
    expect(operations.filter(({ method, args }) => method === "in" && args[0] === "area")).toEqual([
      { table: "tasks", method: "in", args: ["area", ["healthWork", "schoolSchedule"]] },
      { table: "events", method: "in", args: ["area", ["healthWork", "schoolSchedule"]] },
      { table: "events", method: "in", args: ["area", ["healthWork", "schoolSchedule"]] },
      { table: "tasks", method: "in", args: ["area", ["healthWork", "schoolSchedule"]] },
      { table: "tasks", method: "in", args: ["area", ["healthWork", "schoolSchedule"]] },
      { table: "tasks", method: "in", args: ["area", ["healthWork", "schoolSchedule"]] },
      { table: "events", method: "in", args: ["area", ["healthWork", "schoolSchedule"]] },
      { table: "tasks", method: "in", args: ["area", ["healthWork", "schoolSchedule"]] },
      { table: "tasks", method: "in", args: ["area", ["healthWork", "schoolSchedule"]] },
      { table: "tasks", method: "in", args: ["area", ["healthWork", "schoolSchedule"]] },
    ]);
    expect(operations.filter(({ method, args }) => method === "gte" && args[0] === "due_date")).toEqual([
      { table: "tasks", method: "gte", args: ["due_date", "2026-09-23"] },
      { table: "tasks", method: "gte", args: ["due_date", "2026-09-23"] },
      { table: "tasks", method: "gte", args: ["due_date", "2026-09-23"] },
    ]);
    expect(operations.filter(({ method }) => method === "gte")).toContainEqual(
      { table: "events", method: "gte", args: ["start_date", "2026-09-23"] },
    );
    expect(operations.filter(({ method }) => method === "not")).toEqual([
      { table: "tasks", method: "not", args: ["status", "in", "(completed,onHold)"] },
      { table: "tasks", method: "not", args: ["status", "in", "(completed,onHold)"] },
      { table: "tasks", method: "not", args: ["status", "in", "(completed,onHold)"] },
      { table: "tasks", method: "not", args: ["status", "in", "(completed,onHold)"] },
      { table: "tasks", method: "not", args: ["status", "in", "(completed,onHold)"] },
    ]);
    expect(operations.filter(({ method }) => method === "limit")).toEqual([
      { table: "events", method: "limit", args: [5] },
      { table: "tasks", method: "limit", args: [4] },
      { table: "tasks", method: "limit", args: [4] },
      { table: "tasks", method: "limit", args: [4] },
      { table: "events", method: "limit", args: [4] },
    ]);
    expect(operations.filter(({ method }) => method === "order")).toEqual([
      { table: "events", method: "order", args: ["start_date"] },
      { table: "events", method: "order", args: ["start_date"] },
      { table: "tasks", method: "order", args: ["due_date"] },
      { table: "tasks", method: "order", args: ["title"] },
      { table: "tasks", method: "order", args: ["due_date"] },
      { table: "tasks", method: "order", args: ["title"] },
      { table: "tasks", method: "order", args: ["due_date"] },
      { table: "tasks", method: "order", args: ["title"] },
      { table: "events", method: "order", args: ["start_date"] },
      { table: "events", method: "order", args: ["title"] },
      { table: "tasks", method: "order", args: ["due_date", { ascending: false }] },
      { table: "tasks", method: "order", args: ["follow_up_date", { ascending: false }] },
    ]);
  });

  it("queries task attention signals without expanding the select boundary", async () => {
    const operations: Operation[] = [];
    const client = { from: (table: string) => createFakeQuery(table, operations) } as unknown as Pick<SupabaseClient, "from">;
    const repository = createBogunonWorkspaceRepository(client);
    const range: WorkspaceDateRange = {
      today: "2026-09-23",
      weekStart: "2026-09-21",
      weekEnd: "2026-09-27",
      monthStart: "2026-09-01",
      monthEnd: "2026-09-30",
    };

    await repository.load("user-1", range, ["healthWork", "schoolSchedule"]);

    expect(operations).toContainEqual({
      table: "tasks",
      method: "in",
      args: ["status", ["needsCheck", "waitingForReply"]],
    });
    expect(operations).toContainEqual({ table: "tasks", method: "lte", args: ["due_date", "2026-09-23"] });
    expect(operations).toContainEqual({ table: "tasks", method: "lte", args: ["follow_up_date", "2026-09-23"] });
    expect(operations.filter(({ table, method, args }) => (
      table === "tasks" && method === "select" && args[0] === TASK_SELECT_COLUMNS
    ))).toHaveLength(7);
    expect(operations.filter(({ table, method }) => table === "tasks" && method === "limit")).toHaveLength(3);
  });

  it("deduplicates notification query rows by task id", async () => {
    const operations: Operation[] = [];
    const attentionTask = {
      id: "attention", title: "확인 업무", area: "healthWork", status: "needsCheck", priority: "normal",
      scheduled_date: null, due_date: null, follow_up_date: null, completed_at: null, category: "other",
    } as const;
    const overdueTask = {
      ...attentionTask, id: "overdue", title: "지난 업무", status: "planned", due_date: "2026-09-22",
    } as const;
    const followUpTask = {
      ...attentionTask, id: "follow-up", title: "후속 업무", status: "planned", follow_up_date: "2026-09-22",
    } as const;
    const responses: readonly (readonly unknown[])[] = [
      [], [], [], [], [], [], [],
      [attentionTask],
      [attentionTask, overdueTask],
      [overdueTask, followUpTask],
    ];
    let queryIndex = 0;
    const client = {
      from: (table: string) => createFakeQuery(table, operations, responses[queryIndex++] ?? []),
    } as unknown as Pick<SupabaseClient, "from">;
    const repository = createBogunonWorkspaceRepository(client);

    const result = await repository.load("user-1", {
      today: "2026-09-23",
      weekStart: "2026-09-21",
      weekEnd: "2026-09-27",
      monthStart: "2026-09-01",
      monthEnd: "2026-09-30",
    }, ["healthWork"]);

    expect(result.notificationTasks.map(({ id }) => id)).toEqual(["attention", "overdue", "follow-up"]);
  });

  it("does not query when every area is disabled", async () => {
    const from = vi.fn();
    const client = { from } as unknown as Pick<SupabaseClient, "from">;
    const repository = createBogunonWorkspaceRepository(client);
    const range: WorkspaceDateRange = {
      today: "2026-09-23",
      weekStart: "2026-09-21",
      weekEnd: "2026-09-27",
      monthStart: "2026-09-01",
      monthEnd: "2026-09-30",
    };
    await expect(repository.load("user-1", range, [])).resolves.toEqual({
      tasks: [], events: [], ddayTasks: [], ddayEvents: [], notificationTasks: [],
    });
    expect(from).not.toHaveBeenCalled();
  });
});
