// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecordHelperReportId, type RecordHelperWorkspace } from "../../record-helper/recordHelperWorkspace";
import { RecordHelperAiConfirmation } from "./RecordHelperAiConfirmation";
import { RecordHelperPanel } from "./RecordHelperPanel";

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

const createWorkspace = (): RecordHelperWorkspace => ({
  reports: [
    {
      id: createRecordHelperReportId("report-a"),
      sourceName: "합성-A.docx",
      format: "docx",
      extractedText: "학생명: 김가상은 자료를 주제별로 정리함.",
      studentLabel: "김가상",
      classLabel: "가상 2학년 3반",
      activityLabel: "학급자치",
      teacherMemo: "김가상의 협업 태도를 관찰함.",
      aiStatus: "idle",
      aiDraft: "",
      aiError: null,
      activeAiRequestId: null,
      reviewedSanitizedPacket: null,
    },
    {
      id: createRecordHelperReportId("report-b"),
      sourceName: "합성-B.hwpx",
      format: "hwpx",
      extractedText: "B 보고서의 비식별 활동 내용",
      studentLabel: "",
      classLabel: "",
      activityLabel: "진로활동",
      teacherMemo: "",
      aiStatus: "idle",
      aiDraft: "",
      aiError: null,
      activeAiRequestId: null,
      reviewedSanitizedPacket: null,
    },
  ],
  selectedReportId: createRecordHelperReportId("report-a"),
  importStatus: "success",
  importError: null,
  activeImportRequestId: null,
  latestBatchFailures: [],
});

const renderPanel = (): void => {
  render(
    <RecordHelperPanel
      importReports={vi.fn(async () => null)}
      initialWorkspace={createWorkspace()}
      onClose={vi.fn()}
      onOpenAiSettings={vi.fn()}
    />,
  );
};

const openConfirmation = (buttonName: string): void => {
  fireEvent.click(screen.getByRole("button", { name: buttonName }));
};

const editAndConfirm = (reportText: string, teacherMemo: string): void => {
  fireEvent.change(screen.getByLabelText("비식별 활동보고서"), { target: { value: reportText } });
  fireEvent.change(screen.getByLabelText("비식별 교사 메모"), { target: { value: teacherMemo } });
  fireEvent.click(screen.getByRole("button", { name: "확인 후 전송" }));
};

const cancelConfirmation = (): void => {
  const dialog = screen.getByRole("dialog", { name: "AI 전송 내용 확인" });
  const cancelButton = within(dialog)
    .getAllByRole("button", { name: "취소" })
    .find((button) => button.textContent === "취소");
  if (cancelButton === undefined) throw new Error("expected confirmation cancel button");
  fireEvent.click(cancelButton);
};

