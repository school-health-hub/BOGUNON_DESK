import { describe, expect, it, vi } from "vitest";
import type { ChatGptModel } from "../chatgpt/types";
import {
  createRecordHelperAiSendGate,
  prepareRecordHelperAiSend,
  RECORD_HELPER_EMPTY_AI_RESPONSE_ERROR,
  resolveRecordHelperChatGptPlanAvailability,
  evaluateRecordHelperOutbound,
  RECORD_HELPER_AI_OUTBOUND_BYTE_LIMIT,
} from "./recordHelperAiService";

const models: readonly ChatGptModel[] = [
  { slug: "gpt-account-model", displayName: "GPT Account Model" },
];

describe("record helper AI send gate", () => {
  it("blocks privacy findings before prompt creation or generation", () => {
    const buildPrompt = vi.fn(() => "전송 프롬프트");
    const generate = vi.fn(async () => "결과");
    const prepared = prepareRecordHelperAiSend({
      activityMemo: "학생명: 김가상",
      writingRequest: "협업을 강조",
      buildPrompt,
      generate,
    });

    expect(prepared.status).toBe("blocked");
    expect(buildPrompt).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("checks the optional writing request before prompt creation", () => {
    const buildPrompt = vi.fn(() => "전송 프롬프트");
    const generate = vi.fn(async () => "결과");
    const prepared = prepareRecordHelperAiSend({
      activityMemo: "모둠 자료를 순서에 맞게 정리함.",
      writingRequest: "연락처: 가상 연락 정보",
      buildPrompt,
      generate,
    });

    expect(prepared.status).toBe("blocked");
    expect(buildPrompt).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects an empty activity memo before prompt creation", () => {
    const buildPrompt = vi.fn(() => "전송 프롬프트");
    const generate = vi.fn(async () => "결과");
    const prepared = prepareRecordHelperAiSend({
      activityMemo: "  ",
      writingRequest: "관찰 중심으로 정리",
      buildPrompt,
      generate,
    });

    expect(prepared.status).toBe("empty");
    expect(buildPrompt).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("prepares safe content without sending before confirmation", () => {
    const generate = vi.fn(async () => "결과");
    const prepared = prepareRecordHelperAiSend({
      activityMemo: "모둠 자료를 분류하고 발표 준비에 참여함.",
      writingRequest: "협업 과정을 중심으로 정리",
      buildPrompt: () => "전송 프롬프트",
      generate,
    });

    expect(prepared).toMatchObject({ status: "ready", prompt: "전송 프롬프트" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("sends exactly once after confirmation", async () => {
    const generate = vi.fn(async () => "결과");
    const gate = createRecordHelperAiSendGate("전송 프롬프트", generate);

    await expect(gate.confirm()).resolves.toBe("결과");
    await expect(gate.confirm()).resolves.toBeNull();
    expect(generate).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith("전송 프롬프트");
  });

  it("never sends after cancellation", async () => {
    const generate = vi.fn(async () => "결과");
    const gate = createRecordHelperAiSendGate("전송 프롬프트", generate);

    gate.cancel();
    await expect(gate.confirm()).resolves.toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });

  it("propagates the selected ChatGPT failure after exactly one generator call", async () => {
    const chatGptGenerate = vi.fn(async () => { throw new Error("요금제 요청 실패"); });
    const gate = createRecordHelperAiSendGate("전송 프롬프트", chatGptGenerate);

    await expect(gate.confirm()).rejects.toThrow("요금제 요청 실패");
    expect(chatGptGenerate).toHaveBeenCalledOnce();
  });

  it("turns an empty completed response into a visible error", async () => {
    const generate = vi.fn(async () => "   \n");
    const gate = createRecordHelperAiSendGate("전송 프롬프트", generate);

    await expect(gate.confirm()).rejects.toThrow(RECORD_HELPER_EMPTY_AI_RESPONSE_ERROR);
    expect(generate).toHaveBeenCalledOnce();
  });
});

describe("record helper report outbound evaluation", () => {
  it.each([
    ["phone", "010-1234-5678"],
    ["email", "test@example.com"],
    ["RRN", "900101-1234567"],
    ["labeled name", "학생명: 홍길동"],
    ["student number", "학번: 20261234"],
    ["grade class number", "2학년 3반 15번"],
  ])("blocks %s reintroduced into the final outbound copy", (_label, identityText) => {
    const evaluation = evaluateRecordHelperOutbound(`자료 조사 결과\n${identityText}`, "");
    expect(evaluation.identityFindings.length).toBeGreaterThan(0);
    expect(evaluation.canConfirm).toBe(false);
  });

  it("allows confirmation again after reintroduced identity content is removed", () => {
    expect(evaluateRecordHelperOutbound("자료 조사 결과\n010-1234-5678", "").canConfirm).toBe(false);
    expect(evaluateRecordHelperOutbound("자료 조사 결과", "")).toMatchObject({
      identityFindings: [],
      canConfirm: true,
    });
  });

  it("checks both the report and teacher memo for reintroduced identity content", () => {
    const evaluation = evaluateRecordHelperOutbound("자료 조사 결과", "연락처: 010-1234-5678");
    expect(evaluation.identityFindings).toContain("연락처");
    expect(evaluation.canConfirm).toBe(false);
  });

  it("blocks exact student and class hints reintroduced into either editable field", () => {
    expect(evaluateRecordHelperOutbound("홍길동은 발표함", "", ["홍길동", "2학년 3반"]).canConfirm).toBe(false);
    expect(evaluateRecordHelperOutbound("학생은 발표함", "홍길동을 관찰함", ["홍길동"]).canConfirm).toBe(false);
    expect(evaluateRecordHelperOutbound("2학년 3반 활동", "", ["2학년 3반"]).identityFindings).toContain("입력된 학생 정보");
    expect(evaluateRecordHelperOutbound("학생은 발표함", "", ["홍길동"]).canConfirm).toBe(true);
  });

  it("treats regex characters in identity hints as literal text", () => {
    expect(evaluateRecordHelperOutbound("A.*(학생)은 발표함", "", ["A.*(학생)"]).identityFindings).toContain("입력된 학생 정보");
    expect(evaluateRecordHelperOutbound("학생은 발표함", "", ["A.*(학생)"]).canConfirm).toBe(true);
  });

  it("never adds local identity hints to the generated prompt", () => {
    const evaluation = evaluateRecordHelperOutbound("학생은 발표함", "교사가 관찰함", ["홍길동", "2학년 3반"]);
    expect(evaluation.canConfirm).toBe(true);
    expect(evaluation.prompt).not.toMatch(/홍길동|2학년 3반/);
  });

  it("blocks sensitive content and rechecks an edited safe copy", () => {
    expect(evaluateRecordHelperOutbound("병원 검사 결과", "").canConfirm).toBe(false);
    expect(evaluateRecordHelperOutbound("자료 조사 결과", "").canConfirm).toBe(true);
  });

  it("blocks content above the 64 KiB UTF-8 limit without truncation", () => {
    const reportText = "가".repeat(RECORD_HELPER_AI_OUTBOUND_BYTE_LIMIT);
    const evaluation = evaluateRecordHelperOutbound(reportText, "");
    expect(evaluation.isWithinSizeLimit).toBe(false);
    expect(evaluation.prompt).toContain(reportText);
  });

  it("counts the complete generated prompt against the outbound byte limit", () => {
    const reportText = "가".repeat(Math.floor((RECORD_HELPER_AI_OUTBOUND_BYTE_LIMIT - 1) / 3));
    const evaluation = evaluateRecordHelperOutbound(reportText, "");

    expect(new TextEncoder().encode(reportText).byteLength).toBeLessThanOrEqual(
      RECORD_HELPER_AI_OUTBOUND_BYTE_LIMIT,
    );
    expect(evaluation.bytes).toBe(new TextEncoder().encode(evaluation.prompt).byteLength);
    expect(evaluation.isWithinSizeLimit).toBe(false);
    expect(evaluation.canConfirm).toBe(false);
  });
});

describe("record helper ChatGPT plan availability", () => {
  const base = {
    status: "connected" as const,
    planUsageEnabled: true,
    models,
    selectedModel: "gpt-account-model",
    modelsLoading: false,
    modelsError: null,
  };

  it("requires a connected plan and a selected catalog model", () => {
    expect(resolveRecordHelperChatGptPlanAvailability(base)).toMatchObject({
      isAvailable: true,
      selectedModel: models[0],
    });
    expect(resolveRecordHelperChatGptPlanAvailability({ ...base, planUsageEnabled: false }).isAvailable).toBe(false);
    expect(resolveRecordHelperChatGptPlanAvailability({ ...base, selectedModel: null }).isAvailable).toBe(false);
    expect(resolveRecordHelperChatGptPlanAvailability({ ...base, selectedModel: "stale-model" }).isAvailable).toBe(false);
  });

  it("reports model loading and model errors without availability", () => {
    expect(resolveRecordHelperChatGptPlanAvailability({ ...base, modelsLoading: true })).toMatchObject({
      isAvailable: false,
      message: "ChatGPT 모델을 준비 중입니다.",
    });
    expect(resolveRecordHelperChatGptPlanAvailability({
      ...base,
      modelsError: { code: "temporaryFailure", message: "모델 목록 오류" },
    })).toMatchObject({ isAvailable: false, message: "모델 목록 오류" });
  });
});
