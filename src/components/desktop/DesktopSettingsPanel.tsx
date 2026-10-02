import { X } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAiConnection } from "../../ai/AiConnectionContext";
import { useAuth } from "../../auth/AuthContext";
import { PRODUCT_NAME } from "../../branding";
import { useChatGptConnection } from "../../chatgpt/ChatGptConnectionContext";
import { executeNativeDesktopAction, getDesktopErrorMessage } from "../../desktop/actions";
import type { ConfigurableUrlActionId } from "../../desktop/types";
import type { WorkPortalAutoOpenDelay } from "../../desktop/types";
import { emptyAccountLauncherLinks } from "../../settings/accountSettings";
import { settingsService } from "../../settings/settingsService";
import {
  settingsNavigationDefinitions,
  type SettingsSectionId,
  type WorkspaceEditorTarget,
} from "../../settings/settingsNavigation";
import { createSettingsTargetState } from "../../settings/settingsPanelState";
import type { AccountLauncherLinks, DeviceSettings } from "../../settings/types";
import { defaultWorkspaceFilters, type WorkspaceArea, type WorkspaceFilters } from "../../settings/workspaceFilters";
import { useAccountSync } from "../../settings/AccountSyncContext";
import { accountSyncService } from "../../settings/accountSyncService";
import { loadSchoolInfoState } from "../../school-info/schoolInfoService";
import { notificationService } from "../../notifications/workspaceNotificationService";
import type { SchoolInfoState } from "../../school-info/types";
import type { WorkFolderFavorite } from "../../work-folders/types";
import { workFolderService } from "../../work-folders/workFolderService";
import { useDesktopUpdater } from "../../updater/DesktopUpdaterContext";
import {
  AccountSettingsSection,
  AiSettingsSection,
  ConnectionsSettingsSection,
  DeviceSettingsSection,
  ScreenSettingsSection,
} from "./SettingsCenterSections";

type DesktopSettingsPanelProps = {
  readonly initialSectionId?: SettingsSectionId;
  readonly initialUrlActionId?: ConfigurableUrlActionId | null;
  readonly onClose: () => void;
  readonly onNotice: (message: string) => void;
  readonly onOpenOnboarding: () => void;
  readonly onOpenWorkspaceEditor: (target: WorkspaceEditorTarget) => void;
};

const EMPTY_DEVICE_SETTINGS: DeviceSettings = {
  closeToTray: true,
  workPortalUrl: null,
  workPortalAutoOpenDelay: "off",
  workspaceNotificationsEnabled: false,
  workspaceNotificationReasons: { overdue: true, dueToday: true, followUp: true, needsCheck: true },
};

