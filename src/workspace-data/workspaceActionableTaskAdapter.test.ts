import { describe, expect, it } from "vitest";
import { adaptWorkspaceActionableTasks } from "./workspaceActionableTaskAdapter";
import type { BogunonTaskRow } from "./types";

const task = (values: Partial<BogunonTaskRow> & Pick<BogunonTaskRow, "id" | "title">): BogunonTaskRow => ({
  area: "healthWork", status: "planned", priority: "normal", scheduled_date: null, due_date: null,
  follow_up_date: null, completed_at: null, category: "other", updated_at: "2026-10-01T09:00:00.000Z", ...values,
});

describe("workspace actionable task adapter", () => {
  const now = new Date(2026, 8, 23, 9);
  const areas = ["healthWork", "schoolSchedule"] as const;

  it("classifies, deduplicates, and sorts every actionable reason", () => {
    const duplicate = task({ id: "mixed", title: "복합", status: "needsCheck", due_date: "2026-09-22" });
    const items = adaptWorkspaceActionableTasks([
      task({ id: "waiting", title: "회신", status: "waitingForReply" }),
      task({ id: "needs", title: "확인", status: "needsCheck" }),
      task({ id: "follow", title: "후속", follow_up_date: "2026-09-22" }),
      task({ id: "today", title: "오늘", due_date: "2026-09-23" }),
      duplicate, duplicate,
    ], now, areas);

    expect(items.map(({ id, reason }) => [id, reason])).toEqual([
      ["mixed", "overdue"], ["today", "dueToday"], ["follow", "followUp"], ["needs", "needsCheck"], ["waiting", "waitingForReply"],
    ]);
    expect(items.find(({ id }) => id === "follow")).toMatchObject({
      followUpDate: "2026-09-22",
      updatedAt: "2026-10-01T09:00:00.000Z",
    });
  });

  it("excludes inactive, disabled-area, and non-actionable tasks", () => {
    expect(adaptWorkspaceActionableTasks([
      task({ id: "completed", title: "완료", status: "completed", due_date: "2026-09-20" }),
      task({ id: "hold", title: "보류", status: "onHold", due_date: "2026-09-20" }),
      task({ id: "personal", title: "개인", area: "personal", status: "needsCheck" }),
      task({ id: "future", title: "미래", due_date: "2026-09-24" }),
    ], now, areas)).toEqual([]);
  });

  it("sorts equal reasons by priority, relevant date, and title", () => {
    const items = adaptWorkspaceActionableTasks([
      task({ id: "low", title: "낮음", priority: "low", due_date: "2026-09-20" }),
      task({ id: "later", title: "나중", priority: "high", due_date: "2026-09-22" }),
      task({ id: "earlier-b", title: "나", priority: "high", due_date: "2026-09-21" }),
      task({ id: "earlier-a", title: "가", priority: "high", due_date: "2026-09-21" }),
    ], now, areas);
    expect(items.map(({ id }) => id)).toEqual(["earlier-a", "earlier-b", "later", "low"]);
  });
});
