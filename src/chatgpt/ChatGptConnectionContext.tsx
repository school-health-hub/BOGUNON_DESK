import {
  createContext,
  type ReactNode,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createChatGptConnectionService,
  disconnectedChatGptState,
} from "./chatgptConnectionService";
import { loadSelectedChatGptModel, saveSelectedChatGptModel } from "./chatgptModelPreference";
import { chatGptPlanService, normalizeChatGptPlanError } from "./chatgptPlanService";
import type {
  ChatGptConnectionService,
  ChatGptConnectionState,
  ChatGptModel,
  ChatGptPlanError,
  ChatGptPlanService,
} from "./types";

type ChatGptConnectionContextValue = {
  readonly state: ChatGptConnectionState;
  readonly refresh: () => Promise<void>;
  readonly startSignIn: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
  readonly models: readonly ChatGptModel[];
  readonly selectedModel: string | null;
  readonly modelsLoading: boolean;
  readonly modelsError: ChatGptPlanError | null;
  readonly setSelectedModel: (model: string) => void;
  readonly refreshModels: () => Promise<void>;
  readonly generateText: (prompt: string) => Promise<string>;
};

const ChatGptConnectionContext = createContext<ChatGptConnectionContextValue | null>(null);

type ChatGptConnectionProviderProps = {
  readonly children: ReactNode;
  readonly createService?: () => ChatGptConnectionService;
  readonly planService?: ChatGptPlanService;
  readonly loadSelectedModel?: () => string | null;
  readonly saveSelectedModel?: (model: string | null) => void;
};

export const runChatGptPlanOperation = async <Result,>(
  operation: () => Promise<Result>,
  connectionService: ChatGptConnectionService,
  onReauthentication: () => void,
): Promise<Result> => {
  try {
    return await operation();
  } catch (error: unknown) {
    if (normalizeChatGptPlanError(error).code === "reauthenticationRequired") {
      await connectionService.refresh();
      onReauthentication();
    }
    throw error;
  }
};

export function ChatGptConnectionProvider({
  children,
  createService = createChatGptConnectionService,
  planService = chatGptPlanService,
  loadSelectedModel = loadSelectedChatGptModel,
  saveSelectedModel = saveSelectedChatGptModel,
}: ChatGptConnectionProviderProps) {
  const [service] = useState(createService);
  const [state, setState] = useState<ChatGptConnectionState>(disconnectedChatGptState);
  const [models, setModels] = useState<readonly ChatGptModel[]>([]);
  const [selectedModel, setSelectedModelState] = useState<string | null>(loadSelectedModel);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<ChatGptPlanError | null>(null);

  useEffect(() => service.subscribe(setState), [service]);

  useEffect(() => {
    void service.refresh();
  }, [service]);

  const setSelectedModel = useCallback((model: string): void => {
    if (!models.some((item) => item.slug === model)) return;
    setSelectedModelState(model);
    saveSelectedModel(model);
  }, [models, saveSelectedModel]);

  const refreshModels = useCallback(async (): Promise<void> => {
    if (state.status !== "connected" || !state.planUsageEnabled) return;
    setModelsLoading(true);
    setModelsError(null);
    try {
      const nextModels = await runChatGptPlanOperation(
        planService.listModels,
        service,
        () => setModels([]),
      );
      setModels(nextModels);
      setSelectedModelState((current) => {
        const next = current !== null && nextModels.some((model) => model.slug === current)
          ? current
          : nextModels[0]?.slug ?? null;
        saveSelectedModel(next);
        return next;
      });
    } catch (error: unknown) {
      setModels([]);
      setModelsError(normalizeChatGptPlanError(error));
    } finally {
      setModelsLoading(false);
    }
  }, [planService, saveSelectedModel, service, state.planUsageEnabled, state.status]);

  useEffect(() => {
    if (state.status === "connected" && state.planUsageEnabled) {
      void refreshModels();
      return;
    }
    setModels([]);
    setModelsError(null);
    setModelsLoading(false);
  }, [refreshModels, state.email, state.planUsageEnabled, state.status]);

  const generateText = useCallback(async (prompt: string): Promise<string> => {
    if (state.status !== "connected" || !state.planUsageEnabled || selectedModel === null) {
      throw new Error("ChatGPT 모델을 선택해 주세요.");
    }
    return runChatGptPlanOperation(
      () => planService.generateText(selectedModel, prompt),
      service,
      () => setModels([]),
    );
  }, [planService, selectedModel, service, state.planUsageEnabled, state.status]);

  const value = useMemo<ChatGptConnectionContextValue>(() => ({
    state,
    refresh: service.refresh,
    startSignIn: service.startSignIn,
    disconnect: service.disconnect,
    models,
    selectedModel,
    modelsLoading,
    modelsError,
    setSelectedModel,
    refreshModels,
    generateText,
  }), [generateText, models, modelsError, modelsLoading, refreshModels, selectedModel, service, setSelectedModel, state]);

  return (
    <ChatGptConnectionContext.Provider value={value}>
      {children}
    </ChatGptConnectionContext.Provider>
  );
}

export const useChatGptConnection = (): ChatGptConnectionContextValue => {
  const value = useContext(ChatGptConnectionContext);
  if (value === null) throw new Error("ChatGptConnectionProvider가 필요합니다.");
  return value;
};