export function DesktopSettingsPanel({
  initialSectionId = "account",
  initialUrlActionId = null,
  onClose,
  onNotice,
  onOpenOnboarding,
  onOpenWorkspaceEditor,
}: DesktopSettingsPanelProps) {
  const auth = useAuth();
  const ai = useAiConnection();
  const chatgpt = useChatGptConnection();
  const sync = useAccountSync();
  const updater = useDesktopUpdater();
  const [autostart, setAutostart] = useState(false);
  const [isLoadingAutostart, setIsLoadingAutostart] = useState(true);
  const [accountLauncherLinks, setAccountLauncherLinks] =
    useState<AccountLauncherLinks>(emptyAccountLauncherLinks);
  const [workspaceFilters, setWorkspaceFilters] = useState<WorkspaceFilters>(defaultWorkspaceFilters);
  const [deviceSettings, setDeviceSettings] =
    useState<DeviceSettings>(EMPTY_DEVICE_SETTINGS);
  const [workFolderFavorites, setWorkFolderFavorites] = useState<readonly WorkFolderFavorite[]>([]);
  const [editingUrl, setEditingUrl] = useState<ConfigurableUrlActionId | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [isSavingLauncher, setIsSavingLauncher] = useState(false);
  const [isEditingWorkPortal, setIsEditingWorkPortal] = useState(false);
  const [workPortalDraft, setWorkPortalDraft] = useState("");
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(
    initialUrlActionId === null ? initialSectionId : "connections",
  );
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfoState>({ status: "loading" });
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const schoolInfoRequestId = useRef(0);

  const refreshSchoolInfo = useCallback(async (): Promise<void> => {
    const requestId = ++schoolInfoRequestId.current;
    const userId = auth.state.status === "signedIn" ? auth.state.user?.id ?? null : null;
    if (userId !== null) setSchoolInfo({ status: "loading" });
    const nextState = await loadSchoolInfoState(userId);
    if (requestId === schoolInfoRequestId.current) setSchoolInfo(nextState);
  }, [auth.state.status, auth.state.user?.id]);

  useEffect(() => {
    if (activeSection !== "account" || auth.state.status === "loading") return;
    void refreshSchoolInfo();
  }, [activeSection, auth.state.status, refreshSchoolInfo]);

  useEffect(() => {
    let active = true;
    void Promise.all([settingsService.loadPanel(), workFolderService.load()])
      .then(([snapshot, favorites]) => {
        if (active) {
          setAutostart(snapshot.autostartEnabled);
          setAccountLauncherLinks(snapshot.account.launcherLinks);
          setWorkspaceFilters(snapshot.account.workspaceFilters);
          setDeviceSettings(snapshot.device);
          setWorkFolderFavorites(favorites);
          const targetState = createSettingsTargetState(
            initialUrlActionId,
            snapshot.account.launcherLinks,
          );
          setActiveSection(initialUrlActionId === null ? initialSectionId : targetState.activeSection);
          setEditingUrl(targetState.editingUrl);
          setUrlDraft(targetState.urlDraft);
        }
      })
      .catch((error: unknown) => {
        if (active) onNotice(getDesktopErrorMessage(error));
      })
      .finally(() => {
        if (active) setIsLoadingAutostart(false);
      });
    return () => {
      active = false;
    };
  }, [initialSectionId, initialUrlActionId, onNotice]);

  useEffect(() => {
    let active = true;
    void getVersion()
      .then((version) => {
        if (active) setAppVersion(version);
      })
      .catch(() => {
        if (active) setAppVersion(null);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => accountSyncService.subscribeApplied((settings) => {
    setAccountLauncherLinks(settings.launcherLinks);
    setWorkspaceFilters(settings.workspaceFilters);
  }), []);

  useEffect(() => settingsService.account.subscribeWorkspaceFilters(setWorkspaceFilters), []);

  const updateWorkspaceFilter = (area: WorkspaceArea, enabled: boolean): void => {
    const next = { ...workspaceFilters, [area]: enabled };
    setWorkspaceFilters(next);
    settingsService.account.saveWorkspaceFilters(next);
  };

  const updateAutostart = async (enabled: boolean) => {
    setIsLoadingAutostart(true);
    try {
      const actualState = await settingsService.device.setAutostartEnabled(enabled);
      setAutostart(actualState);
      onNotice(actualState ? "Windows 시작 시 자동 실행을 켰습니다." : "자동 실행을 껐습니다.");
    } catch (error) {
      onNotice(getDesktopErrorMessage(error));
    } finally {
      setIsLoadingAutostart(false);
    }
  };

  const startUrlEdit = (actionId: ConfigurableUrlActionId) => {
    const targetState = createSettingsTargetState(actionId, accountLauncherLinks);
    setEditingUrl(targetState.editingUrl);
    setUrlDraft(targetState.urlDraft);
  };

  const updateLauncherUrl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingUrl === null) return;
    setIsSavingLauncher(true);
    try {
      const launcherLinks = await settingsService.account.saveLauncherLink(editingUrl, urlDraft);
      setAccountLauncherLinks(launcherLinks);
      setEditingUrl(null);
      onNotice("런처 주소를 저장했습니다.");
    } catch (error) {
      onNotice(getDesktopErrorMessage(error));
    } finally {
      setIsSavingLauncher(false);
    }
  };

  const addWorkFolder = async () => {
    setIsSavingLauncher(true);
    try {
      const favorites = await workFolderService.pick();
      if (favorites !== null) setWorkFolderFavorites(favorites);
    } catch (error) {
      onNotice(getDesktopErrorMessage(error));
    } finally {
      setIsSavingLauncher(false);
    }
  };

  const openWorkFolder = async (id: string): Promise<void> => {
    try { await workFolderService.open(id); }
    catch (error: unknown) { onNotice(getDesktopErrorMessage(error)); }
  };

  const renameWorkFolder = async (favorite: WorkFolderFavorite): Promise<void> => {
    const name = window.prompt("업무 폴더 이름", favorite.name);
    if (name === null) return;
    try { setWorkFolderFavorites(await workFolderService.rename(favorite.id, name)); }
    catch (error: unknown) { onNotice(getDesktopErrorMessage(error)); }
  };

  const deleteWorkFolder = async (favorite: WorkFolderFavorite): Promise<void> => {
    if (!window.confirm(`'${favorite.name}' 폴더 즐겨찾기를 삭제할까요?\n실제 폴더나 파일은 삭제되지 않습니다.`)) return;
    try { setWorkFolderFavorites(await workFolderService.remove(favorite.id)); }
    catch (error: unknown) { onNotice(getDesktopErrorMessage(error)); }
  };

  const moveWorkFolder = async (id: string, direction: -1 | 1): Promise<void> => {
    const index = workFolderFavorites.findIndex((favorite) => favorite.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= workFolderFavorites.length) return;
    const ids = workFolderFavorites.map((favorite) => favorite.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try { setWorkFolderFavorites(await workFolderService.reorder(ids)); }
    catch (error: unknown) { onNotice(getDesktopErrorMessage(error)); }
  };

  const updateWorkPortalUrl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingLauncher(true);
    try {
      const settings = await settingsService.device.saveWorkPortalUrl(workPortalDraft);
      setDeviceSettings(settings);
      setIsEditingWorkPortal(false);
      onNotice("업무포털 주소를 저장했습니다.");
    } catch (error) {
      onNotice(getDesktopErrorMessage(error));
    } finally {
      setIsSavingLauncher(false);
    }
  };

  const openWorkPortal = async (): Promise<void> => {
    try {
      const outcome = await executeNativeDesktopAction("work-portal");
      if (outcome.message !== null) onNotice(outcome.message);
    } catch (error) {
      onNotice(getDesktopErrorMessage(error));
    }
  };

  const updateWorkPortalAutoOpenDelay = async (
    delay: WorkPortalAutoOpenDelay,
  ): Promise<void> => {
    setIsSavingLauncher(true);
    try {
      const settings = await settingsService.device.saveWorkPortalAutoOpenDelay(delay);
      setDeviceSettings(settings);
      onNotice("자동 열기 설정을 저장했습니다. 다음 앱 시작부터 적용됩니다.");
    } catch (error) {
      onNotice(getDesktopErrorMessage(error));
    } finally {
      setIsSavingLauncher(false);
    }
  };

  const updateCloseToTray = async (enabled: boolean) => {
    try {
      await settingsService.device.setCloseToTray(enabled);
      setDeviceSettings((current) => ({ ...current, closeToTray: enabled }));
    } catch (error) {
      onNotice(getDesktopErrorMessage(error));
    }
  };

  const updateWorkspaceNotifications = async (enabled: boolean): Promise<void> => {
    setIsSavingLauncher(true);
    try {
      const settings = await settingsService.device.setWorkspaceNotificationsEnabled(enabled);
      setDeviceSettings(settings);
      onNotice(enabled && !settings.workspaceNotificationsEnabled
        ? "Windows 알림 권한이 허용되지 않았습니다."
        : enabled ? "업무 알림을 켰습니다." : "업무 알림을 껐습니다.");
    } catch (error) {
      onNotice(getDesktopErrorMessage(error));
    } finally {
      setIsSavingLauncher(false);
    }
  };

  const updateWorkspaceNotificationReason = async (
    reason: keyof DeviceSettings["workspaceNotificationReasons"],
    enabled: boolean,
  ): Promise<void> => {
    const reasons = { ...deviceSettings.workspaceNotificationReasons, [reason]: enabled };
    if (!Object.values(reasons).some(Boolean)) {
      onNotice("알림 종류를 하나 이상 선택해 주세요.");
      return;
    }
    setIsSavingLauncher(true);
    try {
      setDeviceSettings(await settingsService.device.setWorkspaceNotificationReasons(reasons));
    } catch (error) {
      onNotice(getDesktopErrorMessage(error));
    } finally {
      setIsSavingLauncher(false);
    }
  };

  const sendTestNotification = async (): Promise<void> => {
    try {
      await notificationService.sendTest();
      onNotice("테스트 알림을 보냈습니다.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "테스트 알림을 보내지 못했습니다.");
    }
  };

  const openBogunonSchoolSettings = async (): Promise<void> => {
    try {
      const outcome = await executeNativeDesktopAction("bogunon-school-settings");
      if (outcome.message !== null) onNotice(outcome.message);
    } catch (error) {
      onNotice(getDesktopErrorMessage(error));
    }
  };

  const isAuthPending = auth.state.status === "loading"
    || auth.state.status === "signingIn"
    || auth.state.status === "signingOut";
  const syncLabel = sync.status === "syncing"
    ? "동기화 중"
    : sync.status === "synced"
      ? "동기화됨"
      : sync.status === "error"
        ? "오프라인 / 동기화 실패"
        : "로컬 설정 사용 중";
  const syncDetail = sync.status === "synced" && sync.lastSyncedAt !== null
    ? "마지막 동기화: 방금"
    : "오류가 발생해도 이 PC의 마지막 설정은 계속 사용할 수 있습니다.";

  useEffect(() => {
    if (auth.state.notice === null) return;
    onNotice(auth.state.notice.message);
    auth.clearNotice();
  }, [auth, onNotice]);

  return (
    <aside className="desktop-settings" aria-label="설정 센터">
      <header>
        <div>
          <span>{PRODUCT_NAME}</span>
          <strong>설정 센터</strong>
        </div>
        <button type="button" aria-label="설정 닫기" onClick={onClose}><X size={16} /></button>
      </header>

      <div className="desktop-settings__body">
        <nav className="desktop-settings__nav" aria-label="설정 메뉴">
          {settingsNavigationDefinitions.map((definition) => {
            const Icon = definition.icon;
            const isActive = activeSection === definition.id;
            return (
              <button
                className={isActive ? "is-active" : ""}
                type="button"
                aria-current={isActive ? "page" : undefined}
                key={definition.id}
                onClick={() => setActiveSection(definition.id)}
              >
                <Icon size={16} />
                <span><strong>{definition.label}</strong><small>{definition.description}</small></span>
              </button>
            );
          })}
        </nav>

        <div className="desktop-settings__content">
          {activeSection === "account" && (
            <AccountSettingsSection
              authStatus={auth.state.status}
              isAuthPending={isAuthPending}
              syncDetail={syncDetail}
              syncLabel={syncLabel}
              syncStatus={sync.status}
              user={auth.state.user}
              schoolInfo={schoolInfo}
              onOpenBogunonSchoolSettings={() => void openBogunonSchoolSettings()}
              onRefreshSchoolInfo={() => void refreshSchoolInfo()}
              onSignIn={() => void auth.signInWithGoogle()}
              onSignOut={() => void auth.signOut()}
            />
          )}

          {activeSection === "screen" && (
            <ScreenSettingsSection
              filters={workspaceFilters}
              onFilterChange={updateWorkspaceFilter}
              onOpen={onOpenWorkspaceEditor}
            />
          )}

          {activeSection === "connections" && (
            <ConnectionsSettingsSection
              editingUrl={editingUrl}
              isSaving={isSavingLauncher}
              launcherLinks={accountLauncherLinks}
              syncStatus={sync.status}
              urlDraft={urlDraft}
              onDraftChange={setUrlDraft}
              onEdit={startUrlEdit}
              onSubmit={(event) => void updateLauncherUrl(event)}
            />
          )}

          {activeSection === "ai" && (
            <AiSettingsSection
              apiKey={ai.apiKey}
              chatGptState={chatgpt.state}
              model={ai.model}
              provider={ai.provider}
              state={ai.state}
              onApiKeyChange={ai.setApiKey}
              onChatGptDisconnect={() => void chatgpt.disconnect()}
              onChatGptSignIn={() => void chatgpt.startSignIn()}
              onConnect={() => void ai.connect()}
              onDisconnect={ai.disconnect}
              onModelChange={ai.setModel}
              onProviderChange={ai.setProvider}
              onValidate={() => void ai.validate()}
            />
          )}

          {activeSection === "device" && (
            <DeviceSettingsSection
              autostart={autostart}
              deviceSettings={deviceSettings}
              isLoadingAutostart={isLoadingAutostart}
              isSaving={isSavingLauncher}
              onAutostartChange={(enabled) => void updateAutostart(enabled)}
              onCloseToTrayChange={(enabled) => void updateCloseToTray(enabled)}
              workFolderFavorites={workFolderFavorites}
              onAddWorkFolder={() => void addWorkFolder()}
              onDeleteWorkFolder={(favorite) => void deleteWorkFolder(favorite)}
              onMoveWorkFolder={(id, direction) => void moveWorkFolder(id, direction)}
              onOpenWorkFolder={(id) => void openWorkFolder(id)}
              onRenameWorkFolder={(favorite) => void renameWorkFolder(favorite)}
              isEditingWorkPortal={isEditingWorkPortal}
              workPortalDraft={workPortalDraft}
              onWorkPortalDraftChange={setWorkPortalDraft}
              onEditWorkPortal={() => {
                setWorkPortalDraft(deviceSettings.workPortalUrl ?? "");
                setIsEditingWorkPortal(true);
              }}
              onCancelWorkPortal={() => {
                setWorkPortalDraft(deviceSettings.workPortalUrl ?? "");
                setIsEditingWorkPortal(false);
              }}
              onSaveWorkPortal={(event) => void updateWorkPortalUrl(event)}
              onOpenWorkPortal={() => void openWorkPortal()}
              onWorkPortalAutoOpenDelayChange={(delay) => void updateWorkPortalAutoOpenDelay(delay)}
              onWorkspaceNotificationsChange={(enabled) => void updateWorkspaceNotifications(enabled)}
              onWorkspaceNotificationReasonChange={(reason, enabled) => void updateWorkspaceNotificationReason(reason, enabled)}
              onTestNotification={() => void sendTestNotification()}
              appVersion={appVersion}
              updaterState={updater.state}
              onManualUpdateCheck={() => void updater.manualCheck()}
              onOpenOnboarding={onOpenOnboarding}
            />
          )}
        </div>
      </div>

      <footer>계정 설정과 이 PC 전용 설정은 서로 분리되어 저장됩니다.</footer>
    </aside>
  );
}
