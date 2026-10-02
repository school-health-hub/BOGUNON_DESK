import { describe, expect, it, vi } from "vitest";
import type { ChatGptModel } from "../chatgpt/types";
import {
  createRecordHelperAiSendGate,
  prepareRecordHelperAiSend,
  RECORD_HELPER_EMPTY_AI_RESPONSE_ERROR,
  resolveRecordHelperChatGptPlanAvailability,
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
