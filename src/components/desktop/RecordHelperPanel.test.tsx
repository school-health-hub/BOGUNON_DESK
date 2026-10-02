import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatGptConnectionState, ChatGptModel, ChatGptPlanError } from "../../chatgpt/types";
import { RecordHelperAiOutput, RecordHelperPanel } from "./RecordHelperPanel";

const useChatGptConnectionMock = vi.hoisted(() => vi.fn());

vi.mock("../../chatgpt/ChatGptConnectionContext", () => ({
  useChatGptConnection: useChatGptConnectionMock,
}));

const disconnectedState: ChatGptConnectionState = {
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
};

const setChatGptConnection = ({
  state = disconnectedState,
  models = [],
  selectedModel = null,
  modelsLoading = false,
  modelsError = null,
}: {
  readonly state?: ChatGptConnectionState;
  readonly models?: readonly ChatGptModel[];
  readonly selectedModel?: string | null;
  readonly modelsLoading?: boolean;
  readonly modelsError?: ChatGptPlanError | null;
} = {}): void => {
  useChatGptConnectionMock.mockReturnValue({
    state,
    models,
    selectedModel,
    modelsLoading,
    modelsError,
    generateText: vi.fn(async () => "ChatGPT 요금제 결과"),
  });
};

const renderPanel = (): string => renderToStaticMarkup(
  <RecordHelperPanel onClose={vi.fn()} onOpenAiSettings={vi.fn()} />,
);

describe("RecordHelperPanel", () => {
  beforeEach(() => setChatGptConnection());

  it("renders the local workspace and privacy guidance", () => {
    const markup = renderPanel();

    expect(markup).toContain("생기부 도우미");
    expect(markup).toContain("비식별 활동·관찰 메모를 정리해 기록 문구를 준비합니다.");
    expect(markup).toContain("비식별 활동·관찰 메모");
    expect(markup).toContain("작성 요청 / 강조할 점");
    expect(markup).toContain("학생 이름·학번·연락처·건강정보 등 개인을 식별할 수 있는 정보는 입력하지 마세요.");
    expect(markup).toContain("자동 개인정보 검사는 보조 기능이며 모든 정보를 탐지하지 못할 수 있습니다.");
    expect(markup).toContain("입력 내용 점검");
  });

  it("shows settings without an AI action while ChatGPT plan is unavailable", () => {
    const markup = renderPanel();

    expect(markup).toContain("ChatGPT 요금제가 연결되지 않았습니다.");
    expect(markup).toContain("AI 연결 설정");
    expect(markup).not.toContain("ChatGPT 요금제로 작성");
  });

  it("shows the ChatGPT plan action only for a selected catalog model", () => {
    setChatGptConnection({
      state: { ...disconnectedState, status: "connected", planUsageEnabled: true },
      models: [{ slug: "gpt-account-model", displayName: "GPT Account Model" }],
      selectedModel: "gpt-account-model",
    });
    const markup = renderPanel();

    expect(markup).toContain("ChatGPT 요금제 연결됨 · GPT Account Model");
    expect(markup).toContain("ChatGPT 요금제로 작성");
    expect(markup).not.toContain("AI 연결 설정");
  });

  it("keeps the action hidden when plan usage is disabled on a connected account", () => {
    setChatGptConnection({
      state: { ...disconnectedState, status: "connected", planUsageEnabled: false },
      models: [{ slug: "gpt-account-model", displayName: "GPT Account Model" }],
      selectedModel: "gpt-account-model",
    });
    const markup = renderPanel();

    expect(markup).toContain("ChatGPT 요금제가 연결되지 않았습니다.");
    expect(markup).not.toContain("ChatGPT 요금제로 작성");
  });

  it.each([
    [{ modelsLoading: true, modelsError: null, selectedModel: "gpt-account-model" }, "ChatGPT 모델을 준비 중입니다."],
    [{ modelsLoading: false, modelsError: { code: "temporaryFailure", message: "모델 목록 오류" }, selectedModel: "gpt-account-model" }, "모델 목록 오류"],
    [{ modelsLoading: false, modelsError: null, selectedModel: null }, "ChatGPT 모델을 선택해 주세요."],
    [{ modelsLoading: false, modelsError: null, selectedModel: "stale-model" }, "ChatGPT 모델을 선택해 주세요."],
  ] as const)("keeps the action hidden for unavailable model state", (modelState, message) => {
    setChatGptConnection({
      state: { ...disconnectedState, status: "connected", planUsageEnabled: true },
      models: [{ slug: "gpt-account-model", displayName: "GPT Account Model" }],
      selectedModel: modelState.selectedModel,
      modelsLoading: modelState.modelsLoading,
      modelsError: modelState.modelsError,
    });
    const markup = renderPanel();

    expect(markup).toContain(message);
    expect(markup).not.toContain("ChatGPT 요금제로 작성");
  });

  it("renders AI output and teacher review guidance without credential fields", () => {
    const markup = renderToStaticMarkup(<RecordHelperAiOutput response="가상 AI 초안" />);

    expect(markup).toContain("가상 AI 초안");
    expect(markup).toContain("실제 학생부 입력 전 교사가 사실관계와 표현을 확인해 주세요.");
    expect(markup).not.toMatch(/accessToken|refreshToken|idToken|Authorization/);
  });
});
