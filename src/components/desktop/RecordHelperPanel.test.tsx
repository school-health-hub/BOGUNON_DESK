import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createRecordHelperReportId, type RecordHelperWorkspace } from "../../record-helper/recordHelperWorkspace";
import { RecordHelperPanel } from "./RecordHelperPanel";
import recordHelperPanelSource from "./RecordHelperPanel.tsx?raw";

vi.mock("../../chatgpt/ChatGptConnectionContext", () => ({
  useChatGptConnection: () => ({
    state: { status: "connected", planUsageEnabled: true },
    models: [{ slug: "gpt-test", displayName: "GPT Test" }],
    selectedModel: "gpt-test",
    modelsLoading: false,
    modelsError: null,
    generateText: vi.fn(async () => "AI 초안"),
  }),
}));

const idleAi = { aiStatus: "idle" as const, aiDraft: "", aiError: null, activeAiRequestId: null };

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

const renderPanel = (initialWorkspace?: RecordHelperWorkspace): string => renderToStaticMarkup(
  <RecordHelperPanel
    importReports={vi.fn(async () => null)}
    initialWorkspace={initialWorkspace}
    onClose={vi.fn()}
    onOpenAiSettings={vi.fn()}
  />,
);

describe("RecordHelperPanel report workspace", () => {
  it("reuses the Phase 5 ChatGPT plan modules without fallback paths", () => {
    expect(Object.keys(retainedPhase5Sources)).toHaveLength(11);
    expect(recordHelperPanelSource).toMatch(/RecordHelperAiConfirmation|chatGpt\.generateText|useChatGptConnection/);
    expect(recordHelperPanelSource).not.toMatch(/useAiConnection|fetch\(|localStorage|sessionStorage|Store|supabase|console\./);
  });

  it("renders the dialog title, internal close action, empty state, and local import support guidance", () => {
    const markup = renderPanel();

    expect(markup).toContain("role=\"dialog\"");
    expect(markup).toContain("생기부 도우미");
    expect(markup).toContain("학생 활동보고서를 불러와 학생별 기록 자료를 정리합니다.");
    expect(markup).toContain("aria-label=\"생기부 도우미 닫기\"");
    expect(markup).toContain("활동보고서 파일 추가");
    expect(markup).toContain("PDF · HWP/HWPX · DOCX");
    expect(markup).toContain("HWP 5.x 일반/압축 문서");
    expect(markup).toContain("아직 가져온 활동보고서가 없습니다.");
    expect(markup).toContain("가져온 원본은 현재 앱 메모리에만 남습니다.");
    expect(markup).toContain("원문 개인정보는 AI로 전송하지 않습니다.");
    expect(markup).toContain("AI 전송 전 비식별 처리와 직접 확인을 거칩니다.");
    expect(markup).not.toContain("선택한 파일이 없습니다.");
  });

  it("renders imported reports, selected detail, editable labels, memo, failure warnings, and privacy notices", () => {
    const markup = renderPanel(populatedWorkspace);

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
    const markup = renderPanel(allFailureWorkspace);

    expect(markup).toContain("가져온 활동보고서가 없습니다.");
    expect(markup).toContain("가져오지 못한 파일");
    expect(markup).toContain("암호설정-활동보고서.hwp");
    expect(markup).toContain("암호화된 HWP 문서는 읽을 수 없습니다.");
    expect(markup).toContain("손상된보고서.pdf");
    expect(markup).toContain("문서에서 읽을 수 있는 본문을 찾지 못했습니다.");
  });

  it("renders a populated import error alongside the existing report workspace", () => {
    const markup = renderPanel(importErrorWorkspace);

    expect(markup).toContain("활동보고서 파일을 가져오지 못했습니다.");
    expect(markup).toContain("아주긴파일이름-관찰기록-학급자치활동-1학기-상담메모.pdf");
  });

  it("renders the explicit ChatGPT plan action without API-key fallback", () => {
    const markup = renderPanel(populatedWorkspace);

    expect(markup).toContain("ChatGPT 요금제 연결됨 · GPT Test");
    expect(markup).not.toContain("AI 연결 설정");
    expect(markup).toContain("ChatGPT 요금제로 초안 작성");
    expect(markup).not.toContain("AI 전송 내용 확인");
    expect(markup).not.toContain("Gemini");
    expect(markup).not.toContain("OpenAI");
  });
});
