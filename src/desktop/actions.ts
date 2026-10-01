import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AccountLauncherLinks } from "../settings/types";
import type { BogunonSearchResultTarget, ConfigurableUrlActionId, DesktopActionId, DesktopActionOutcome, LauncherSettings, WorkPortalAutoOpenDelay } from "./types";

export const isDesktopRuntime = (): boolean => isTauri();

export const executeNativeDesktopAction = async (
  actionId: DesktopActionId,
): Promise<DesktopActionOutcome> => {
  if (!isDesktopRuntime()) {
    return {
      status: "unavailable",
      message: "Desktop 기능은 Tauri 앱에서 사용할 수 있습니다.",
    };
  }
  return invoke<DesktopActionOutcome>("execute_desktop_action", { actionId });
};

export const openBogunonSearchResult = async (
  target: BogunonSearchResultTarget,
): Promise<DesktopActionOutcome> => {
  if (!isDesktopRuntime()) {
    return { status: "unavailable", message: "Desktop 기능은 Tauri 앱에서 사용할 수 있습니다." };
  }
  return invoke<DesktopActionOutcome>("open_bogunon_search_result", target);
};

export const openQuickMemoUrl = async (url: string): Promise<void> => {
  if (!isDesktopRuntime()) {
    throw new Error("링크 열기는 Tauri 앱에서 사용할 수 있습니다.");
  }
  await invoke("open_quick_memo_url", { url });
};

export const getAutostartEnabled = async (): Promise<boolean> => {
  if (!isDesktopRuntime()) return false;
  return invoke<boolean>("get_autostart_enabled");
};

export const setAutostartEnabled = async (enabled: boolean): Promise<boolean> => {
  if (!isDesktopRuntime()) return false;
  return invoke<boolean>("set_autostart_enabled", { enabled });
};

export const syncCloseToTray = async (enabled: boolean): Promise<void> => {
  if (!isDesktopRuntime()) return;
  await invoke("set_close_to_tray", { enabled });
};

export const getLauncherSettings = async (): Promise<LauncherSettings> => {
  if (!isDesktopRuntime()) {
    return {
      onlineHealthRoomUrl: null,
      bogunonUrl: null,
      checkupToolUrl: null,
      workPortalUrl: null,
      workPortalAutoOpenDelay: "off",
    };
  }
  return invoke<LauncherSettings>("get_launcher_settings");
};

export const validateWebUrl = (value: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("http 또는 https 주소를 입력해 주세요.");
  }

  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.hostname === "") {
    throw new Error("http 또는 https 주소를 입력해 주세요.");
  }
  return parsed.toString();
};

export const replaceAccountLauncherLinks = async (
  launcherLinks: AccountLauncherLinks,
): Promise<LauncherSettings> => {
  if (!isDesktopRuntime()) {
    return { ...launcherLinks, workPortalUrl: null, workPortalAutoOpenDelay: "off" };
  }
  return invoke<LauncherSettings>("replace_account_launcher_links", { launcherLinks });
};

export const saveWorkPortalUrl = async (url: string | null): Promise<LauncherSettings> => {
  const validatedUrl = url === null ? null : validateWebUrl(url);
  if (!isDesktopRuntime()) {
    throw new Error("URL 저장은 Tauri 앱에서 사용할 수 있습니다.");
  }
  return invoke<LauncherSettings>("save_work_portal_url", { url: validatedUrl });
};

export const saveWorkPortalAutoOpenDelay = async (
  delay: WorkPortalAutoOpenDelay,
): Promise<LauncherSettings> => {
  if (!isDesktopRuntime()) {
    throw new Error("자동 열기 설정은 Tauri 앱에서 사용할 수 있습니다.");
  }
  return invoke<LauncherSettings>("save_work_portal_auto_open_delay", { delay });
};

export const saveLauncherUrl = async (
  actionId: ConfigurableUrlActionId,
  url: string,
): Promise<LauncherSettings> => {
  const validatedUrl = validateWebUrl(url);
  if (!isDesktopRuntime()) {
    throw new Error("URL 저장은 Tauri 앱에서 사용할 수 있습니다.");
  }
  return invoke<LauncherSettings>("save_launcher_url", { actionId, url: validatedUrl });
};

export const getDesktopErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Desktop 기능을 실행하지 못했습니다.";
};
