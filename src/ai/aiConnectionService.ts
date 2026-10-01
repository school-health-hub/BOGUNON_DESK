import { invoke, isTauri } from "@tauri-apps/api/core";
import { isAllowedAiModel } from "./config";
import type {
  AiConnectionInput,
  AiConnectionService,
  AiConnectionState,
  AiGenerationInput,
} from "./types";

export const AI_AUTH_ERROR = "API Key를 확인해 주세요.";
export const AI_RATE_LIMIT_ERROR = "요청 한도를 확인해 주세요.";
export const AI_TIMEOUT_ERROR = "AI 연결 확인 시간이 초과되었습니다.";
export const AI_CONNECTION_ERROR = "AI 서비스에 연결하지 못했습니다.";
export const AI_NOT_CONNECTED_ERROR = "AI 서비스가 연결되지 않았습니다.";

const knownErrors = new Set([
  AI_AUTH_ERROR,
  AI_RATE_LIMIT_ERROR,
  AI_TIMEOUT_ERROR,
  AI_CONNECTION_ERROR,
]);

export const normalizeAiConnectionError = (error: unknown): string => {
  const message = typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : "";
  return knownErrors.has(message) ? message : AI_CONNECTION_ERROR;
};

export type ValidateAiConnection = (input: AiConnectionInput) => Promise<void>;
export type GenerateAiText = (input: AiGenerationInput) => Promise<string>;

export const validateAiConnectionNative: ValidateAiConnection = async (input) => {
  if (!isTauri()) throw new Error(AI_CONNECTION_ERROR);
  await invoke("validate_ai_connection", input);
};

export const generateAiTextNative: GenerateAiText = async (input) => {
  if (!isTauri()) throw new Error(AI_CONNECTION_ERROR);
  return invoke<string>("generate_ai_text", input);
};

const disconnectedState: AiConnectionState = {
  status: "disconnected",
  provider: null,
  model: null,
  error: null,
  canRetry: false,
};

export const createAiConnectionService = (
  validateNative: ValidateAiConnection = validateAiConnectionNative,
  generateNative: GenerateAiText = generateAiTextNative,
): AiConnectionService => {
  let state = disconnectedState;
  let connection: AiConnectionInput | null = null;
  let validationSequence = 0;
  const listeners = new Set<(nextState: AiConnectionState) => void>();

  const publish = (nextState: AiConnectionState): void => {
    state = nextState;
    listeners.forEach((listener) => listener(state));
  };

  const runValidation = async (input: AiConnectionInput, retainOnFailure: boolean): Promise<void> => {
    const requestId = ++validationSequence;
    const apiKey = input.apiKey.trim();
    const candidate = { ...input, apiKey };
    publish({ status: "checking", provider: input.provider, model: input.model, error: null, canRetry: retainOnFailure });
    try {
      if (apiKey === "" || !isAllowedAiModel(input.provider, input.model)) {
        throw new Error(apiKey === "" ? AI_AUTH_ERROR : AI_CONNECTION_ERROR);
      }
      await validateNative(candidate);
      if (requestId !== validationSequence) return;
      connection = candidate;
      publish({ status: "connected", provider: input.provider, model: input.model, error: null, canRetry: true });
    } catch (error: unknown) {
      if (requestId !== validationSequence) return;
      if (!retainOnFailure) connection = null;
      publish({
        status: "failed",
        provider: input.provider,
        model: input.model,
        error: normalizeAiConnectionError(error),
        canRetry: retainOnFailure && connection !== null,
      });
    }
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect: (input) => runValidation(input, false),
    validate: async () => {
      if (connection === null) {
        publish({ ...disconnectedState, error: AI_CONNECTION_ERROR });
        return;
      }
      await runValidation(connection, true);
    },
    generateText: async (prompt) => {
      if (connection === null) throw new Error(AI_NOT_CONNECTED_ERROR);
      try {
        return await generateNative({ ...connection, prompt });
      } catch (error: unknown) {
        throw new Error(normalizeAiConnectionError(error));
      }
    },
    disconnect: () => {
      validationSequence += 1;
      connection = null;
      publish(disconnectedState);
    },
  };
};
