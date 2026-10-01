export const aiProviders = ["openai", "gemini"] as const;
export type AiProvider = (typeof aiProviders)[number];

export const aiConnectionStatuses = ["disconnected", "checking", "connected", "failed"] as const;
export type AiConnectionStatus = (typeof aiConnectionStatuses)[number];

export type AiConnectionState = {
  readonly status: AiConnectionStatus;
  readonly provider: AiProvider | null;
  readonly model: string | null;
  readonly error: string | null;
  readonly canRetry: boolean;
};

export type AiConnectionInput = {
  readonly provider: AiProvider;
  readonly model: string;
  readonly apiKey: string;
};

export type AiGenerationInput = AiConnectionInput & {
  readonly prompt: string;
};

export type AiConnectionService = {
  readonly getState: () => AiConnectionState;
  readonly subscribe: (listener: (state: AiConnectionState) => void) => () => void;
  readonly connect: (input: AiConnectionInput) => Promise<void>;
  readonly validate: () => Promise<void>;
  readonly generateText: (prompt: string) => Promise<string>;
  readonly disconnect: () => void;
};
