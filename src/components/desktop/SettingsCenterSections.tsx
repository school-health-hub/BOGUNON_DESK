import { Bell, CheckCircle2, ChevronRight, ExternalLink, FolderOpen, LogOut, Power, RefreshCw, School, Sparkles } from "lucide-react";
import type { FormEventHandler } from "react";
import { aiProviderDefinitions, aiProviderRegistry } from "../../ai/config";
import type { AiConnectionState, AiProvider } from "../../ai/types";
import type { AuthStatus, AuthUser } from "../../auth/types";
import type { ChatGptConnectionState } from "../../chatgpt/types";
import { parseWorkPortalAutoOpenDelay, type ConfigurableUrlActionId, type WorkPortalAutoOpenDelay } from "../../desktop/types";
import {
  screenSettingDefinitions,
  urlSettingDefinitions,
  type WorkspaceEditorTarget,
} from "../../settings/settingsNavigation";
import type { AccountLauncherLinks, DeviceSettings, SyncStatus } from "../../settings/types";
import type { WorkspaceArea, WorkspaceFilters } from "../../settings/workspaceFilters";
import type { SchoolInfoState } from "../../school-info/types";
import type { WorkFolderFavorite } from "../../work-folders/types";
import type { DesktopUpdaterState } from "../../updater/updaterTypes";
import { ChatGptAccountSettings } from "./ChatGptAccountSettings";

type AccountSectionProps = {
  readonly authStatus: AuthStatus;
  readonly isAuthPending: boolean;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
  readonly syncDetail: string;
  readonly syncLabel: string;
  readonly syncStatus: SyncStatus;
  readonly user: AuthUser | null;
  readonly schoolInfo: SchoolInfoState;
  readonly onOpenBogunonSchoolSettings: () => void;
  readonly onRefreshSchoolInfo: () => void;
};

export function AccountSettingsSection(props: AccountSectionProps) {
  const accountLabel = props.user === null ? "로그인하지 않음" : "연결됨";
  const accountName = props.user?.displayName ?? props.user?.email ?? "로그인하지 않음";
  const accountDetail = props.user?.displayName === null || props.user?.displayName === undefined
    ? "BOGUNON과 같은 Google 계정에 연결되었습니다."
    : props.user.email ?? "BOGUNON과 같은 Google 계정에 연결되었습니다.";

  return (
    <section aria-labelledby="settings-account-heading">
      <div className="desktop-settings__section-heading">
        <div><strong id="settings-account-heading">계정</strong><span>{accountLabel}</span></div>
      </div>
      {props.user !== null ? (
        <div className="desktop-setting-row desktop-setting-row--account">
          <div><strong>{accountName}</strong><span>{accountDetail}</span></div>
          <button className="desktop-setting-row__action" type="button" disabled={props.isAuthPending} onClick={props.onSignOut}><LogOut size={13} /> 로그아웃</button>
        </div>
      ) : (
        <div className="desktop-setting-row desktop-setting-row--account">
          <div>
            <strong>{props.authStatus === "signingIn" ? "브라우저에서 로그인 중" : "로그인하지 않음"}</strong>
            <span>화면 구성과 개인 설정을 여러 PC에서 동기화할 수 있습니다.<br />업무 폴더 등 PC 전용 설정은 동기화되지 않습니다.</span>
          </div>
          <button className="desktop-setting-row__action" type="button" disabled={props.isAuthPending} onClick={props.onSignIn}>Google로 연결</button>
        </div>
      )}
      <div className={`desktop-sync-status is-${props.syncStatus}`}>
        <span>{props.syncLabel}</span>
        <small>{props.syncDetail}</small>
      </div>
      <div className="desktop-settings__section-heading desktop-settings__section-heading--subsection">
        <div><strong>학교 정보</strong><span>BOGUNON에 등록된 학교를 읽기 전용으로 표시합니다.</span></div>
      </div>
      <SchoolInfoSettings state={props.schoolInfo} onOpen={props.onOpenBogunonSchoolSettings} onRefresh={props.onRefreshSchoolInfo} />
    </section>
  );
}

