import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  ChatGptModel,
  ChatGptPlanError,
  ChatGptPlanErrorCode,
  ChatGptPlanService,
} from "./types";

const ERROR_MESSAGES: Readonly<Record<ChatGptPlanErrorCode, string>> = {
  reauthenticationRequired: "ChatGPT 계정을 다시 연결해 주세요.",
  accessDenied: "현재 계정 또는 지역에서는 ChatGPT 요금제 요청을 사용할 수 없습니다.",
  usageLimitExceeded: "ChatGPT 요금제 사용 한도에 도달했거나 현재 사용할 수 없습니다.",
  usageUnavailable: "현재 ChatGPT 요금제 사용량을 사용할 수 없습니다.",
  rateLimited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  temporaryFailure: "ChatGPT 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.",
  invalidResponse: "ChatGPT 응답을 확인할 수 없습니다.",
  unavailable: "ChatGPT 요금제 기능을 사용할 수 없습니다.",
};

export class ChatGptPlanRequestError extends Error {
  readonly code: ChatGptPlanErrorCode;

  constructor(code: ChatGptPlanErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "ChatGptPlanRequestError";
    this.code = code;
  }
}

const readErrorCode = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return "";
};

export const normalizeChatGptPlanError = (error: unknown): ChatGptPlanError => {
  if (error instanceof ChatGptPlanRequestError) {
    return { code: error.code, message: error.message };
  }
  const code = readErrorCode(error).toLowerCase();
  const normalizedCode: ChatGptPlanErrorCode = code === "reauthenticationrequired"
    ? "reauthenticationRequired"
    : code === "permissiondenied"
      ? "accessDenied"
      : code === "usagelimitexceeded"
        ? "usageLimitExceeded"
        : code === "usageunavailable"
          ? "usageUnavailable"
          : code === "ratelimited"
            ? "rateLimited"
            : code === "temporaryfailure"
              ? "temporaryFailure"
              : code === "invalidresponse"
                ? "invalidResponse"
                : code.includes("subscription_sharing_usage_unavailable")
                  ? "usageUnavailable"
                  : code.includes("subscription_sharing_usage")
                    ? "usageLimitExceeded"
    : code.includes("invalid_grant") || code.includes("refresh_token") || code.includes("401")
      ? "reauthenticationRequired"
      : code.includes("403") || code.includes("permission") || code.includes("admission")
        ? "accessDenied"
        : code.includes("429") || code.includes("rate_limit")
          ? "rateLimited"
          : code.includes("500") || code.includes("502") || code.includes("503") || code.includes("504") || code.includes("network")
            ? "temporaryFailure"
            : code.includes("malformed") || code.includes("invalid_response")
              ? "invalidResponse"
              : "unavailable";
  return { code: normalizedCode, message: ERROR_MESSAGES[normalizedCode] };
};

const parseModel = (value: unknown): ChatGptModel | null => {
  if (typeof value !== "object" || value === null) return null;
  if (!("slug" in value) || typeof value.slug !== "string" || value.slug.trim() === "") return null;
  if (!("displayName" in value) || typeof value.displayName !== "string" || value.displayName.trim() === "") return null;
  return { slug: value.slug, displayName: value.displayName };
};

export const parseChatGptModels = (value: unknown): readonly ChatGptModel[] => {
  if (!Array.isArray(value)) throw new ChatGptPlanRequestError("invalidResponse");
  const models = value.map(parseModel);
  if (models.some((model) => model === null)) throw new ChatGptPlanRequestError("invalidResponse");
  return models.filter((model): model is ChatGptModel => model !== null);
};

export const listChatGptModelsNative = async (): Promise<readonly ChatGptModel[]> => {
  if (!isTauri()) return [];
  try {
    return parseChatGptModels(await invoke<unknown>("chatgpt_list_models"));
  } catch (error: unknown) {
    const normalized = normalizeChatGptPlanError(error);
    throw new ChatGptPlanRequestError(normalized.code);
  }
};

export const generateChatGptTextNative = async (model: string, prompt: string): Promise<string> => {
  if (!isTauri()) throw new ChatGptPlanRequestError("unavailable");
  try {
    const result = await invoke<unknown>("chatgpt_generate_text", { model, prompt });
    if (typeof result !== "string") throw new ChatGptPlanRequestError("invalidResponse");
    return result;
  } catch (error: unknown) {
    const normalized = normalizeChatGptPlanError(error);
    throw new ChatGptPlanRequestError(normalized.code);
  }
};

export const chatGptPlanService = {
  listModels: listChatGptModelsNative,
  generateText: generateChatGptTextNative,
} as const satisfies ChatGptPlanService;
