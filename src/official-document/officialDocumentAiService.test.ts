import { describe, expect, it, vi } from "vitest";
import { AI_CONNECTION_ERROR } from "../ai/aiConnectionService";
import {
  createOfficialDocumentAiService,
  createOfficialDocumentAiSendGate,
  evaluateOfficialDocumentOutbound,
  getOfficialDocumentAiActionLabel,
  getOfficialDocumentChatGptPlanActionLabel,
  nextOfficialDocumentAiRequestId,
  prepareOfficialDocumentAiSend,
  selectOfficialDocumentAiGenerator,
  OFFICIAL_DOCUMENT_AI_OUTBOUND_BYTE_LIMIT,
} from "./officialDocumentAiService";

describe("official document AI service", () => {
  it("reports disconnected without calling the gateway", async () => {
    const generateText = vi.fn();
    const service = createOfficialDocumentAiService({
      isAvailable: () => false,
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

  it.each([
    ["create" as const, "ChatGPT 요금제로 작성"],
    ["revision" as const, "ChatGPT 요금제로 작성"],
    ["summary" as const, "ChatGPT 요금제로 정리"],
  ])("uses ChatGPT plan action labels", (mode, expected) => {
    expect(getOfficialDocumentChatGptPlanActionLabel(mode)).toBe(expected);
  });

  it.each(["openai", "gemini"] as const)("generates through a connected %s provider", async (provider) => {
    const generateText = vi.fn(async () => "작성 결과");
    const service = createOfficialDocumentAiService({
      isAvailable: () => provider !== null,
      generateText,
    });
    await expect(service.generate("공문 프롬프트")).resolves.toBe("작성 결과");
    expect(generateText).toHaveBeenCalledWith("공문 프롬프트");
  });

  it("preserves normalized gateway errors", async () => {
    const service = createOfficialDocumentAiService({
      isAvailable: () => true,
      generateText: vi.fn(async () => { throw new Error(AI_CONNECTION_ERROR); }),
    });
    await expect(service.generate("공문 프롬프트")).rejects.toThrow(AI_CONNECTION_ERROR);
  });

  it("keeps explicitly selected plan and API routes isolated without fallback", async () => {
    const planGenerate = vi.fn(async () => { throw new Error("ChatGPT 요금제 사용 한도에 도달했습니다."); });
    const apiGenerate = vi.fn(async () => "API 결과");
    const planService = createOfficialDocumentAiService({ isAvailable: () => true, generateText: planGenerate });
    const apiService = createOfficialDocumentAiService({ isAvailable: () => true, generateText: apiGenerate });

    await expect(planService.generate("공문 프롬프트")).rejects.toThrow("ChatGPT 요금제 사용 한도");
    expect(planGenerate).toHaveBeenCalledOnce();
    expect(apiGenerate).not.toHaveBeenCalled();

    await expect(apiService.generate("공문 프롬프트")).resolves.toBe("API 결과");
    expect(apiGenerate).toHaveBeenCalledOnce();
    expect(planGenerate).toHaveBeenCalledOnce();
  });

  it("does not call the plan generator when the selected API route fails", async () => {
    const planGenerate = vi.fn(async () => "plan result");
    const apiGenerate = vi.fn(async () => { throw new Error(AI_CONNECTION_ERROR); });
    const selectedGenerator = selectOfficialDocumentAiGenerator("apiConnection", {
      apiConnection: apiGenerate,
      chatGptPlan: planGenerate,
    });
    const apiService = createOfficialDocumentAiService({ isAvailable: () => true, generateText: selectedGenerator });

    await expect(apiService.generate("공문 프롬프트")).rejects.toThrow(AI_CONNECTION_ERROR);
    expect(apiGenerate).toHaveBeenCalledOnce();
    expect(planGenerate).not.toHaveBeenCalled();
  });

  it("blocks every generator when the final reviewed outbound text contains privacy findings", () => {
    const planGenerate = vi.fn(async () => "plan");
    const apiGenerate = vi.fn(async () => "api");

    const plan = prepareOfficialDocumentAiSend({
      outboundText: "연락처 010-1234-5678",
      generate: planGenerate,
    });
    const api = prepareOfficialDocumentAiSend({
      outboundText: "연락처 010-1234-5678",
      generate: apiGenerate,
    });

    expect(plan.status).toBe("blocked");
    expect(api.status).toBe("blocked");
    expect(planGenerate).not.toHaveBeenCalled();
    expect(apiGenerate).not.toHaveBeenCalled();
  });

  it("prepares a safe prompt without sending until explicit confirmation", async () => {
    const generate = vi.fn(async () => "작성 결과");
    const prepared = prepareOfficialDocumentAiSend({
      outboundText: "공문 프롬프트",
      generate,
    });

    expect(prepared.status).toBe("ready");
    expect(generate).not.toHaveBeenCalled();
    if (prepared.status !== "ready") throw new Error("ready preparation expected");
    await expect(prepared.gate.confirm()).resolves.toBe("작성 결과");
    expect(generate).toHaveBeenCalledOnce();
  });

  it("counts the complete reviewed outbound prompt against the 64 KiB limit", () => {
    const outboundText = "가".repeat(OFFICIAL_DOCUMENT_AI_OUTBOUND_BYTE_LIMIT);
    const evaluation = evaluateOfficialDocumentOutbound(outboundText);
    expect(evaluation.bytes).toBe(new TextEncoder().encode(outboundText).byteLength);
    expect(evaluation.isWithinSizeLimit).toBe(false);
    expect(evaluation.canConfirm).toBe(false);
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
