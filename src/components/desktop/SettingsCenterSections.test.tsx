import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AiSettingsSection, DeviceSettingsSection } from "./SettingsCenterSections";
import type { ChatGptConnectionState } from "../../chatgpt/types";
import type { DesktopUpdaterState } from "../../updater/updaterTypes";

const idleUpdaterState: DesktopUpdaterState = { status: "idle", lastCheckedAt: null };

const renderDeviceSettings = (overrides: Partial<Parameters<typeof DeviceSettingsSection>[0]> = {}) =>
  renderToStaticMarkup(<DeviceSettingsSection
    autostart={false}
    deviceSettings={{ closeToTray: true, workPortalUrl: null, workPortalAutoOpenDelay: "off", workspaceNotificationsEnabled: false, workspaceNotificationReasons: { overdue: true, dueToday: true, followUp: true, needsCheck: true } }}
    workFolderFavorites={[]}
    onAddWorkFolder={() => undefined}
    onDeleteWorkFolder={() => undefined}
    onMoveWorkFolder={() => undefined}
    onOpenWorkFolder={() => undefined}
    onRenameWorkFolder={() => undefined}
    isEditingWorkPortal={false}
    isLoadingAutostart={false}
    isSaving={false}
    workPortalDraft=""
    onAutostartChange={vi.fn()}
    onCancelWorkPortal={vi.fn()}
    onCloseToTrayChange={vi.fn()}
    onEditWorkPortal={vi.fn()}
    onOpenWorkPortal={vi.fn()}
    onSaveWorkPortal={vi.fn()}
    onWorkPortalDraftChange={vi.fn()}
    onWorkPortalAutoOpenDelayChange={vi.fn()}
    onWorkspaceNotificationsChange={vi.fn()}
    onWorkspaceNotificationReasonChange={vi.fn()}
    onTestNotification={vi.fn()}
    appVersion="0.1.0"
    updaterState={idleUpdaterState}
    onManualUpdateCheck={vi.fn()}
    onOpenOnboarding={vi.fn()}
    {...overrides}
  />);

describe("device settings work portal UI", () => {
  it("shows an unset device-only launcher with settings and open actions", () => {
    const markup = renderDeviceSettings();
    expect(markup).toContain("PC 업무 실행");
    expect(markup).toContain("업무포털");
    expect(markup).toContain("미설정");
    expect(markup).toContain("URL 설정");
    expect(markup).toContain("열기");
  });

  it("shows opt-in Windows notifications with privacy guidance", () => {
    const markup = renderDeviceSettings();
    expect(markup).toContain("Windows 알림");
    expect(markup).toContain("업무 알림");
    expect(markup).toContain("하루 한 번 요약");
    expect(markup).toContain("업무 제목이나 상세 내용은 Windows 알림에 표시하지 않습니다.");
    expect(markup).toContain("테스트 알림");
    expect(markup).toContain("마감 지남");
    expect(markup).toContain("오늘 마감");
    expect(markup).toContain("후속 확인");
    expect(markup).toContain("확인 필요");
    expect(markup).toContain("<fieldset class=\"desktop-settings__notification-reasons\" disabled=\"\"");
  });

  it("shows the URL editor, privacy guidance, save, and cancel controls", () => {
    const markup = renderDeviceSettings({ isEditingWorkPortal: true });
    expect(markup).toContain('type="url"');
    expect(markup).toContain("이 주소는 이 PC에만 저장됩니다.");
    expect(markup).toContain("로그인 정보가 포함된 주소는 저장하지 마세요.");
    expect(markup).toContain("취소");
    expect(markup).toContain("저장");
  });

  it("shows all device-only auto-open delay choices inside the portal group", () => {
    const markup = renderDeviceSettings();
    expect(markup).toContain("자동 열기");
    expect(markup).toContain("사용 안 함");
    expect(markup).toContain("BOGUNON DESK 시작 20초 후");
    expect(markup).toContain("BOGUNON DESK 시작 45초 후");
    expect(markup).toContain("이 PC에서 한 번만 업무포털을 엽니다.");
  });

  it("shows the shareable beta version and onboarding replay action", () => {
    const markup = renderDeviceSettings();
    expect(markup).toContain("현재 버전 0.1.0 · 공유 베타");
    expect(markup).toContain("업데이트 확인");
    expect(markup).toContain("처음 사용 안내 다시 보기");
  });
});

