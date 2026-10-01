import type { AiConnectionStatus, AiProvider } from "../ai/types";
import type { OfficialDocumentMode } from "./types";

type OfficialDocumentAiConnection = {
  readonly status: AiConnectionStatus;
  readonly provider: AiProvider | null;
};

type OfficialDocumentAiDependencies = {
  readonly getConnection: () => OfficialDocumentAiConnection;
  readonly generateText: (prompt: string) => Promise<string>;
};

export type OfficialDocumentAiService = {
  readonly generate: (prompt: string) => Promise<string>;
};

export type OfficialDocumentAiSendGate = {
  readonly confirm: () => Promise<string | null>;
  readonly cancel: () => void;
};

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

export const getOfficialDocumentAiActionLabel = (
  provider: AiProvider,
  mode: OfficialDocumentMode,
): string => `${provider === "openai" ? "OpenAI" : "Gemini"} 연결하여 ${mode === "summary" ? "정리" : "작성"}`;

export const createOfficialDocumentAiService = (
  dependencies: OfficialDocumentAiDependencies,
): OfficialDocumentAiService => ({
  generate: async (prompt) => {
    const connection = dependencies.getConnection();
    if (connection.status !== "connected" || connection.provider === null) {
      throw new Error("AI 서비스가 연결되지 않았습니다.");
    }
    return dependencies.generateText(prompt);
  },
});
