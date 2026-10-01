import type { AuthStatus } from "../auth/types";
import type { WorkspaceInboxItem } from "../workspace-data/types";
import { hasEnabledNotificationReason, type NotificationRepository, type WorkspaceNotificationReasonSettings } from "./types";
import { createWorkspaceNotificationSummary } from "./workspaceNotificationSummary";

type DailyWorkspaceState =
  | { readonly status: "loading" | "signedOut" | "error" }
  | { readonly status: "ready"; readonly data: { readonly inboxItems: readonly WorkspaceInboxItem[] } };

type DailySummaryInput = {
  readonly authStatus: AuthStatus;
  readonly workspaceState: DailyWorkspaceState;
  readonly localDate: string;
};

export const createNotificationService = (repository: NotificationRepository) => {
  let inFlightDate: string | null = null;
  const listeners = new Set<() => void>();
  return {
    load: repository.load,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setEnabled: async (enabled: boolean): Promise<boolean> => {
      if (!enabled) {
        await repository.setEnabled(false);
        listeners.forEach((listener) => listener());
        return false;
      }
      const granted = await repository.isPermissionGranted()
        || await repository.requestPermission() === "granted";
      if (!granted) {
        await repository.setEnabled(false);
        listeners.forEach((listener) => listener());
        return false;
      }
      await repository.setEnabled(true);
      listeners.forEach((listener) => listener());
      return true;
    },
    setReasons: async (reasons: WorkspaceNotificationReasonSettings) => {
      if (!hasEnabledNotificationReason(reasons)) throw new Error("알림 종류를 하나 이상 선택해 주세요.");
      const settings = await repository.setReasons(reasons);
      listeners.forEach((listener) => listener());
      return settings;
    },
    sendTest: async (): Promise<void> => {
      if (!await repository.isPermissionGranted()) throw new Error("Windows 알림 권한이 허용되지 않았습니다.");
      await repository.send({ title: "BOGUNON DESK", body: "업무 알림이 정상적으로 설정되었습니다." });
    },
    sendDailySummary: async (input: DailySummaryInput): Promise<void> => {
      if (input.authStatus !== "signedIn" || input.workspaceState.status !== "ready" || inFlightDate === input.localDate) return;
      inFlightDate = input.localDate;
      try {
        const settings = await repository.load();
        if (!settings.workspaceNotificationsEnabled || settings.lastDailySummaryDate === input.localDate) return;
        const summary = createWorkspaceNotificationSummary(
          input.workspaceState.data.inboxItems,
          settings.workspaceNotificationReasons,
        );
        if (summary === null) return;
        if (!await repository.isPermissionGranted()) return;
        await repository.send({ title: summary.title, body: summary.body });
        await repository.markDailySummarySent(input.localDate);
      } catch {
        return;
      } finally {
        inFlightDate = null;
      }
    },
  };
};