describe("RecordHelperPanel reviewed sanitized packet", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    generateTextMock.mockResolvedValue("AI 초안");
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

  it("returns reviewed fields only after final confirmation validation", () => {
    const onConfirm = vi.fn();
    render(
      <RecordHelperAiConfirmation
        confirmation={{
          providerLabel: "ChatGPT 요금제 · GPT Test",
          reportText: "초기 비식별 본문",
          teacherMemo: "초기 비식별 메모",
          redactionCount: 1,
          identityHints: ["김가상", "가상 2학년 3반"],
        }}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByLabelText("비식별 활동보고서"), { target: { value: "최종 비식별 본문" } });
    fireEvent.change(screen.getByLabelText("비식별 교사 메모"), { target: { value: "최종 비식별 메모" } });
    fireEvent.click(screen.getByRole("button", { name: "확인 후 전송" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm.mock.calls[0]?.[0]).toEqual({
      prompt: expect.stringContaining("최종 비식별 본문"),
      reviewedPacket: { reportText: "최종 비식별 본문", teacherMemo: "최종 비식별 메모" },
    });
    expect(JSON.stringify(onConfirm.mock.calls[0]?.[0])).not.toContain("김가상");
    expect(JSON.stringify(onConfirm.mock.calls[0]?.[0])).not.toContain("가상 2학년 3반");
  });

  it("does not store temporary confirmation edits when the first confirmation is cancelled", () => {
    renderPanel();
    openConfirmation("ChatGPT 요금제로 초안 작성");
    fireEvent.change(screen.getByLabelText("비식별 활동보고서"), { target: { value: "취소할 임시 수정" } });
    cancelConfirmation();

    openConfirmation("ChatGPT 요금제로 초안 작성");
    expect(screen.getByLabelText("비식별 활동보고서")).toHaveProperty("value", "[학생] 자료를 주제별로 정리함.");
    expect(screen.getByLabelText("비식별 활동보고서")).not.toHaveProperty("value", "취소할 임시 수정");
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("restores the last confirmed sanitized packet after the first generation fails", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("합성 생성 실패"));
    renderPanel();

    openConfirmation("ChatGPT 요금제로 초안 작성");
    editAndConfirm("사용자가 검토한 비식별 활동", "사용자가 검토한 교사 관찰");

    expect(await screen.findByText("합성 생성 실패")).toBeTruthy();
    openConfirmation("다시 시도");

    expect(screen.getByLabelText("비식별 활동보고서")).toHaveProperty("value", "사용자가 검토한 비식별 활동");
    expect(screen.getByLabelText("비식별 교사 메모")).toHaveProperty("value", "사용자가 검토한 교사 관찰");
    expect(generateTextMock.mock.calls[0]?.[0]).not.toContain("김가상");
    expect(generateTextMock.mock.calls[0]?.[0]).not.toContain("가상 2학년 3반");
  });

  it("reuses a confirmed packet for regeneration but discards cancelled temporary edits", async () => {
    renderPanel();
    openConfirmation("ChatGPT 요금제로 초안 작성");
    editAndConfirm("확정된 비식별 활동", "확정된 비식별 관찰");
    expect(await screen.findByText("AI 초안")).toBeTruthy();

    openConfirmation("초안 다시 생성");
    fireEvent.change(screen.getByLabelText("비식별 활동보고서"), { target: { value: "학생명: 김가상" } });
    expect(screen.getByRole("button", { name: "확인 후 전송" })).toHaveProperty("disabled", true);
    cancelConfirmation();
    openConfirmation("초안 다시 생성");

    expect(screen.getByLabelText("비식별 활동보고서")).toHaveProperty("value", "확정된 비식별 활동");
    expect(screen.getByLabelText("비식별 교사 메모")).toHaveProperty("value", "확정된 비식별 관찰");
    expect(generateTextMock).toHaveBeenCalledOnce();
  });

  it("keeps the packet for activity labels and invalidates it for teacher memo changes", async () => {
    renderPanel();
    openConfirmation("ChatGPT 요금제로 초안 작성");
    editAndConfirm("검토 완료 활동", "검토 완료 관찰");
    expect(await screen.findByText("AI 초안")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("활동명"), { target: { value: "변경된 활동명" } });
    openConfirmation("초안 다시 생성");
    expect(screen.getByLabelText("비식별 활동보고서")).toHaveProperty("value", "검토 완료 활동");
    cancelConfirmation();

    fireEvent.change(screen.getByLabelText("교사 메모/관찰 내용"), { target: { value: "새로운 비식별 교사 관찰" } });
    openConfirmation("ChatGPT 요금제로 초안 작성");
    expect(screen.getByLabelText("비식별 활동보고서")).not.toHaveProperty("value", "검토 완료 활동");
    expect(screen.getByLabelText("비식별 교사 메모")).toHaveProperty("value", "새로운 비식별 교사 관찰");
  });

  it("keeps packets isolated when switching between reports with the same workspace", async () => {
    renderPanel();
    openConfirmation("ChatGPT 요금제로 초안 작성");
    editAndConfirm("A 전용 검토 본문", "A 전용 검토 메모");
    expect(await screen.findByText("AI 초안")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^합성-B\.hwpx.*HWPX$/ }));
    openConfirmation("ChatGPT 요금제로 초안 작성");
    expect(screen.getByLabelText("비식별 활동보고서")).toHaveProperty("value", "B 보고서의 비식별 활동 내용");
    cancelConfirmation();

    fireEvent.click(screen.getByRole("button", { name: /^합성-A\.docx.*DOCX$/ }));
    openConfirmation("초안 다시 생성");
    expect(screen.getByLabelText("비식별 활동보고서")).toHaveProperty("value", "A 전용 검토 본문");
    expect(screen.getByLabelText("비식별 교사 메모")).toHaveProperty("value", "A 전용 검토 메모");
  });

  it.each([
    ["identity", "학생명: 김가상"],
    ["sensitive", "병원 검사 결과"],
    ["oversized", "가".repeat(22_000)],
  ])("revalidates restored packets and blocks %s edits before generation", async (_kind, unsafeText) => {
    renderPanel();
    openConfirmation("ChatGPT 요금제로 초안 작성");
    editAndConfirm("안전한 검토 본문", "안전한 검토 메모");
    expect(await screen.findByText("AI 초안")).toBeTruthy();

    openConfirmation("초안 다시 생성");
    fireEvent.change(screen.getByLabelText("비식별 활동보고서"), { target: { value: unsafeText } });

    expect(screen.getByRole("button", { name: "확인 후 전송" })).toHaveProperty("disabled", true);
    expect(generateTextMock).toHaveBeenCalledOnce();
  });

  it("replaces the reviewed packet only after a newly confirmed regeneration", async () => {
    renderPanel();
    openConfirmation("ChatGPT 요금제로 초안 작성");
    editAndConfirm("첫 검토 본문", "첫 검토 메모");
    expect(await screen.findByText("AI 초안")).toBeTruthy();

    openConfirmation("초안 다시 생성");
    editAndConfirm("두 번째 검토 본문", "두 번째 검토 메모");
    await waitFor(() => expect(generateTextMock).toHaveBeenCalledTimes(2));
    openConfirmation("초안 다시 생성");

    expect(screen.getByLabelText("비식별 활동보고서")).toHaveProperty("value", "두 번째 검토 본문");
    expect(screen.getByLabelText("비식별 교사 메모")).toHaveProperty("value", "두 번째 검토 메모");
    expect(generateTextMock.mock.calls[1]?.[0]).toContain("두 번째 검토 본문");
    expect(generateTextMock.mock.calls[1]?.[0]).toContain("두 번째 검토 메모");
  });

  it("discards reviewed packets when the panel closes and a new workspace opens", async () => {
    function Harness() {
      const [isOpen, setIsOpen] = useState(true);
      return isOpen ? (
        <RecordHelperPanel
          importReports={vi.fn(async () => null)}
          initialWorkspace={createWorkspace()}
          onClose={() => setIsOpen(false)}
          onOpenAiSettings={vi.fn()}
        />
      ) : <button type="button" onClick={() => setIsOpen(true)}>다시 열기</button>;
    }
    render(<Harness />);
    openConfirmation("ChatGPT 요금제로 초안 작성");
    editAndConfirm("닫기 전 검토 본문", "닫기 전 검토 메모");
    expect(await screen.findByText("AI 초안")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "생기부 도우미 닫기" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "생기부 도우미 닫기" })).getByRole("button", { name: "닫고 비우기" }));
    fireEvent.click(screen.getByRole("button", { name: "다시 열기" }));
    openConfirmation("ChatGPT 요금제로 초안 작성");

    expect(screen.getByLabelText("비식별 활동보고서")).toHaveProperty("value", "[학생] 자료를 주제별로 정리함.");
    expect(screen.getByLabelText("비식별 활동보고서")).not.toHaveProperty("value", "닫기 전 검토 본문");
  });
});
