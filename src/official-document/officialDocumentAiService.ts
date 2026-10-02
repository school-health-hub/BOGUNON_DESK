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
  privateSource,
  buildPrompt,
  generate,
}: {
  readonly privateSource: string;
  readonly buildPrompt: () => string;
  readonly generate: (prompt: string) => Promise<string>;
}): OfficialDocumentAiPreparation => {
  const privacy = inspectOfficialDocumentPrivacy(privateSource);
  if (!privacy.isSafe) {
    return {
      status: "blocked",
      error: `민감한 개인정보 가능성이 있습니다: ${privacy.findings.join(", ")}. 내용을 제거한 뒤 다시 시도해 주세요.`,
    };
  }
  const prompt = buildPrompt();
  return {
    status: "ready",
    prompt,
    gate: createOfficialDocumentAiSendGate(prompt, generate),
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
