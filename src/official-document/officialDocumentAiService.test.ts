import { describe, expect, it, vi } from "vitest";
import { AI_CONNECTION_ERROR } from "../ai/aiConnectionService";
import {
  createOfficialDocumentAiService,
  createOfficialDocumentAiSendGate,
  getOfficialDocumentAiActionLabel,
  nextOfficialDocumentAiRequestId,
} from "./officialDocumentAiService";

describe("official document AI service", () => {
  it("reports disconnected without calling the gateway", async () => {
    const generateText = vi.fn();
    const service = createOfficialDocumentAiService({
      getConnection: () => ({ status: "disconnected", provider: null }),
      generateText,
    });
    await expect(service.generate("공문 프롬프트")).rejects.toThrow("AI 서비스가 연결되지 않았습니다.");
    expect(generateText).not.toHaveBeenCalled();
  });

  it.each([
    ["openai" as const, "create" as const, "OpenAI 연결하여 작성"],
    ["gemini" as const, "create" as const, "Gemini 연결하여 작성"],
    ["openai" as const, "summary" as const, "OpenAI 연결하여 정리"],
    ["gemini" as const, "summary" as const, "Gemini 연결하여 정리"],
  ])("uses provider-specific action labels", (provider, mode, expected) => {
    expect(getOfficialDocumentAiActionLabel(provider, mode)).toBe(expected);
  });

  it.each(["openai", "gemini"] as const)("generates through a connected %s provider", async (provider) => {
    const generateText = vi.fn(async () => "작성 결과");
    const service = createOfficialDocumentAiService({
      getConnection: () => ({ status: "connected", provider }),
      generateText,
    });
    await expect(service.generate("공문 프롬프트")).resolves.toBe("작성 결과");
    expect(generateText).toHaveBeenCalledWith("공문 프롬프트");
  });

  it("preserves normalized gateway errors", async () => {
    const service = createOfficialDocumentAiService({
      getConnection: () => ({ status: "connected", provider: "openai" }),
      generateText: vi.fn(async () => { throw new Error(AI_CONNECTION_ERROR); }),
    });
    await expect(service.generate("공문 프롬프트")).rejects.toThrow(AI_CONNECTION_ERROR);
  });

  it("does not send until the user confirms and sends exactly once after confirmation", async () => {
    const generate = vi.fn(async () => "작성 결과");
    const gate = createOfficialDocumentAiSendGate("자동 탐지에 걸리지 않은 원문", generate);

    expect(generate).not.toHaveBeenCalled();
    await expect(gate.confirm()).resolves.toBe("작성 결과");
    expect(generate).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith("자동 탐지에 걸리지 않은 원문");
  });

  it("does not send after the confirmation is cancelled", async () => {
    const generate = vi.fn(async () => "작성 결과");
    const gate = createOfficialDocumentAiSendGate("공문 프롬프트", generate);

    gate.cancel();

    await expect(gate.confirm()).resolves.toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });

  it("issues distinct request IDs across panel lifecycles", () => {
    const firstPanelRequest = nextOfficialDocumentAiRequestId();
    const reopenedPanelRequest = nextOfficialDocumentAiRequestId();

    expect(reopenedPanelRequest).toBeGreaterThan(firstPanelRequest);
  });
});
