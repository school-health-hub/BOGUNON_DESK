import type { AiProvider } from "../ai/types";
import { inspectOfficialDocumentPrivacy } from "./privacyGuard";
import type { OfficialDocumentMode } from "./types";

type OfficialDocumentAiDependencies = {
  readonly isAvailable: () => boolean;
  readonly generateText: (prompt: string) => Promise<string>;
};

export type OfficialDocumentAiService = {
  readonly generate: (prompt: string) => Promise<string>;
};

export type OfficialDocumentAiRoute = "apiConnection" | "chatGptPlan";

export type OfficialDocumentAiSendGate = {
  readonly confirm: () => Promise<string | null>;
  readonly cancel: () => void;
};

type OfficialDocumentAiPreparation =
  | { readonly status: "blocked"; readonly error: string }
  | { readonly status: "ready"; readonly prompt: string; readonly gate: OfficialDocumentAiSendGate };

let officialDocumentAiRequestSequence = 0;

export const OFFICIAL_DOCUMENT_AI_OUTBOUND_BYTE_LIMIT = 64 * 1024;

export type OfficialDocumentOutboundEvaluation = {
  readonly bytes: number;
  readonly canConfirm: boolean;
  readonly findings: readonly string[];
  readonly isWithinSizeLimit: boolean;
};

export const evaluateOfficialDocumentOutbound = (outboundText: string): OfficialDocumentOutboundEvaluation => {
  const privacy = inspectOfficialDocumentPrivacy(outboundText);
  const bytes = new TextEncoder().encode(outboundText).byteLength;
  const isWithinSizeLimit = bytes <= OFFICIAL_DOCUMENT_AI_OUTBOUND_BYTE_LIMIT;
  return {
    bytes,
    canConfirm: outboundText.trim() !== "" && privacy.isSafe && isWithinSizeLimit,
    findings: privacy.findings,
    isWithinSizeLimit,
  };
};

export const nextOfficialDocumentAiRequestId = (): number => {
  officialDocumentAiRequestSequence += 1;
  return officialDocumentAiRequestSequence;
};

export const createOfficialDocumentAiSendGate = (
  prompt: string,
  generate: (prompt: string) => Promise<string>,
): OfficialDocumentAiSendGate => {
  let pending = true;
  return {
    confirm: async () => {
      if (!pending) return null;
      pending = false;
      return generate(prompt);
    },
    cancel: () => {
      pending = false;
    },
  };
};

export const prepareOfficialDocumentAiSend = ({
  outboundText,
  generate,
}: {
  readonly outboundText: string;
  readonly generate: (prompt: string) => Promise<string>;
}): OfficialDocumentAiPreparation => {
  const evaluation = evaluateOfficialDocumentOutbound(outboundText);
  if (!evaluation.canConfirm) {
    const error = evaluation.findings.length > 0
      ? `민감한 개인정보 가능성이 있습니다: ${evaluation.findings.join(", ")}. 내용을 제거한 뒤 다시 시도해 주세요.`
      : evaluation.isWithinSizeLimit
        ? "AI로 보낼 내용을 입력해 주세요."
        : `AI 전송 내용이 너무 큽니다. ${evaluation.bytes.toLocaleString()} / ${OFFICIAL_DOCUMENT_AI_OUTBOUND_BYTE_LIMIT.toLocaleString()} bytes`;
    return {
      status: "blocked",
      error,
    };
  }
  return {
    status: "ready",
    prompt: outboundText,
    gate: createOfficialDocumentAiSendGate(outboundText, generate),
  };
};

export const getOfficialDocumentAiActionLabel = (
  provider: AiProvider,
  mode: OfficialDocumentMode,
): string => `${provider === "openai" ? "OpenAI" : "Gemini"} 연결하여 ${mode === "summary" ? "정리" : "작성"}`;

export const getOfficialDocumentChatGptPlanActionLabel = (
  mode: OfficialDocumentMode,
): string => `ChatGPT 요금제로 ${mode === "summary" ? "정리" : "작성"}`;

export const selectOfficialDocumentAiGenerator = (
  route: OfficialDocumentAiRoute,
  generators: Readonly<Record<OfficialDocumentAiRoute, (prompt: string) => Promise<string>>>,
): ((prompt: string) => Promise<string>) => generators[route];

export const createOfficialDocumentAiService = (
  dependencies: OfficialDocumentAiDependencies,
): OfficialDocumentAiService => ({
  generate: async (prompt) => {
    if (!dependencies.isAvailable()) {
      throw new Error("AI 서비스가 연결되지 않았습니다.");
    }
    return dependencies.generateText(prompt);
  },
});
