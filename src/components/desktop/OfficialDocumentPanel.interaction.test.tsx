// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiConnectionProvider } from "../../ai/AiConnectionContext";
import type { AiConnectionService } from "../../ai/types";
import { OfficialDocumentSessionProvider } from "../../official-document/OfficialDocumentSessionContext";
import { createOfficialDocumentSession } from "../../official-document/officialDocumentSession";
import type { OfficialDocumentSession } from "../../official-document/types";
import { OfficialDocumentPanel } from "./OfficialDocumentPanel";

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn<(prompt: string) => Promise<string>>(),
}));

vi.mock("../../chatgpt/ChatGptConnectionContext", () => ({
  useChatGptConnection: () => ({
    state: { status: "connected", planUsageEnabled: true },
    models: [{ slug: "gpt-test", displayName: "GPT Test" }],
    selectedModel: "gpt-test",
    modelsLoading: false,
    modelsError: null,
    generateText: generateTextMock,
  }),
}));

const disconnectedAiService: AiConnectionService = {
  getState: () => ({ status: "disconnected", provider: null, model: null, error: null, canRetry: false }),
  subscribe: () => () => undefined,
  connect: vi.fn(async () => undefined),
  validate: vi.fn(async () => undefined),
  generateText: vi.fn(async () => "unused"),
  disconnect: vi.fn(),
};

const revisionSession = (): OfficialDocumentSession => ({
  ...createOfficialDocumentSession(),
  mode: "revision",
  revisionInput: {
    original: "학생명: 김가상\n진단명: 가상질환\n원문 업무 내용",
    request: "문체를 간결하게 수정",
  },
});

const renderPanel = (initialState: OfficialDocumentSession = revisionSession()): void => {
  render(
    <AiConnectionProvider createService={() => disconnectedAiService}>
      <OfficialDocumentSessionProvider initialState={initialState}>
        <OfficialDocumentPanel onClose={vi.fn()} onNotice={vi.fn()} onOpenAiSettings={vi.fn()} onSendSummaryToQuickAdd={vi.fn()} />
      </OfficialDocumentSessionProvider>
    </AiConnectionProvider>,
  );
};

const openPlanConfirmation = (): HTMLTextAreaElement => {
  fireEvent.click(screen.getByRole("button", { name: "ChatGPT 요금제로 작성" }));
  return screen.getByLabelText("AI 서비스로 전송될 내용");
};

const confirmOutbound = (outboundText: string): void => {
  const editor = openPlanConfirmation();
  fireEvent.change(editor, { target: { value: outboundText } });
  fireEvent.click(screen.getByRole("button", { name: "확인 후 전송" }));
};

