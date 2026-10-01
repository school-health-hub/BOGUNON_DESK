import { describe, expect, it } from "vitest";
import { createWorkspaceNotificationSummary } from "./workspaceNotificationSummary";
import type { WorkspaceInboxItem } from "../workspace-data/types";
import { DEFAULT_WORKSPACE_NOTIFICATION_REASONS } from "./types";

const item = (reason: WorkspaceInboxItem["reason"], id: string = reason): WorkspaceInboxItem => ({
  id,
  title: `private-${id}`,
  reason,
  detail: "private detail",
  priority: "normal",
  status: reason === "needsCheck" ? "needsCheck" : "planned",
  followUpDate: null,
  updatedAt: "2026-10-01T09:00:00.000Z",
  relevantDate: "2026-09-22",
  area: "healthWork",
  completed: false,
  tone: reason === "needsCheck" || reason === "waitingForReply" ? "info" : "warning",
});

describe("workspace notification summary", () => {
  it("counts actionable reasons and excludes waiting-for-reply alone", () => {
    const summary = createWorkspaceNotificationSummary([
      item("overdue", "secret-task-1"),
      item("overdue", "secret-task-2"),
      item("dueToday"),
      item("followUp"),
      item("needsCheck"),
      item("waitingForReply"),
    ], DEFAULT_WORKSPACE_NOTIFICATION_REASONS);

    expect(summary).toEqual({
      title: "오늘 확인할 BOGUNON 업무",
      body: "마감 지남 2건 · 오늘 마감 1건 · 후속 확인 1건 · 확인 필요 1건 · BOGUNON DESK에서 확인하세요.",
      count: 5,
    });
    expect(summary?.body).not.toContain("private");
    expect(summary?.body).not.toContain("secret-task");
    expect(summary?.body).not.toContain("회신 대기");
  });

  it("returns null for an empty or waiting-only inbox", () => {
    expect(createWorkspaceNotificationSummary([], DEFAULT_WORKSPACE_NOTIFICATION_REASONS)).toBeNull();
    expect(createWorkspaceNotificationSummary([item("waitingForReply")], DEFAULT_WORKSPACE_NOTIFICATION_REASONS)).toBeNull();
  });

  it("includes only selected reasons", () => {
    const summary = createWorkspaceNotificationSummary(
      [item("overdue"), item("dueToday"), item("followUp"), item("needsCheck")],
      { overdue: false, dueToday: true, followUp: false, needsCheck: true },
    );
    expect(summary?.body).toBe("오늘 마감 1건 · 확인 필요 1건 · BOGUNON DESK에서 확인하세요.");
    expect(summary?.body).not.toContain("private");
  });

  it("returns null when selected reasons have no matching work", () => {
    expect(createWorkspaceNotificationSummary(
      [item("overdue"), item("waitingForReply")],
      { overdue: false, dueToday: true, followUp: false, needsCheck: false },
    )).toBeNull();
  });
});
