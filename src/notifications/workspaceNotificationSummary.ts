import type { WorkspaceInboxItem } from "../workspace-data/types";
import type { WorkspaceNotificationReasonSettings } from "./types";

export const workspaceNotificationReasonLabels = {
  overdue: "마감 지남",
  dueToday: "오늘 마감",
  followUp: "후속 확인",
  needsCheck: "확인 필요",
} as const;

export type SummaryReason = keyof typeof workspaceNotificationReasonLabels;

export type WorkspaceNotificationSummary = {
  readonly title: string;
  readonly body: string;
  readonly count: number;
};

export const createWorkspaceNotificationSummary = (
  items: readonly WorkspaceInboxItem[],
  reasons: WorkspaceNotificationReasonSettings,
): WorkspaceNotificationSummary | null => {
  const counts: Record<SummaryReason, number> = { overdue: 0, dueToday: 0, followUp: 0, needsCheck: 0 };
  for (const item of items) {
    if (item.reason !== "waitingForReply" && reasons[item.reason]) counts[item.reason] += 1;
  }
  const parts = (Object.keys(workspaceNotificationReasonLabels) as SummaryReason[])
    .filter((reason) => counts[reason] > 0)
    .map((reason) => `${workspaceNotificationReasonLabels[reason]} ${counts[reason]}건`);
  const count = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (count === 0) return null;
  return {
    title: "오늘 확인할 BOGUNON 업무",
    body: `${parts.join(" · ")} · BOGUNON DESK에서 확인하세요.`,
    count,
  };
};
