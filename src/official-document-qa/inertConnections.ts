import type { AiConnectionService } from "../ai/types";
import type { ChatGptConnectionService, ChatGptPlanService } from "../chatgpt/types";

const disabled = async (): Promise<never> => {
  throw new Error("격리 QA에서는 외부 AI 연결을 사용할 수 없습니다.");
};

const aiService: AiConnectionService = {
  getState: () => ({ status: "disconnected", provider: null, model: null, error: null, canRetry: false }),
  subscribe: () => () => undefined,
  connect: disabled,
  validate: disabled,
  generateText: disabled,
  disconnect: () => undefined,
};

const chatGptService: ChatGptConnectionService = {
  getState: () => ({
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
  }),
  subscribe: () => () => undefined,
  refresh: async () => undefined,
  startSignIn: disabled,
  disconnect: disabled,
};

const chatGptPlanService: ChatGptPlanService = {
  listModels: async () => [],
  generateText: disabled,
};

export const useAiConnection = () => ({
  state: aiService.getState(),
  provider: "openai" as const,
  model: "",
  apiKey: "",
  setProvider: () => undefined,
  setModel: () => undefined,
  setApiKey: () => undefined,
  connect: () => aiService.connect({ provider: "openai", model: "", apiKey: "" }),
  validate: aiService.validate,
  generateText: aiService.generateText,
  disconnect: aiService.disconnect,
});

export const useChatGptConnection = () => ({
  state: chatGptService.getState(),
  refresh: chatGptService.refresh,
  startSignIn: chatGptService.startSignIn,
  disconnect: chatGptService.disconnect,
  models: [],
  selectedModel: null,
  modelsLoading: false,
  modelsError: null,
  setSelectedModel: () => undefined,
  refreshModels: async () => undefined,
  generateText: (prompt: string) => chatGptPlanService.generateText("", prompt),
});
