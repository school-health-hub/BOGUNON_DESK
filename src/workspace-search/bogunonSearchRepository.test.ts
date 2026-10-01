import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  createBogunonSearchRepository,
  escapeLikePattern,
  EVENT_SEARCH_COLUMNS,
  TASK_SEARCH_COLUMNS,
} from "./bogunonSearchRepository";

type QueryResult = { readonly data: readonly unknown[]; readonly error: null };
type Operation = { readonly table: string; readonly method: string; readonly args: readonly unknown[] };

interface FakeQuery extends PromiseLike<QueryResult> {
  select(...args: readonly unknown[]): FakeQuery;
  eq(...args: readonly unknown[]): FakeQuery;
  in(...args: readonly unknown[]): FakeQuery;
  ilike(...args: readonly unknown[]): FakeQuery;
  order(...args: readonly unknown[]): FakeQuery;
  limit(...args: readonly unknown[]): FakeQuery;
}

const createFakeQuery = (table: string, operations: Operation[]): FakeQuery => {
  const record = (method: string, args: readonly unknown[]): FakeQuery => {
    operations.push({ table, method, args });
    return query;
  };
  const query: FakeQuery = {
    select: (...args) => record("select", args),
    eq: (...args) => record("eq", args),
    in: (...args) => record("in", args),
    ilike: (...args) => record("ilike", args),
    order: (...args) => record("order", args),
    limit: (...args) => record("limit", args),
    then: (onfulfilled, onrejected) => Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected),
  };
  return query;
};

describe("BOGUNON search repository", () => {
  it("selects only title search fields and scopes both tables to owner and enabled areas", async () => {
    const operations: Operation[] = [];
    const from = vi.fn((table: string) => createFakeQuery(table, operations));
    const repository = createBogunonSearchRepository({ from } as unknown as Pick<SupabaseClient, "from">);

    await repository.search("user-1", "결핵", ["healthWork", "schoolSchedule"]);

    expect(TASK_SEARCH_COLUMNS.split(",")).toEqual([
      "id", "title", "area", "status", "priority", "scheduled_date", "due_date", "follow_up_date",
    ]);
    expect(EVENT_SEARCH_COLUMNS.split(",")).toEqual([
      "id", "title", "area", "start_date", "end_date", "is_all_day", "start_time", "end_time",
    ]);
    expect(`${TASK_SEARCH_COLUMNS},${EVENT_SEARCH_COLUMNS}`).not.toMatch(/memo|description|event_details|completed_at|category/);
    expect(operations.filter(({ method }) => method === "eq")).toEqual([
      { table: "tasks", method: "eq", args: ["user_id", "user-1"] },
      { table: "events", method: "eq", args: ["user_id", "user-1"] },
    ]);
    expect(operations.filter(({ method }) => method === "in")).toEqual([
      { table: "tasks", method: "in", args: ["area", ["healthWork", "schoolSchedule"]] },
      { table: "events", method: "in", args: ["area", ["healthWork", "schoolSchedule"]] },
    ]);
    expect(operations.filter(({ method }) => method === "limit")).toEqual([
      { table: "tasks", method: "limit", args: [6] },
      { table: "events", method: "limit", args: [6] },
    ]);
    expect(operations.some(({ method, args }) => method === "in" && args[0] === "status")).toBe(false);
  });

  it("escapes SQL LIKE wildcards before wrapping the literal query", async () => {
    const operations: Operation[] = [];
    const repository = createBogunonSearchRepository({
      from: (table: string) => createFakeQuery(table, operations),
    } as unknown as Pick<SupabaseClient, "from">);

    expect(escapeLikePattern(String.raw`50%_done\next`)).toBe(String.raw`50\%\_done\\next`);
    await repository.search("user-1", "50%_", ["healthWork"]);

    expect(operations.filter(({ method }) => method === "ilike")).toEqual([
      { table: "tasks", method: "ilike", args: ["title", String.raw`%50\%\_%`] },
      { table: "events", method: "ilike", args: ["title", String.raw`%50\%\_%`] },
    ]);
  });
});