function SchoolInfoSettings({ state, onOpen, onRefresh }: {
  readonly state: SchoolInfoState;
  readonly onOpen: () => void;
  readonly onRefresh: () => void;
}) {
  if (state.status === "loading") {
    return <div className="desktop-school-info is-status"><RefreshCw size={15} className="is-spinning" /><span>학교 정보를 불러오는 중입니다.</span></div>;
  }
  if (state.status === "signedOut") {
    return <div className="desktop-school-info is-status"><School size={15} /><span>학교 정보를 보려면 Google 계정을 연결해 주세요.</span></div>;
  }
  if (state.status === "error") {
    return (
      <div className="desktop-school-info is-status">
        <School size={15} /><span>학교 정보를 불러오지 못했습니다.</span>
        <button type="button" onClick={onRefresh}><RefreshCw size={13} /> 새로고침</button>
      </div>
    );
  }
  if (state.status === "missing") {
    return (
      <div className="desktop-school-info is-status">
        <School size={15} /><span>BOGUNON에 등록된 학교가 없습니다.</span>
        <button type="button" onClick={onOpen}><ExternalLink size={13} /> BOGUNON에서 학교 등록</button>
      </div>
    );
  }
  return (
    <div className="desktop-school-info">
      <div className="desktop-school-info__title"><School size={17} /><strong>{state.school.schoolName}</strong></div>
      <dl>
        <div><dt>교육청</dt><dd>{state.school.officeName}</dd></div>
        <div><dt>학교 코드</dt><dd>{state.school.schoolCode}</dd></div>
        <div><dt>교육청 코드</dt><dd>{state.school.officeCode}</dd></div>
      </dl>
      <div className="desktop-school-info__actions">
        <button type="button" onClick={onRefresh}><RefreshCw size={13} /> 새로고침</button>
        <button type="button" onClick={onOpen}><ExternalLink size={13} /> BOGUNON에서 학교 변경</button>
      </div>
    </div>
  );
}

const workspaceFilterDefinitions: readonly { readonly area: WorkspaceArea; readonly label: string }[] = [
  { area: "healthWork", label: "보건업무" },
  { area: "schoolSchedule", label: "학교일정" },
  { area: "personal", label: "개인" },
  { area: "exercise", label: "운동" },
  { area: "project", label: "프로젝트" },
];

type ScreenSettingsSectionProps = {
  readonly filters: WorkspaceFilters;
  readonly onFilterChange: (area: WorkspaceArea, enabled: boolean) => void;
  readonly onOpen: (target: WorkspaceEditorTarget) => void;
};

