// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecordHelperReportId, type RecordHelperWorkspace } from "../../record-helper/recordHelperWorkspace";
import { RecordHelperPanel } from "./RecordHelperPanel";
import recordHelperPanelSource from "./RecordHelperPanel.tsx?raw";

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

const idleAi = {
  aiStatus: "idle" as const,
  aiDraft: "",
  aiError: null,
  activeAiRequestId: null,
  reviewedSanitizedPacket: null,
};

const retainedPhase5Sources = import.meta.glob([
  "./RecordHelperAiConfirmation.tsx",
  "./RecordHelperAiConfirmation.test.tsx",
  "../../record-helper/privacyGuard.ts",
  "../../record-helper/privacyGuard.test.ts",
  "../../record-helper/promptBuilder.ts",
  "../../record-helper/promptBuilder.test.ts",
  "../../record-helper/recordHelperAiService.ts",
  "../../record-helper/recordHelperAiService.test.ts",
  "../../record-helper/recordHelperSession.ts",
  "../../record-helper/recordHelperSession.test.ts",
  "../../record-helper/types.ts",
], { eager: true, import: "default", query: "?raw" });

const populatedWorkspace: RecordHelperWorkspace = {
  reports: [
    {
      id: createRecordHelperReportId("report-a"),
      sourceName: "아주긴파일이름-관찰기록-학급자치활동-1학기-상담메모.pdf",
      format: "pdf",
      extractedText: "자료 조사 과정에서 맡은 역할을 꾸준히 수행하고 친구의 의견을 경청함.",
      studentLabel: "학생 A",
      classLabel: "1학년 2반",
      activityLabel: "학급자치",
      teacherMemo: "협업 태도를 중심으로 확인",
      ...idleAi,
    },
    {
      id: createRecordHelperReportId("report-b"),
      sourceName: "진로활동.hwpx",
      format: "hwpx",
      extractedText: "진로 탐색 활동 본문",
      studentLabel: "",
      classLabel: "",
      activityLabel: "",
      teacherMemo: "",
      ...idleAi,
    },
  ],
  selectedReportId: createRecordHelperReportId("report-a"),
  importStatus: "success",
  importError: null,
  activeImportRequestId: null,
  latestBatchFailures: [
    { sourceName: "잠긴문서.docx", error: "암호화된 문서는 읽을 수 없습니다." },
  ],
};

const allFailureWorkspace: RecordHelperWorkspace = {
  reports: [],
  selectedReportId: null,
  importStatus: "success",
  importError: null,
  activeImportRequestId: null,
  latestBatchFailures: [
    { sourceName: "암호설정-활동보고서.hwp", error: "암호화된 HWP 문서는 읽을 수 없습니다." },
    { sourceName: "손상된보고서.pdf", error: "문서에서 읽을 수 있는 본문을 찾지 못했습니다." },
  ],
};

const importErrorWorkspace: RecordHelperWorkspace = {
  ...populatedWorkspace,
  importStatus: "error",
  importError: "활동보고서 파일을 가져오지 못했습니다.",
};

const renderPanelMarkup = (initialWorkspace?: RecordHelperWorkspace): string => renderToStaticMarkup(
  <RecordHelperPanel
    importReports={vi.fn(async () => null)}
    initialWorkspace={initialWorkspace}
    onClose={vi.fn()}
    onOpenAiSettings={vi.fn()}
  />,
);

const renderInteractivePanel = (initialWorkspace: RecordHelperWorkspace): void => {
  render(
    <RecordHelperPanel
      importReports={vi.fn(async () => null)}
      initialWorkspace={initialWorkspace}
      onClose={vi.fn()}
      onOpenAiSettings={vi.fn()}
    />,
  );
};

