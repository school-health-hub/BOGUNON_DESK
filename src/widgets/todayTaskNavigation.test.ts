import { describe, expect, it, vi } from "vitest";
import { openTodayTask } from "./todayTaskNavigation";

describe("today task navigation", () => {
  it("opens a task with the current local calendar date", async () => {
    const openBogunonTask = vi.fn(async () => undefined);
    await openTodayTask(openBogunonTask, "task-1", new Date(2026, 8, 23, 23, 30));
    expect(openBogunonTask).toHaveBeenCalledWith("task-1", "2026-09-23");
  });
});
