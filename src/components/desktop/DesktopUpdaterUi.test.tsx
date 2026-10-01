import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DesktopUpdateBanner } from "./DesktopUpdateBanner";
import { DesktopUpdateConfirmationDialog } from "./DesktopUpdateConfirmationDialog";
import { DeviceSettingsSection } from "./SettingsCenterSections";
import type { DesktopUpdaterState } from "../../updater/updaterTypes";

const metadata = {
  currentVersion: "0.1.0",
  version: "0.2.0",
  publishedAt: null,
  notes: "업무 환경 안정성을 개선했습니다.",
} as const;

const updaterState = (status: DesktopUpdaterState["status"]): DesktopUpdaterState => {
  switch (status) {
    case "idle": return { status, lastCheckedAt: null };
    case "checking": return { status, source: "manual", lastCheckedAt: null };
    case "upToDate": return { status, lastCheckedAt: 1_796_000_000_000 };
    case "unavailable": return { status, lastCheckedAt: null };
    case "available": return { status, metadata, lastCheckedAt: 1_796_000_000_000 };
    case "confirming": return { status, metadata, lastCheckedAt: 1_796_000_000_000 };
    case "downloading": return { status, metadata, progress: { phase: "downloading", downloadedBytes: 43, totalBytes: 100 }, lastCheckedAt: 1_796_000_000_000 };
    case "installing": return { status, metadata, lastCheckedAt: 1_796_000_000_000 };
    case "error": return { status, operation: "check", message: "업데이트 정보를 확인하지 못했습니다. 현재 앱은 계속 사용할 수 있습니다.", lastCheckedAt: 1_796_000_000_000 };
  }
};

const renderDeviceSettings = (state: DesktopUpdaterState) => renderToStaticMarkup(
  <DeviceSettingsSection
    appVersion="0.1.0"
    autostart={false}
    deviceSettings={{ closeToTray: true, workPortalUrl: null, workPortalAutoOpenDelay: "off", workspaceNotificationsEnabled: false, workspaceNotificationReasons: { overdue: true, dueToday: true, followUp: true, needsCheck: true } }}
    isEditingWorkPortal={false}
    isLoadingAutostart={false}
    isSaving={false}
    updaterState={state}
    workFolderFavorites={[]}
    workPortalDraft=""
    onAddWorkFolder={vi.fn()}
    onAutostartChange={vi.fn()}
    onCancelWorkPortal={vi.fn()}
    onCloseToTrayChange={vi.fn()}
    onDeleteWorkFolder={vi.fn()}
    onEditWorkPortal={vi.fn()}
    onManualUpdateCheck={vi.fn()}
    onMoveWorkFolder={vi.fn()}
    onOpenOnboarding={vi.fn()}
    onOpenWorkFolder={vi.fn()}
    onOpenWorkPortal={vi.fn()}
    onRenameWorkFolder={vi.fn()}
    onSaveWorkPortal={vi.fn()}
    onTestNotification={vi.fn()}
    onWorkPortalAutoOpenDelayChange={vi.fn()}
    onWorkPortalDraftChange={vi.fn()}
    onWorkspaceNotificationsChange={vi.fn()}
    onWorkspaceNotificationReasonChange={vi.fn()}
  />,
);

describe("desktop updater UI", () => {
  it("renders the low-distraction available banner with update and later actions", () => {
    const markup = renderToStaticMarkup(<DesktopUpdateBanner state={updaterState("available")} onDismiss={vi.fn()} onRetry={vi.fn()} onUpdate={vi.fn()} />);

    expect(markup).toContain("BOGUNON DESK 0.2.0 업데이트가 있습니다.");
    expect(markup).toContain("현재 버전 0.1.0");
    expect(markup).toContain("업데이트");
    expect(markup).toContain("나중에");
  });

  it("renders progress and a recoverable install error", () => {
    expect(renderToStaticMarkup(<DesktopUpdateBanner state={updaterState("downloading")} onDismiss={vi.fn()} onRetry={vi.fn()} onUpdate={vi.fn()} />)).toContain("업데이트 다운로드 중 43%");
    const error = updaterState("error");
    const installError: DesktopUpdaterState = error.status === "error" ? { ...error, operation: "install" } : error;
    expect(renderToStaticMarkup(<DesktopUpdateBanner state={installError} onDismiss={vi.fn()} onRetry={vi.fn()} onUpdate={vi.fn()} />)).toContain("다시 시도");
  });

  it("warns about session-only work before installation", () => {
    const markup = renderToStaticMarkup(<DesktopUpdateConfirmationDialog version="0.2.0" onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(markup).toContain("빠른 메모");
    expect(markup).toContain("공문·품의 작업");
    expect(markup).toContain("AI API Key");
    expect(markup).toContain("업데이트 계속");
    expect(markup).toContain("취소");
  });

  it("shows current version and manual updater states in device settings", () => {
    expect(renderDeviceSettings(updaterState("idle"))).toContain("확인한 적 없음");
    expect(renderDeviceSettings(updaterState("checking"))).toContain("확인 중...");
    expect(renderDeviceSettings(updaterState("upToDate"))).toContain("최신 버전입니다.");
    expect(renderDeviceSettings(updaterState("available"))).toContain("새 버전 0.2.0 사용 가능");
    expect(renderDeviceSettings(updaterState("error"))).toContain("현재 앱은 계속 사용할 수 있습니다.");
  });
});