export function ScreenSettingsSection({ filters, onFilterChange, onOpen }: ScreenSettingsSectionProps) {
  return (
    <section aria-labelledby="settings-screen-heading">
      <div className="desktop-settings__section-heading">
        <div><strong id="settings-screen-heading">화면</strong><span>현재 작업 공간에서 직접 꾸밉니다.</span></div>
      </div>
      <div className="desktop-settings__action-list">
        {screenSettingDefinitions.map((definition) => {
          const Icon = definition.icon;
          return (
            <button type="button" key={definition.id} onClick={() => onOpen(definition.id)}>
              <Icon size={17} />
              <span><strong>{definition.label}</strong><small>{definition.description}</small></span>
              <ChevronRight size={15} />
            </button>
          );
        })}
      </div>
      <div className="desktop-settings__section-heading desktop-settings__section-heading--subsection">
        <div>
          <strong>일정 표시</strong>
          <span>BOGUNON DESK에 표시할 BOGUNON 일정과 업무 범위를 선택합니다.</span>
        </div>
      </div>
      <div className="desktop-settings__filter-list">
        {workspaceFilterDefinitions.map((definition) => (
          <label className="desktop-setting-row" key={definition.area}>
            <div><strong>{definition.label}</strong></div>
            <input
              type="checkbox"
              checked={filters[definition.area]}
              onChange={(event) => onFilterChange(definition.area, event.currentTarget.checked)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

type ConnectionsSectionProps = {
  readonly editingUrl: ConfigurableUrlActionId | null;
  readonly isSaving: boolean;
  readonly launcherLinks: AccountLauncherLinks;
  readonly onDraftChange: (value: string) => void;
  readonly onEdit: (actionId: ConfigurableUrlActionId) => void;
  readonly onSubmit: FormEventHandler<HTMLFormElement>;
  readonly syncStatus: SyncStatus;
  readonly urlDraft: string;
};

export function ConnectionsSettingsSection(props: ConnectionsSectionProps) {
  return (
    <section aria-labelledby="settings-connections-heading">
      <div className="desktop-settings__section-heading">
        <div><strong id="settings-connections-heading">연결</strong><span>계정과 함께 동기화되는 런처 주소입니다.</span></div>
      </div>
      {urlSettingDefinitions.map((definition) => (
        <div className="desktop-setting-group" key={definition.id}>
          <div className="desktop-setting-row">
            <div><strong>{definition.label}</strong><span>{props.launcherLinks[definition.settingsKey] === null ? "미설정" : "연결됨"}</span></div>
            <button className="desktop-setting-row__action" type="button" disabled={props.syncStatus === "syncing"} onClick={() => props.onEdit(definition.id)}>URL 변경</button>
          </div>
          {props.editingUrl === definition.id && (
            <form className="desktop-setting-editor" onSubmit={props.onSubmit}>
              <label htmlFor={`${definition.id}-url`}>{definition.label} URL</label>
              <div>
                <input autoFocus id={`${definition.id}-url`} type="url" value={props.urlDraft} placeholder="https://" required disabled={props.syncStatus === "syncing"} onChange={(event) => props.onDraftChange(event.currentTarget.value)} />
                <button type="submit" disabled={props.isSaving || props.syncStatus === "syncing"}>저장</button>
              </div>
            </form>
          )}
        </div>
      ))}
    </section>
  );
}

type AiSettingsSectionProps = {
  readonly apiKey: string;
  readonly chatGptState: ChatGptConnectionState;
  readonly model: string;
  readonly provider: AiProvider;
  readonly state: AiConnectionState;
  readonly onApiKeyChange: (apiKey: string) => void;
  readonly onChatGptDisconnect: () => void;
  readonly onChatGptSignIn: () => void;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
  readonly onModelChange: (model: string) => void;
  readonly onProviderChange: (provider: AiProvider) => void;
  readonly onValidate: () => void;
};

export function AiSettingsSection(props: AiSettingsSectionProps) {
  const isChecking = props.state.status === "checking";
  const hasConnection = props.state.status === "connected" || props.state.canRetry;
  const provider = hasConnection && props.state.provider !== null
    ? props.state.provider
    : props.provider;
  const model = hasConnection && props.state.model !== null
    ? props.state.model
    : props.model;
  const providerDefinition = aiProviderRegistry[provider];

  return (
    <section aria-labelledby="settings-ai-heading">
      <div className="desktop-settings__section-heading">
        <div>
          <strong id="settings-ai-heading">AI 서비스 연결</strong>
          <span>BOGUNON DESK의 AI 기능에서 사용할 서비스를 선택적으로 연결합니다.</span>
        </div>
      </div>

      <ChatGptAccountSettings
        state={props.chatGptState}
        onDisconnect={props.onChatGptDisconnect}
        onSignIn={props.onChatGptSignIn}
      />

      <div className="desktop-ai-subsection">
        <div className="desktop-ai-subsection__heading">
          <strong>API Key 방식(OpenAI/Gemini)</strong>
          <span>기존 OpenAI 또는 Gemini API Key로 AI 기능을 연결합니다.</span>
        </div>

      {hasConnection && (
        <div className={`desktop-ai-status is-${props.state.status}`} role="status">
          <CheckCircle2 size={17} />
          <div>
            <strong>{providerDefinition.label} {props.state.status === "failed" ? "연결 확인 실패" : "연결됨"}</strong>
            <span>{providerDefinition.models.find((item) => item.id === model)?.label ?? model}</span>
          </div>
        </div>
      )}

      <div className="desktop-ai-form">
        <label htmlFor="ai-provider">서비스</label>
        <select
          id="ai-provider"
          value={provider}
          disabled={isChecking || hasConnection}
          onChange={(event) => props.onProviderChange(event.currentTarget.value as AiProvider)}
        >
          {aiProviderDefinitions.map((definition) => (
            <option key={definition.id} value={definition.id}>{definition.label}</option>
          ))}
        </select>

        <label htmlFor="ai-model">모델</label>
        <select
          id="ai-model"
          value={model}
          disabled={isChecking || hasConnection}
          onChange={(event) => props.onModelChange(event.currentTarget.value)}
        >
          {providerDefinition.models.map((definition) => (
            <option key={definition.id} value={definition.id}>{definition.label}</option>
          ))}
        </select>

        <label htmlFor="ai-api-key">API Key</label>
        <input
          id="ai-api-key"
          type="password"
          autoComplete="off"
          value={hasConnection ? "••••••••••••" : props.apiKey}
          disabled={isChecking || hasConnection}
          placeholder="API Key 입력"
          onChange={(event) => props.onApiKeyChange(event.currentTarget.value)}
        />
      </div>

      {props.state.status === "failed" && props.state.error !== null && (
        <p className="desktop-ai-error" role="alert">{props.state.error}</p>
      )}

      <div className="desktop-ai-actions">
        {hasConnection ? (
          <>
            <button type="button" disabled={isChecking} onClick={props.onValidate}>
              {isChecking ? "확인 중..." : "연결 상태 확인"}
            </button>
            <button className="is-secondary" type="button" disabled={isChecking} onClick={props.onDisconnect}>연결 해제</button>
          </>
        ) : (
          <button type="button" disabled={isChecking || props.apiKey.trim() === ""} onClick={props.onConnect}>
            {isChecking ? "연결 확인 중..." : "연결 확인"}
          </button>
        )}
      </div>
      </div>

      <div className="desktop-ai-guidance">
        <Sparkles size={16} />
        <p>
          <strong>AI 연결은 선택사항입니다.</strong>
          <span>API Key는 저장되지 않으며 현재 앱을 실행하는 동안에만 메모리에 유지됩니다.</span>
          <span>향후 AI 기능을 사용할 경우 입력한 내용은 선택한 AI 서비스로 전송됩니다.</span>
        </p>
      </div>
    </section>
  );
}

type DeviceSectionProps = {
  readonly appVersion: string | null;
  readonly autostart: boolean;
  readonly deviceSettings: DeviceSettings;
  readonly isLoadingAutostart: boolean;
  readonly isSaving: boolean;
  readonly onAutostartChange: (enabled: boolean) => void;
  readonly onCloseToTrayChange: (enabled: boolean) => void;
  readonly workFolderFavorites: readonly WorkFolderFavorite[];
  readonly onAddWorkFolder: () => void;
  readonly onDeleteWorkFolder: (favorite: WorkFolderFavorite) => void;
  readonly onMoveWorkFolder: (id: string, direction: -1 | 1) => void;
  readonly onOpenWorkFolder: (id: string) => void;
  readonly onRenameWorkFolder: (favorite: WorkFolderFavorite) => void;
  readonly isEditingWorkPortal: boolean;
  readonly workPortalDraft: string;
  readonly onWorkPortalDraftChange: (value: string) => void;
  readonly onEditWorkPortal: () => void;
  readonly onCancelWorkPortal: () => void;
  readonly onSaveWorkPortal: FormEventHandler<HTMLFormElement>;
  readonly onOpenWorkPortal: () => void;
  readonly onWorkPortalAutoOpenDelayChange: (delay: WorkPortalAutoOpenDelay) => void;
  readonly onWorkspaceNotificationsChange: (enabled: boolean) => void;
  readonly onWorkspaceNotificationReasonChange: (reason: keyof DeviceSettings["workspaceNotificationReasons"], enabled: boolean) => void;
  readonly onTestNotification: () => void;
  readonly onOpenOnboarding: () => void;
  readonly updaterState: DesktopUpdaterState;
  readonly onManualUpdateCheck: () => void;
};

const formatLastUpdateCheck = (timestamp: number | null): string => {
  if (timestamp === null) return "확인한 적 없음";
  const checkedAt = new Date(timestamp);
  const now = new Date();
  const time = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(checkedAt);
  const isToday = checkedAt.getFullYear() === now.getFullYear()
    && checkedAt.getMonth() === now.getMonth()
    && checkedAt.getDate() === now.getDate();
  if (isToday) return `오늘 ${time}`;
  const date = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "numeric", day: "numeric" }).format(checkedAt);
  return `${date} ${time}`;
};

const updaterStatusLabel = (state: DesktopUpdaterState): string => {
  switch (state.status) {
    case "idle": return formatLastUpdateCheck(state.lastCheckedAt);
    case "checking": return "확인 중...";
    case "upToDate": return "최신 버전입니다.";
    case "unavailable": return "이 환경에서는 업데이트를 확인할 수 없습니다.";
    case "available":
    case "confirming":
    case "downloading":
    case "installing":
      return `새 버전 ${state.metadata.version} 사용 가능`;
    case "error": return state.message;
  }
};

export function DeviceSettingsSection(props: DeviceSectionProps) {
  return (
    <section aria-labelledby="settings-device-heading">
      <div className="desktop-settings__section-heading">
        <div><strong id="settings-device-heading">이 PC</strong><span>Windows와 로컬 경로는 이 PC에만 저장됩니다.</span></div>
      </div>
      <label className="desktop-setting-row">
        <div><strong>Windows 시작 시 실행</strong><span>로그인하면 BOGUNON DESK를 자동으로 실행합니다.</span></div>
        <input type="checkbox" checked={props.autostart} disabled={props.isLoadingAutostart} onChange={(event) => props.onAutostartChange(event.currentTarget.checked)} />
      </label>
      <label className="desktop-setting-row">
        <div><strong>창을 닫을 때 트레이로 최소화</strong><span>종료는 트레이 메뉴에서 할 수 있습니다.</span></div>
        <input type="checkbox" checked={props.deviceSettings.closeToTray} onChange={(event) => props.onCloseToTrayChange(event.currentTarget.checked)} />
      </label>
      <div className="desktop-settings__section-heading desktop-settings__section-heading--subsection">
        <div><strong>업무 폴더</strong><span>자주 사용하는 폴더를 이 PC에만 저장합니다.</span></div>
        <button className="desktop-setting-row__action" type="button" disabled={props.isSaving || props.workFolderFavorites.length >= 12} onClick={props.onAddWorkFolder}>+ 폴더 추가</button>
      </div>
      <div className="work-folder-settings-list">
        {props.workFolderFavorites.length === 0 && <p className="desktop-panel-state">등록된 업무 폴더가 없습니다.</p>}
        {props.workFolderFavorites.map((favorite, index) => (
          <div className={`desktop-setting-row work-folder-setting-row${favorite.available ? "" : " is-unavailable"}`} key={favorite.id}>
            <div><strong>{favorite.name}</strong><span title={favorite.path}>{favorite.available ? favorite.displayPath : "폴더를 찾을 수 없음"}</span></div>
            <div className="desktop-setting-row__actions">
              <button className="desktop-setting-row__action" type="button" disabled={index === 0} aria-label={`${favorite.name} 위로 이동`} onClick={() => props.onMoveWorkFolder(favorite.id, -1)}>↑</button>
              <button className="desktop-setting-row__action" type="button" disabled={index === props.workFolderFavorites.length - 1} aria-label={`${favorite.name} 아래로 이동`} onClick={() => props.onMoveWorkFolder(favorite.id, 1)}>↓</button>
              <button className="desktop-setting-row__action" type="button" onClick={() => props.onRenameWorkFolder(favorite)}>이름 변경</button>
              <button className="desktop-setting-row__action" type="button" onClick={() => props.onDeleteWorkFolder(favorite)}>삭제</button>
              <button className="desktop-setting-row__action" type="button" disabled={!favorite.available} onClick={() => props.onOpenWorkFolder(favorite.id)}><FolderOpen size={13} /> 열기</button>
            </div>
          </div>
        ))}
      </div>
      <div className="desktop-settings__section-heading desktop-settings__section-heading--subsection">
        <div><strong>PC 업무 실행</strong><span>이 PC에 등록한 업무 서비스만 안전하게 실행합니다.</span></div>
      </div>
      <div className="desktop-setting-group">
        <div className="desktop-setting-row">
          <div><strong>업무포털</strong><span>{props.deviceSettings.workPortalUrl === null ? "미설정" : "연결됨"}</span></div>
          <div className="desktop-setting-row__actions">
            <button className="desktop-setting-row__action" type="button" disabled={props.isSaving} onClick={props.onEditWorkPortal}>URL 설정</button>
            <button className="desktop-setting-row__action" type="button" disabled={props.isSaving} onClick={props.onOpenWorkPortal}><ExternalLink size={13} /> 열기</button>
          </div>
        </div>
        {props.isEditingWorkPortal && (
          <form className="desktop-setting-editor" onSubmit={props.onSaveWorkPortal}>
            <label htmlFor="work-portal-url">업무포털 URL</label>
            <input autoFocus id="work-portal-url" type="url" value={props.workPortalDraft} placeholder="https://" required disabled={props.isSaving} onChange={(event) => props.onWorkPortalDraftChange(event.currentTarget.value)} />
            <small>이 주소는 이 PC에만 저장됩니다.<br />로그인 정보가 포함된 주소는 저장하지 마세요.</small>
            <div className="desktop-setting-editor__actions">
              <button className="is-secondary" type="button" disabled={props.isSaving} onClick={props.onCancelWorkPortal}>취소</button>
              <button type="submit" disabled={props.isSaving}>{props.isSaving ? "저장 중..." : "저장"}</button>
            </div>
          </form>
        )}
        <label className="desktop-setting-row desktop-setting-row--compact">
          <div><strong>자동 열기</strong><span>BOGUNON DESK를 시작할 때 이 PC에서 한 번만 업무포털을 엽니다.</span></div>
          <select
            aria-label="업무포털 자동 열기"
            value={props.deviceSettings.workPortalAutoOpenDelay}
            disabled={props.isSaving}
            onChange={(event) => props.onWorkPortalAutoOpenDelayChange(parseWorkPortalAutoOpenDelay(event.currentTarget.value))}
          >
            <option value="off">사용 안 함</option>
            <option value="20s">BOGUNON DESK 시작 20초 후</option>
            <option value="45s">BOGUNON DESK 시작 45초 후</option>
          </select>
        </label>
      </div>
      <div className="desktop-settings__section-heading desktop-settings__section-heading--subsection">
        <div><strong>Windows 알림</strong><span>이 PC에서만 업무 요약 알림을 사용합니다.</span></div>
      </div>
      <label className="desktop-setting-row">
        <div><strong>업무 알림</strong><span>마감·후속 확인 등 확인할 업무를 하루 한 번 요약해 알려줍니다.</span></div>
        <input type="checkbox" checked={props.deviceSettings.workspaceNotificationsEnabled} disabled={props.isSaving} onChange={(event) => props.onWorkspaceNotificationsChange(event.currentTarget.checked)} />
      </label>
      <fieldset className="desktop-settings__notification-reasons" disabled={props.isSaving || !props.deviceSettings.workspaceNotificationsEnabled}>
        <legend>알림 종류</legend>
        <small>Windows 요약에 포함할 업무 종류를 선택합니다.</small>
        {([
          ["overdue", "마감 지남"],
          ["dueToday", "오늘 마감"],
          ["followUp", "후속 확인"],
          ["needsCheck", "확인 필요"],
        ] as const).map(([reason, label]) => (
          <label key={reason}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={props.deviceSettings.workspaceNotificationReasons[reason]}
              onChange={(event) => props.onWorkspaceNotificationReasonChange(reason, event.currentTarget.checked)}
            />
          </label>
        ))}
      </fieldset>
      <div className="desktop-setting-row desktop-setting-row--compact">
        <div><strong>알림 확인</strong><span>업무 제목이나 상세 내용은 Windows 알림에 표시하지 않습니다.</span></div>
        <button className="desktop-setting-row__action" type="button" disabled={props.isSaving || !props.deviceSettings.workspaceNotificationsEnabled} onClick={props.onTestNotification}><Bell size={13} /> 테스트 알림</button>
      </div>
      <div className="desktop-tray-status"><Power size={14} /><span>System Tray 활성화됨</span></div>
      <div className="desktop-beta-info">
        <div>
          <strong>BOGUNON DESK</strong>
          <span>현재 버전 {props.appVersion ?? "확인 중"} · 공유 베타</span>
          <small>{updaterStatusLabel(props.updaterState)}</small>
        </div>
        <div className="desktop-beta-info__actions">
          <button className="desktop-setting-row__action" type="button" disabled={props.updaterState.status === "checking"} onClick={props.onManualUpdateCheck}>업데이트 확인</button>
          <button className="desktop-setting-row__action" type="button" onClick={props.onOpenOnboarding}>처음 사용 안내 다시 보기</button>
        </div>
      </div>
    </section>
  );
}