describe("OfficialDocumentPanel AI interaction", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    generateTextMock.mockResolvedValue("AI 수정 결과");
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sends exactly the user-reviewed outbound text and never the raw source", async () => {
    renderPanel();
    const reviewedOutbound = "개인정보를 제거한 최종 공문 수정 요청";
    confirmOutbound(reviewedOutbound);

    await waitFor(() => expect(generateTextMock).toHaveBeenCalledOnce());
    expect(generateTextMock).toHaveBeenCalledWith(reviewedOutbound);
    expect(generateTextMock.mock.calls[0]?.[0]).not.toContain("김가상");
    expect(generateTextMock.mock.calls[0]?.[0]).not.toContain("가상질환");
  });

  it("does not send or store temporary edits after cancel, backdrop, or Escape", () => {
    renderPanel();
    const editor = openPlanConfirmation();
    fireEvent.change(editor, { target: { value: "취소할 임시 전송본" } });
    fireEvent.keyDown(screen.getByRole("dialog", { name: "AI 전송 내용 확인" }), { key: "Escape" });
    expect(generateTextMock).not.toHaveBeenCalled();

    const reopened = openPlanConfirmation();
    expect(reopened.value).not.toBe("취소할 임시 전송본");
    const backdrop = screen.getByRole("dialog", { name: "AI 전송 내용 확인" }).parentElement;
    if (backdrop === null) throw new Error("confirmation backdrop expected");
    fireEvent.mouseDown(backdrop);
    expect(screen.queryByRole("dialog", { name: "AI 전송 내용 확인" })).toBeNull();
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it.each([
    ["identity", "학생명: 김가상"],
    ["sensitive", "진단명: 가상질환"],
  ])("blocks %s content reintroduced in the reviewed outbound text", (_kind, unsafeText) => {
    renderPanel();
    const editor = openPlanConfirmation();
    fireEvent.change(editor, { target: { value: unsafeText } });
    expect(screen.getByRole("button", { name: "확인 후 전송" })).toHaveProperty("disabled", true);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("restores the last reviewed packet for retry after a first-generation failure", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("일시적 오류"));
    renderPanel();
    const reviewedOutbound = "검토를 마친 안전한 재시도 전송본";
    confirmOutbound(reviewedOutbound);
    expect((await screen.findByRole("alert")).textContent).toContain("일시적 오류");

    fireEvent.click(screen.getByRole("button", { name: "ChatGPT 요금제로 다시 시도" }));
    expect(screen.getByLabelText<HTMLTextAreaElement>("AI 서비스로 전송될 내용").value).toBe(reviewedOutbound);
  });

  it("restores the reviewed packet for regeneration and preserves the previous result on failure", async () => {
    generateTextMock.mockResolvedValueOnce("첫 정상 결과").mockRejectedValueOnce(new Error("재생성 실패"));
    renderPanel();
    const reviewedOutbound = "재생성에 재사용할 검토 전송본";
    confirmOutbound(reviewedOutbound);
    expect(await screen.findByText("첫 정상 결과")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ChatGPT 요금제로 다시 생성" }));
    expect(screen.getByLabelText<HTMLTextAreaElement>("AI 서비스로 전송될 내용").value).toBe(reviewedOutbound);
    fireEvent.click(screen.getByRole("button", { name: "확인 후 전송" }));

    expect(await screen.findByText("이전 AI 결과 유지됨")).toBeTruthy();
    expect(screen.getByText("첫 정상 결과")).toBeTruthy();
    expect(screen.getByRole("button", { name: "AI 결과 복사" })).toBeTruthy();
  });

  it("keeps the previous reviewed packet when a later confirmation edit fails validation", async () => {
    renderPanel();
    const reviewedOutbound = "마지막으로 검증된 안전한 전송본";
    confirmOutbound(reviewedOutbound);
    expect(await screen.findByText("AI 수정 결과")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ChatGPT 요금제로 다시 생성" }));
    fireEvent.change(screen.getByLabelText("AI 서비스로 전송될 내용"), { target: { value: "학생명: 김가상" } });
    expect(screen.getByRole("button", { name: "확인 후 전송" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    fireEvent.click(screen.getByRole("button", { name: "ChatGPT 요금제로 다시 생성" }));
    expect(screen.getByLabelText<HTMLTextAreaElement>("AI 서비스로 전송될 내용").value).toBe(reviewedOutbound);
  });

  it("uses a freshly built local prompt instead of an older reviewed packet", async () => {
    renderPanel();
    const reviewedOutbound = "이전 검토 전송본";
    confirmOutbound(reviewedOutbound);
    expect(await screen.findByText("AI 수정 결과")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "AI 프롬프트 만들기" }));
    fireEvent.click(screen.getByRole("button", { name: "ChatGPT 요금제로 다시 생성" }));

    const nextOutbound = screen.getByLabelText<HTMLTextAreaElement>("AI 서비스로 전송될 내용").value;
    expect(nextOutbound).not.toBe(reviewedOutbound);
    expect(nextOutbound).toContain("다음 학교 공문을 수정해 주세요.");
  });

  it("stops frontend handling and ignores a late success", async () => {
    let resolveGeneration: (value: string) => void = () => undefined;
    generateTextMock.mockImplementation(() => new Promise((resolve) => { resolveGeneration = resolve; }));
    renderPanel();
    confirmOutbound("중단할 요청의 안전한 전송본");
    fireEvent.click(screen.getByRole("button", { name: "작성 중단" }));
    await act(async () => {
      resolveGeneration("중단 뒤 도착한 결과");
      await Promise.resolve();
    });

    expect(screen.queryByText("중단 뒤 도착한 결과")).toBeNull();
    expect(screen.getByRole("button", { name: "ChatGPT 요금제로 작성" })).toBeTruthy();
  });

  it("stops frontend handling and ignores a late error", async () => {
    let rejectGeneration: (reason: Error) => void = () => undefined;
    generateTextMock.mockImplementation(() => new Promise((_resolve, reject) => { rejectGeneration = reject; }));
    renderPanel();
    confirmOutbound("늦은 오류를 무시할 안전한 전송본");
    fireEvent.click(screen.getByRole("button", { name: "작성 중단" }));
    await act(async () => {
      rejectGeneration(new Error("중단 뒤 도착한 오류"));
      await Promise.resolve();
    });

    expect(screen.queryByText("중단 뒤 도착한 오류")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ignores late results after input edit, mode change, and reset", async () => {
    let resolveGeneration: (value: string) => void = () => undefined;
    generateTextMock.mockImplementation(() => new Promise((resolve) => { resolveGeneration = resolve; }));
    renderPanel();
    confirmOutbound("입력 변경 전 안전한 전송본");
    fireEvent.change(screen.getByLabelText("수정 요청"), { target: { value: "새 수정 요청" } });
    fireEvent.click(screen.getByRole("tab", { name: "공문 핵심정리" }));
    fireEvent.click(screen.getByRole("button", { name: "새 작업" }));
    await act(async () => {
      resolveGeneration("무효화 뒤 늦은 결과");
      await Promise.resolve();
    });

    expect(screen.queryByText("무효화 뒤 늦은 결과")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