describe("AI settings UI", () => {
  const renderAiSettings = (status: "disconnected" | "checking" | "connected" | "failed") =>
    renderToStaticMarkup(<AiSettingsSection
      apiKey={status === "disconnected" ? "" : "fake-key"}
      chatGptState={{
        status: "disconnected",
        email: null,
        displayName: null,
        planUsageEnabled: false,
        clientRegistrationExists: false,
        showPlanUsageNotice: false,
        notice: null,
        isLoading: false,
        isSigningIn: false,
        isDisconnecting: false,
        error: null,
      }}
      chatGptModels={[]}
      chatGptSelectedModel={null}
      chatGptModelsLoading={false}
      chatGptModelsError={null}
      model="gpt-5.6-luna"
      provider="openai"
      state={{
        status,
        provider: status === "disconnected" ? null : "openai",
        model: status === "disconnected" ? null : "gpt-5.6-luna",
        error: status === "failed" ? "API Key를 확인해 주세요." : null,
        canRetry: status === "connected",
      }}
      onApiKeyChange={vi.fn()}
      onChatGptDisconnect={vi.fn()}
      onChatGptSignIn={vi.fn()}
      onChatGptModelChange={vi.fn()}
      onChatGptRefreshModels={vi.fn()}
      onConnect={vi.fn()}
      onDisconnect={vi.fn()}
      onModelChange={vi.fn()}
      onProviderChange={vi.fn()}
      onValidate={vi.fn()}
    />);

  it("shows provider, allowlisted models, password input, and optional guidance", () => {
    const markup = renderAiSettings("disconnected");
    expect(markup).toContain("AI 서비스 연결");
    expect(markup).toContain("OpenAI");
    expect(markup).toContain("GPT-5.6 Luna");
    expect(markup).toContain('type="password"');
    expect(markup).toContain("API Key는 저장되지 않으며 현재 앱을 실행하는 동안에만 메모리에 유지됩니다.");
    expect(markup).toContain("ChatGPT 계정");
    expect(markup).toContain("ChatGPT 계정을 연결하면 지원되는 AI 기능에 ChatGPT 요금제를 사용할 수 있습니다.");
    expect(markup).toContain("Continue with ChatGPT");
    expect(markup.indexOf("ChatGPT 계정")).toBeLessThan(markup.indexOf("API Key 방식(OpenAI/Gemini)"));
  });

  it("masks the key and shows validation and disconnect actions when connected", () => {
    const markup = renderAiSettings("connected");
    expect(markup).toContain("OpenAI 연결됨");
    expect(markup).toContain("••••••••••••");
    expect(markup).not.toContain("fake-key");
    expect(markup).toContain("연결 상태 확인");
    expect(markup).toContain("연결 해제");
    expect(markup).toContain("API Key 방식(OpenAI/Gemini)");
    expect(markup).toContain('id="ai-provider"');
    expect(markup).toContain('id="ai-model"');
    expect(markup).toContain('id="ai-api-key"');
  });

  it("shows connected ChatGPT account state without credential fields", () => {
    const chatGptState: ChatGptConnectionState = {
      status: "connected",
      email: "teacher@example.test",
      displayName: "Teacher",
      planUsageEnabled: true,
      clientRegistrationExists: true,
      showPlanUsageNotice: true,
      notice: null,
      isLoading: false,
      isSigningIn: false,
      isDisconnecting: false,
      error: null,
    };
    const markup = renderToStaticMarkup(<AiSettingsSection
      apiKey=""
      chatGptState={chatGptState}
      chatGptModels={[]}
      chatGptSelectedModel={null}
      chatGptModelsLoading={false}
      chatGptModelsError={null}
      model="gpt-5.6-luna"
      provider="openai"
      state={{ status: "disconnected", provider: null, model: null, error: null, canRetry: false }}
      onApiKeyChange={vi.fn()}
      onChatGptDisconnect={vi.fn()}
      onChatGptSignIn={vi.fn()}
      onChatGptModelChange={vi.fn()}
      onChatGptRefreshModels={vi.fn()}
      onConnect={vi.fn()}
      onDisconnect={vi.fn()}
      onModelChange={vi.fn()}
      onProviderChange={vi.fn()}
      onValidate={vi.fn()}
    />);

    expect(markup).toContain("teacher@example.test");
    expect(markup).toContain("ChatGPT 요금제 사용: 사용 가능");
    expect(markup).toContain("ChatGPT 요금제를 사용 중입니다.");
    expect(markup).not.toMatch(/accessToken|refreshToken|idToken|authorizationCode|pkce/i);
  });
});