describe("RecordHelperPanel report workspace", () => {
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

  it("reuses the Phase 5 ChatGPT plan modules without fallback paths", () => {
    expect(Object.keys(retainedPhase5Sources)).toHaveLength(11);
    expect(recordHelperPanelSource).toMatch(/RecordHelperAiConfirmation|chatGpt\.generateText|useChatGptConnection/);
    expect(recordHelperPanelSource).not.toMatch(/useAiConnection|fetch\(|localStorage|sessionStorage|Store|supabase|console\./);
  });

  it("renders the dialog title, internal close action, empty state, and local import support guidance", () => {
    const markup = renderPanelMarkup();

    expect(markup).toContain("role=\"dialog\"");
    expect(markup).toContain("생기부 도우미");
    expect(markup).toContain("학생 활동보고서를 불러와 학생별 기록 자료를 정리합니다.");
    expect(markup).toContain("aria-label=\"생기부 도우미 닫기\"");
    expect(markup).toContain("활동보고서 파일 추가");
    expect(markup).toContain("PDF · HWP/HWPX · DOCX");
    expect(markup).toContain("HWP 5.x 일반/압축 문서");
    expect(markup).toContain("아직 가져온 활동보고서가 없습니다.");
    expect(markup).toContain("가져온 원본과 현재 작업은 앱 메모리에서만 처리합니다.");
    expect(markup).toContain("원문, 학생정보, 교사 메모, 검토한 전송본과 AI 초안은 장기 저장하지 않습니다.");
    expect(markup).toContain("생기부 도우미를 닫거나 앱을 완전히 종료하면 현재 작업이 모두 사라집니다.");
    expect(markup).toContain("AI 전송 전 개인정보를 비식별 처리하고, 실제 전송 내용을 직접 확인합니다.");
    expect(markup).not.toContain("선택한 파일이 없습니다.");
  });

  it("renders imported reports, selected detail, editable labels, memo, failure warnings, and privacy notices", () => {
    const markup = renderPanelMarkup(populatedWorkspace);

    expect(markup).toContain("2개 보고서");
    expect(markup).toContain("아주긴파일이름-관찰기록-학급자치활동-1학기-상담메모.pdf");
    expect(markup).toContain("PDF");
    expect(markup).toContain("HWPX");
    expect(markup).toContain("학생 구분");
    expect(markup).toContain("2학년 3반 15번");
    expect(markup).toContain("학생 A");
    expect(markup).toContain("학급/그룹");
    expect(markup).toContain("1학년 2반");
    expect(markup).toContain("활동명");
    expect(markup).toContain("학급자치");
    expect(markup).toContain("추출된 원문");
    expect(markup).toContain("자료 조사 과정에서 맡은 역할을 꾸준히 수행하고 친구의 의견을 경청함.");
    expect(markup).toContain("교사 메모/관찰 내용");
    expect(markup).toContain("협업 태도를 중심으로 확인");
    expect(markup).toContain("잠긴문서.docx");
    expect(markup).toContain("암호화된 문서는 읽을 수 없습니다.");
    expect(markup).toContain("전체 비우기");
    expect(markup).toContain("선택 보고서 제거");
  });

  it("renders safe per-file failures when an import batch contains no reports", () => {
    const markup = renderPanelMarkup(allFailureWorkspace);

    expect(markup).toContain("가져온 활동보고서가 없습니다.");
    expect(markup).toContain("가져오지 못한 파일");
    expect(markup).toContain("암호설정-활동보고서.hwp");
    expect(markup).toContain("암호화된 HWP 문서는 읽을 수 없습니다.");
    expect(markup).toContain("손상된보고서.pdf");
    expect(markup).toContain("문서에서 읽을 수 있는 본문을 찾지 못했습니다.");
  });

  it("renders a populated import error alongside the existing report workspace", () => {
    const markup = renderPanelMarkup(importErrorWorkspace);

    expect(markup).toContain("활동보고서 파일을 가져오지 못했습니다.");
    expect(markup).toContain("아주긴파일이름-관찰기록-학급자치활동-1학기-상담메모.pdf");
  });

  it("renders the explicit ChatGPT plan action without API-key fallback", () => {
    const markup = renderPanelMarkup(populatedWorkspace);

    expect(markup).toContain("ChatGPT 요금제 연결됨 · GPT Test");
    expect(markup).not.toContain("AI 연결 설정");
    expect(markup).toContain("ChatGPT 요금제로 초안 작성");
    expect(markup).not.toContain("AI 전송 내용 확인");
    expect(markup).not.toContain("Gemini");
    expect(markup).not.toContain("OpenAI");
  });

  it("routes X, Escape, backdrop, clear, and edited removal through one discard gate", () => {
    expect(recordHelperPanelSource).toContain('onClick={requestClose}');
    expect(recordHelperPanelSource).toMatch(/event\.target === event\.currentTarget\) requestClose\(\)/);
    expect(recordHelperPanelSource).toMatch(
      /if \(pendingDiscard !== null\) \{\s+setPendingDiscard\(null\);\s+return;\s+\}\s+requestClose\(\)/,
    );
    expect(recordHelperPanelSource).toContain("onClearAll={requestClearAll}");
    expect(recordHelperPanelSource).toContain("onRemoveReport={requestRemoveReport}");
    expect(recordHelperPanelSource).toContain("onCancel={() => setPendingDiscard(null)}");
    expect(recordHelperPanelSource).toContain("onConfirm={confirmDiscard}");
  });

  it("sends only the user-reviewed sanitized packet through the panel confirmation", async () => {
    const workspace: RecordHelperWorkspace = {
      ...populatedWorkspace,
      reports: [{
        ...populatedWorkspace.reports[0],
        extractedText: "학생명: 김가상은 자료 조사에 참여함.",
        studentLabel: "김가상",
        classLabel: "가상 2학년 3반",
        teacherMemo: "김가상의 협업 태도를 관찰함.",
      }],
      selectedReportId: createRecordHelperReportId("report-a"),
      latestBatchFailures: [],
    };
    renderInteractivePanel(workspace);

    fireEvent.click(screen.getByRole("button", { name: "ChatGPT 요금제로 초안 작성" }));
    fireEvent.change(screen.getByLabelText("비식별 활동보고서"), { target: { value: "비식별 활동만 남김" } });
    fireEvent.change(screen.getByLabelText("비식별 교사 메모"), { target: { value: "교사의 비식별 관찰" } });
    fireEvent.click(screen.getByRole("button", { name: "확인 후 전송" }));

    await waitFor(() => expect(generateTextMock).toHaveBeenCalledOnce());
    const prompt = generateTextMock.mock.calls[0]?.[0] ?? "";
    expect(prompt).toContain("비식별 활동만 남김");
    expect(prompt).toContain("교사의 비식별 관찰");
    expect(prompt).not.toContain("학생명: 김가상");
    expect(prompt).not.toContain("김가상");
    expect(prompt).not.toContain("가상 2학년 3반");
  });

  it.each([
    ["identity", "학생명: 김가상"],
    ["sensitive", "병원 검사 결과"],
  ])("blocks %s content reintroduced in confirmation before generation", (_kind, unsafeText) => {
    renderInteractivePanel({ ...populatedWorkspace, latestBatchFailures: [] });

    fireEvent.click(screen.getByRole("button", { name: "ChatGPT 요금제로 초안 작성" }));
    fireEvent.change(screen.getByLabelText("비식별 활동보고서"), { target: { value: unsafeText } });

    expect(screen.getByRole("button", { name: "확인 후 전송" })).toHaveProperty("disabled", true);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("keeps an in-flight result attached to report A after selecting report B", async () => {
    let resolveGeneration: (value: string) => void = () => undefined;
    generateTextMock.mockImplementation(() => new Promise((resolve) => { resolveGeneration = resolve; }));
    renderInteractivePanel({ ...populatedWorkspace, latestBatchFailures: [] });

    fireEvent.click(screen.getByRole("button", { name: "ChatGPT 요금제로 초안 작성" }));
    fireEvent.click(screen.getByRole("button", { name: "확인 후 전송" }));
    fireEvent.click(screen.getByRole("button", { name: /^진로활동\.hwpx.*HWPX$/ }));
    resolveGeneration("A 보고서 전용 초안");

    await waitFor(() => expect(screen.getByText("초안 생성됨")).toBeTruthy());
    expect(screen.queryByText("A 보고서 전용 초안")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^아주긴파일이름-관찰기록.*PDF$/ }));
    expect(await screen.findByText("A 보고서 전용 초안")).toBeTruthy();
  });

  it("ignores late completion after removing or clearing the target report", async () => {
    let rejectGeneration: (reason: Error) => void = () => undefined;
    generateTextMock.mockImplementation(() => new Promise((_resolve, reject) => { rejectGeneration = reject; }));
    renderInteractivePanel({ ...populatedWorkspace, latestBatchFailures: [] });

    fireEvent.click(screen.getByRole("button", { name: "ChatGPT 요금제로 초안 작성" }));
    fireEvent.click(screen.getByRole("button", { name: "확인 후 전송" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 보고서 제거" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "보고서 제거" })).getByRole("button", { name: "보고서 제거" }));
    rejectGeneration(new Error("늦은 오류"));

    await waitFor(() => expect(screen.queryByText("늦은 오류")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "전체 비우기" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "작업실 전체 비우기" })).getByRole("button", { name: "전체 비우기" }));
    expect(screen.getByText("아직 가져온 활동보고서가 없습니다.")).toBeTruthy();
  });

  it("ignores a late success after clearing an active report", async () => {
    let resolveGeneration: (value: string) => void = () => undefined;
    generateTextMock.mockImplementation(() => new Promise((resolve) => { resolveGeneration = resolve; }));
    renderInteractivePanel({ ...populatedWorkspace, latestBatchFailures: [] });

    fireEvent.click(screen.getByRole("button", { name: "ChatGPT 요금제로 초안 작성" }));
    fireEvent.click(screen.getByRole("button", { name: "확인 후 전송" }));
    fireEvent.click(screen.getByRole("button", { name: "전체 비우기" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "작업실 전체 비우기" })).getByRole("button", { name: "전체 비우기" }));
    resolveGeneration("비워진 보고서의 늦은 초안");

    await waitFor(() => expect(screen.queryByText("비워진 보고서의 늦은 초안")).toBeNull());
    expect(screen.getByText("아직 가져온 활동보고서가 없습니다.")).toBeTruthy();
  });

  it("stops frontend handling and ignores a late first-generation result", async () => {
    let resolveGeneration: (value: string) => void = () => undefined;
    generateTextMock.mockImplementation(() => new Promise((resolve) => { resolveGeneration = resolve; }));
    renderInteractivePanel({ ...populatedWorkspace, latestBatchFailures: [] });

    fireEvent.click(screen.getByRole("button", { name: "ChatGPT 요금제로 초안 작성" }));
    fireEvent.click(screen.getByRole("button", { name: "확인 후 전송" }));
    fireEvent.click(screen.getByRole("button", { name: "작성 중단" }));
    resolveGeneration("중단 뒤 도착한 초안");

    await waitFor(() => expect(screen.queryByText("중단 뒤 도착한 초안")).toBeNull());
    expect(screen.getByRole("button", { name: "ChatGPT 요금제로 초안 작성" })).toBeTruthy();
  });
});
