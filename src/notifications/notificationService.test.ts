import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNotificationService } from "./notificationService";
import type { WorkspaceInboxItem } from "../workspace-data/types";
import { DEFAULT_WORKSPACE_NOTIFICATION_REASONS, type NotificationDeviceSettings } from "./types";

const actionable: WorkspaceInboxItem = {
  id: "task-1", title: "private title", reason: "overdue", detail: "private detail",
  priority: "high", status: "planned", followUpDate: null, updatedAt: "2026-10-01T09:00:00.000Z",
  relevantDate: "2026-09-21", area: "healthWork",
  completed: false, tone: "warning",
};

const createRepository = () => ({
  load: vi.fn<() => Promise<NotificationDeviceSettings>>(async () => ({ workspaceNotificationsEnabled: false, workspaceNotificationReasons: DEFAULT_WORKSPACE_NOTIFICATION_REASONS, lastDailySummaryDate: null })),
  setEnabled: vi.fn(async (enabled: boolean) => ({ workspaceNotificationsEnabled: enabled, workspaceNotificationReasons: DEFAULT_WORKSPACE_NOTIFICATION_REASONS, lastDailySummaryDate: null as string | null })),
  setReasons: vi.fn(async (reasons) => ({ workspaceNotificationsEnabled: true, workspaceNotificationReasons: reasons, lastDailySummaryDate: null as string | null })),
  markDailySummarySent: vi.fn(async () => undefined),
  isPermissionGranted: vi.fn(async () => true),
  requestPermission: vi.fn<() => Promise<"granted" | "denied" | "default">>(async () => "granted"),
  send: vi.fn(async () => undefined),
});

describe("notification service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests permission only when enabling and persists true only after grant", async () => {
    const repository = createRepository();
    repository.isPermissionGranted.mockResolvedValue(false);
    const service = createNotificationService(repository);
    await expect(service.setEnabled(true)).resolves.toBe(true);
    expect(repository.requestPermission).toHaveBeenCalledOnce();
    expect(repository.setEnabled).toHaveBeenCalledWith(true);
  });

  it("keeps notifications disabled after permission denial", async () => {
    const repository = createRepository();
    repository.isPermissionGranted.mockResolvedValue(false);
    repository.requestPermission.mockResolvedValue("denied");
    const service = createNotificationService(repository);
    await expect(service.setEnabled(true)).resolves.toBe(false);
    expect(repository.setEnabled).not.toHaveBeenCalledWith(true);
  });

  it("sends test content without changing the daily stamp", async () => {
    const repository = createRepository();
    const service = createNotificationService(repository);
    await service.sendTest();
    expect(repository.send).toHaveBeenCalledWith({ title: "BOGUNON DESK", body: "업무 알림이 정상적으로 설정되었습니다." });
    expect(repository.markDailySummarySent).not.toHaveBeenCalled();
  });

  it("sends and stamps a ready signed-in summary once", async () => {
    const repository = createRepository();
    repository.load.mockResolvedValue({ workspaceNotificationsEnabled: true, workspaceNotificationReasons: DEFAULT_WORKSPACE_NOTIFICATION_REASONS, lastDailySummaryDate: null });
    const service = createNotificationService(repository);
    const input = { authStatus: "signedIn" as const, workspaceState: { status: "ready" as const, data: { inboxItems: [actionable] } }, localDate: "2026-09-22" };
    await Promise.all([service.sendDailySummary(input), service.sendDailySummary(input)]);
    expect(repository.send).toHaveBeenCalledOnce();
    expect(repository.markDailySummarySent).toHaveBeenCalledOnce();
  });

  it.each([
    { authStatus: "signedOut" as const, workspaceState: { status: "ready" as const, data: { inboxItems: [actionable] } } },
    { authStatus: "signedIn" as const, workspaceState: { status: "loading" as const } },
    { authStatus: "signedIn" as const, workspaceState: { status: "error" as const } },
  ])("skips unavailable application states", async ({ authStatus, workspaceState }) => {
    const repository = createRepository();
    repository.load.mockResolvedValue({ workspaceNotificationsEnabled: true, workspaceNotificationReasons: DEFAULT_WORKSPACE_NOTIFICATION_REASONS, lastDailySummaryDate: null });
    const service = createNotificationService(repository);
    await service.sendDailySummary({ authStatus, workspaceState, localDate: "2026-09-22" });
    expect(repository.send).not.toHaveBeenCalled();
  });

  it("does not stamp permission denial, existing stamp, or send failure", async () => {
    const repository = createRepository();
    repository.load.mockResolvedValue({ workspaceNotificationsEnabled: true, workspaceNotificationReasons: DEFAULT_WORKSPACE_NOTIFICATION_REASONS, lastDailySummaryDate: "2026-09-22" });
    const service = createNotificationService(repository);
    const input = { authStatus: "signedIn" as const, workspaceState: { status: "ready" as const, data: { inboxItems: [actionable] } }, localDate: "2026-09-22" };
    await service.sendDailySummary(input);
    expect(repository.send).not.toHaveBeenCalled();
    repository.load.mockResolvedValue({ workspaceNotificationsEnabled: true, workspaceNotificationReasons: DEFAULT_WORKSPACE_NOTIFICATION_REASONS, lastDailySummaryDate: null });
    repository.isPermissionGranted.mockResolvedValue(false);
    await service.sendDailySummary({ ...input, localDate: "2026-09-23" });
    expect(repository.markDailySummarySent).not.toHaveBeenCalled();
  });

  it("leaves the stamp unset when delivery fails", async () => {
    const repository = createRepository();
    repository.load.mockResolvedValue({ workspaceNotificationsEnabled: true, workspaceNotificationReasons: DEFAULT_WORKSPACE_NOTIFICATION_REASONS, lastDailySummaryDate: null });
    repository.send.mockRejectedValue(new Error("delivery"));
    const service = createNotificationService(repository);
    await service.sendDailySummary({ authStatus: "signedIn", workspaceState: { status: "ready", data: { inboxItems: [actionable] } }, localDate: "2026-09-22" });
    expect(repository.markDailySummarySent).not.toHaveBeenCalled();
  });

  it("persists reason settings, notifies listeners, and rejects all-off", async () => {
    const repository = createRepository();
    const service = createNotificationService(repository);
    const listener = vi.fn();
    service.subscribe(listener);
    const reasons = { overdue: true, dueToday: false, followUp: false, needsCheck: false };
    await service.setReasons(reasons);
    expect(repository.setReasons).toHaveBeenCalledWith(reasons);
    expect(listener).toHaveBeenCalledOnce();
    await expect(service.setReasons({ overdue: false, dueToday: false, followUp: false, needsCheck: false }))
      .rejects.toThrow("알림 종류를 하나 이상 선택해 주세요.");
  });

  it("filters daily summaries with stored reasons", async () => {
    const repository = createRepository();
    repository.load.mockResolvedValue({
      workspaceNotificationsEnabled: true,
      workspaceNotificationReasons: { overdue: false, dueToday: true, followUp: false, needsCheck: false },
      lastDailySummaryDate: null,
    });
    const service = createNotificationService(repository);
    await service.sendDailySummary({ authStatus: "signedIn", workspaceState: { status: "ready", data: { inboxItems: [actionable] } }, localDate: "2026-09-22" });
    expect(repository.send).not.toHaveBeenCalled();
    expect(repository.markDailySummarySent).not.toHaveBeenCalled();
  });
});
