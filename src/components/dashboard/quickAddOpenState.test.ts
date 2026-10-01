import { describe, expect, it } from "vitest";
import { createQuickAddOpenState } from "./quickAddOpenState";

describe("createQuickAddOpenState", () => {
  const today = "2026-09-22";

  it("opens a normal Quick Add with today's empty task", () => {
    expect(createQuickAddOpenState(today)).toEqual({
      initialDate: today,
      initialKind: "task",
      initialTaskTitle: "",
      initialTaskArea: "healthWork",
      initialTaskCategory: "other",
      initialTaskPriority: "normal",
      initialTaskDueDate: "",
    });
  });

  it("keeps the memo handoff as a task for today", () => {
    expect(createQuickAddOpenState(today, { initialTaskTitle: "결핵검진 공문 확인" })).toEqual({
      initialDate: today,
      initialKind: "task",
      initialTaskTitle: "결핵검진 공문 확인",
      initialTaskArea: "healthWork",
      initialTaskCategory: "other",
      initialTaskPriority: "normal",
      initialTaskDueDate: "",
    });
  });

  it("opens a calendar handoff as an empty event on the selected date", () => {
    expect(createQuickAddOpenState(today, {
      initialDate: "2026-09-30",
      initialKind: "event",
    })).toEqual({
      initialDate: "2026-09-30",
      initialKind: "event",
      initialTaskTitle: "",
      initialTaskArea: "healthWork",
      initialTaskCategory: "other",
      initialTaskPriority: "normal",
      initialTaskDueDate: "",
    });
  });

  it("keeps today's scheduled date and prefills only the official-document due date", () => {
    expect(createQuickAddOpenState(today, {
      initialKind: "task",
      initialTaskTitle: "참석자 명단 제출",
      initialTaskArea: "healthWork",
      initialTaskCategory: "officialDocument",
      initialTaskPriority: "normal",
      initialTaskDueDate: "2026-09-30",
    })).toEqual({
      initialDate: today,
      initialKind: "task",
      initialTaskTitle: "참석자 명단 제출",
      initialTaskArea: "healthWork",
      initialTaskCategory: "officialDocument",
      initialTaskPriority: "normal",
      initialTaskDueDate: "2026-09-30",
    });
  });
});
