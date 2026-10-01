import { describe, expect, it } from "vitest";
import { WorkItemCreateError, createWorkItemCreateRepository } from "./workItemCreateRepository";

type MutationResult = { readonly data: { readonly id: string } | null; readonly error: { readonly message: string } | null };
type Operation = { readonly method: string; readonly args: readonly unknown[] };

interface FakeMutation extends PromiseLike<MutationResult> {
  select(columns: string): FakeMutation;
  single(): FakeMutation;
}

const createClient = (operations: Operation[], result: MutationResult = { data: { id: "created-1" }, error: null }) => ({
  from: (table: string) => ({
    insert: (values: Readonly<Record<string, unknown>>): FakeMutation => {
      operations.push({ method: "from", args: [table] });
      operations.push({ method: "insert", args: [values] });
      const mutation: FakeMutation = {
        select: (columns) => {
          operations.push({ method: "select", args: [columns] });
          return mutation;
        },
        single: () => {
          operations.push({ method: "single", args: [] });
          return mutation;
        },
        then: (fulfilled, rejected) => Promise.resolve(result).then(fulfilled, rejected),
      };
      return mutation;
    },
  }),
});

type RepositoryClient = Parameters<typeof createWorkItemCreateRepository>[0];

describe("quick work item repository", () => {
  it("inserts only the quick task fields with the signed-in owner", async () => {
    const operations: Operation[] = [];
    const repository = createWorkItemCreateRepository(createClient(operations) as unknown as RepositoryClient);

    const id = await repository.createTask("user-1", {
      title: "결핵검진 안내",
      area: "healthWork",
      category: "other",
      priority: "normal",
      scheduledDate: "2026-09-22",
      dueDate: null,
    });

    expect(id).toBe("created-1");
    expect(operations).toEqual([
      { method: "from", args: ["tasks"] },
      { method: "insert", args: [{
        user_id: "user-1", title: "결핵검진 안내", area: "healthWork", status: "planned",
        priority: "normal", category: "other", scheduled_date: "2026-09-22",
        due_date: null, follow_up_date: null, completed_at: null,
      }] },
      { method: "select", args: ["id"] },
      { method: "single", args: [] },
    ]);
  });

  it("inserts an optional task due date without changing the scheduled date", async () => {
    const operations: Operation[] = [];
    const repository = createWorkItemCreateRepository(createClient(operations) as unknown as RepositoryClient);

    await repository.createTask("user-1", {
      title: "공문 제출", area: "healthWork", category: "officialDocument", priority: "normal",
      scheduledDate: "2026-09-25", dueDate: "2026-09-30",
    });

    expect(operations[1]).toEqual({ method: "insert", args: [{
      user_id: "user-1", title: "공문 제출", area: "healthWork", status: "planned",
      priority: "normal", category: "officialDocument", scheduled_date: "2026-09-25",
      due_date: "2026-09-30", follow_up_date: null, completed_at: null,
    }] });
  });

  it("inserts only a single all-day event with the signed-in owner", async () => {
    const operations: Operation[] = [];
    const repository = createWorkItemCreateRepository(createClient(operations) as unknown as RepositoryClient);

    await repository.createEvent("user-1", {
      title: "보건교육",
      area: "schoolSchedule",
      date: "2026-09-22",
    });

    expect(operations[1]).toEqual({ method: "insert", args: [{
      user_id: "user-1", title: "보건교육", area: "schoolSchedule",
      start_date: "2026-09-22", end_date: "2026-09-22", is_all_day: true,
      start_time: null, end_time: null,
    }] });
  });

  it("throws a typed error when the insert or id verification fails", async () => {
    const repository = createWorkItemCreateRepository(createClient([], {
      data: null,
      error: { message: "private database detail" },
    }) as unknown as RepositoryClient);

    await expect(repository.createTask("user-1", {
      title: "업무", area: "healthWork", category: "other", priority: "normal", scheduledDate: "2026-09-22", dueDate: null,
    })).rejects.toBeInstanceOf(WorkItemCreateError);
  });
});
