import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getDefaultAiModel } from "./config";
import { createAiConnectionService } from "./aiConnectionService";
import type { AiConnectionService, AiConnectionState, AiProvider } from "./types";

type AiConnectionContextValue = {
  readonly state: AiConnectionState;
  readonly provider: AiProvider;
  readonly model: string;
  readonly apiKey: string;
  readonly setProvider: (provider: AiProvider) => void;
  readonly setModel: (model: string) => void;
  readonly setApiKey: (apiKey: string) => void;
  readonly connect: () => Promise<void>;
  readonly validate: () => Promise<void>;
  readonly generateText: (prompt: string) => Promise<string>;
  readonly disconnect: () => void;
};

const AiConnectionContext = createContext<AiConnectionContextValue | null>(null);

export const createAiProviderDraft = (provider: AiProvider) => ({
  provider,
  model: getDefaultAiModel(provider),
  apiKey: "",
} as const);

type AiConnectionProviderProps = {
  readonly children: ReactNode;
  readonly createService?: () => AiConnectionService;
};

export function AiConnectionProvider({
  children,
  createService = createAiConnectionService,
}: AiConnectionProviderProps) {
  const [service] = useState(createService);
  const [state, setState] = useState<AiConnectionState>(service.getState);
  const [provider, updateProvider] = useState<AiProvider>("openai");
  const [model, setModel] = useState(() => getDefaultAiModel("openai"));
  const [apiKey, setApiKey] = useState("");

  useEffect(() => service.subscribe(setState), [service]);

  const value = useMemo<AiConnectionContextValue>(() => ({
    state,
    provider,
    model,
    apiKey,
    setProvider: (nextProvider) => {
      const draft = createAiProviderDraft(nextProvider);
      updateProvider(draft.provider);
      setModel(draft.model);
      setApiKey(draft.apiKey);
    },
    setModel,
    setApiKey,
    connect: async () => {
      await service.connect({ provider, model, apiKey });
      if (service.getState().status === "connected") setApiKey("");
    },
    validate: () => service.validate(),
    generateText: (prompt) => service.generateText(prompt),
    disconnect: () => {
      service.disconnect();
      const draft = createAiProviderDraft("openai");
      updateProvider(draft.provider);
      setModel(draft.model);
      setApiKey(draft.apiKey);
    },
  }), [apiKey, model, provider, service, state]);

  return <AiConnectionContext.Provider value={value}>{children}</AiConnectionContext.Provider>;
}

export const useAiConnection = (): AiConnectionContextValue => {
  const value = useContext(AiConnectionContext);
  if (value === null) throw new Error("AiConnectionProvider가 필요합니다.");
  return value;
};
