import type {
  ChatGptConnectionStatus,
  ChatGptModel,
  ChatGptPlanError,
} from "../chatgpt/types";
import { inspectRecordHelperPrivacy } from "./privacyGuard";
import { inspectRecordHelperSensitiveContent } from "./deidentification";
import { buildRecordHelperReportPrompt, type RecordHelperPromptInput } from "./promptBuilder";

export type RecordHelperAiSendGate = {
  readonly confirm: () => Promise<string | null>;
  readonly cancel: () => void;
};

export type RecordHelperAiPreparation =
  | { readonly status: "empty" }
  | { readonly status: "blocked"; readonly findings: readonly string[] }
  | { readonly status: "ready"; readonly prompt: string; readonly gate: RecordHelperAiSendGate };

type RecordHelperChatGptPlanAvailabilityInput = {
  readonly status: ChatGptConnectionStatus;
  readonly planUsageEnabled: boolean;
  readonly models: readonly ChatGptModel[];
  readonly selectedModel: string | null;
  readonly modelsLoading: boolean;
  readonly modelsError: ChatGptPlanError | null;
};

export type RecordHelperChatGptPlanAvailability = {
  readonly isAvailable: boolean;
  readonly selectedModel: ChatGptModel | null;
  readonly message: string;
};

let recordHelperAiRequestSequence = 0;

export const RECORD_HELPER_EMPTY_AI_RESPONSE_ERROR =
  "ChatGPT 응답에 표시할 내용이 없습니다. 다시 시도해 주세요.";
export const RECORD_HELPER_AI_OUTBOUND_BYTE_LIMIT = 64 * 1024;
export const RECORD_HELPER_SENSITIVE_BLOCKER = "AI로 보내지 않아야 할 민감정보가 남아 있습니다.";

export type RecordHelperOutboundEvaluation = {
  readonly prompt: string;
  readonly bytes: number;
  readonly blockers: readonly string[];
  readonly isWithinSizeLimit: boolean;
  readonly canConfirm: boolean;
};

export const evaluateRecordHelperOutbound = (reportText: string, teacherMemo: string): RecordHelperOutboundEvaluation => {
  const bytes = new TextEncoder().encode(reportText).byteLength + new TextEncoder().encode(teacherMemo).byteLength;
  const blockers = inspectRecordHelperSensitiveContent(`${reportText}\n${teacherMemo}`);
  const isWithinSizeLimit = bytes <= RECORD_HELPER_AI_OUTBOUND_BYTE_LIMIT;
  return {
    prompt: buildRecordHelperReportPrompt({ reportText, teacherMemo }),
    bytes,
    blockers,
    isWithinSizeLimit,
    canConfirm: reportText.trim() !== "" && blockers.length === 0 && isWithinSizeLimit,
  };
};

export const nextRecordHelperAiRequestId = (): number => {
  recordHelperAiRequestSequence += 1;
  return recordHelperAiRequestSequence;
};

export const createRecordHelperAiSendGate = (
  prompt: string,
  generate: (prompt: string) => Promise<string>,
): RecordHelperAiSendGate => {
  let pending = true;
  return {
    confirm: async () => {
      if (!pending) return null;
      pending = false;
      const response = await generate(prompt);
      if (response.trim() === "") throw new Error(RECORD_HELPER_EMPTY_AI_RESPONSE_ERROR);
      return response;
    },
    cancel: () => {
      pending = false;
    },
  };
};

export const prepareRecordHelperAiSend = ({
  activityMemo,
  writingRequest,
  buildPrompt,
  generate,
}: RecordHelperPromptInput & {
  readonly buildPrompt: (input: RecordHelperPromptInput) => string;
  readonly generate: (prompt: string) => Promise<string>;
}): RecordHelperAiPreparation => {
  if (activityMemo.trim() === "") {
    return { status: "empty" };
  }
  const privacy = inspectRecordHelperPrivacy(`${activityMemo}\n${writingRequest}`);
  if (!privacy.isSafe) {
    return {
      status: "blocked",
      findings: privacy.findings,
    };
  }
  const prompt = buildPrompt({ activityMemo, writingRequest });
  return {
    status: "ready",
    prompt,
    gate: createRecordHelperAiSendGate(prompt, generate),
  };
};

export const resolveRecordHelperChatGptPlanAvailability = ({
  status,
  planUsageEnabled,
  models,
  selectedModel,
  modelsLoading,
  modelsError,
}: RecordHelperChatGptPlanAvailabilityInput): RecordHelperChatGptPlanAvailability => {
  const catalogModel = selectedModel === null
    ? null
    : models.find((model) => model.slug === selectedModel) ?? null;
  if (status !== "connected" || !planUsageEnabled) {
    return { isAvailable: false, selectedModel: null, message: "ChatGPT 요금제가 연결되지 않았습니다." };
  }
  if (modelsLoading) {
    return { isAvailable: false, selectedModel: null, message: "ChatGPT 모델을 준비 중입니다." };
  }
  if (modelsError !== null) {
    return { isAvailable: false, selectedModel: null, message: modelsError.message };
  }
  if (catalogModel === null) {
    return { isAvailable: false, selectedModel: null, message: "ChatGPT 모델을 선택해 주세요." };
  }
  return {
    isAvailable: true,
    selectedModel: catalogModel,
    message: `ChatGPT 요금제 연결됨 · ${catalogModel.displayName}`,
  };
};
