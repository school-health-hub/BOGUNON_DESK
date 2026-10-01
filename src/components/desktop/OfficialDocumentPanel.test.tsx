import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AiConnectionProvider } from "../../ai/AiConnectionContext";
import type { AiConnectionService, AiConnectionState, AiProvider } from "../../ai/types";
import { OfficialDocumentSessionProvider } from "../../official-document/OfficialDocumentSessionContext";
import { createOfficialDocumentSession } from "../../official-document/officialDocumentSession";
import { inspectOfficialDocumentPrivacy } from "../../official-document/privacyGuard";
import type { OfficialDocumentMode } from "../../official-document/types";
import { OfficialDocumentAiConfirmation, OfficialDocumentPanel } from "./OfficialDocumentPanel";

const disconnectedState: AiConnectionState = {
  status: "disconnected",
  provider: null,
  model: null,
  error: null,
  canRetry: false,
};

const createService = (provider: AiProvider | null): AiConnectionService => ({
  getState: () => provider === null ? disconnectedState : {
    ...disconnectedState,
    status: "connected",
    provider,
    model: provider === "openai" ? "gpt-5.6-luna" : "gemini-3.8-flash",
  },
  subscribe: () => () => undefined,
  connect: vi.fn(async () => undefined),
  validate: vi.fn(async () => undefined),
  generateText: vi.fn(async () => "작성 결과"),
  disconnect: vi.fn(),
});

const renderPanel = (provider: AiProvider | null, mode: OfficialDocumentMode = "create"): string => renderToStaticMarkup(
  <AiConnectionProvider createService={() => createService(provider)}>
    <OfficialDocumentSessionProvider initialState={{ ...createOfficialDocumentSession(), mode }}>
      <OfficialDocumentPanel onClose={vi.fn()} onNotice={vi.fn()} onOpenAiSettings={vi.fn()} onSendSummaryToQuickAdd={vi.fn()} />
    </OfficialDocumentSessionProvider>
  </AiConnectionProvider>,
);

describe("OfficialDocumentPanel", () => {
  it("renders all modes, deterministic draft action, and disconnected AI guidance", () => {
    const markup = renderPanel(null);
    expect(markup).toContain("새 공문 작성");
    expect(markup).toContain("받은 공문 수정");
    expect(markup).toContain("공문 핵심정리");
    expect(markup).toContain("기본 초안 만들기");
    expect(markup).toContain("AI 프롬프트 만들기");
    expect(markup).toContain("AI 연결 설정");
    expect(markup).toContain("현재 앱을 실행하는 동안에만 메모리에 유지");
    expect(markup).toContain("기본 정보");
    expect(markup).toContain("공문 내용");
    expect(markup).toContain("추가 정보");
    expect(markup).toContain("아직 작성된 초안이 없습니다.");
    expect(markup).not.toContain("PDF/HWPX 가져오기");
  });

  it.each(["revision", "summary"] as const)("renders file import in %s mode", (mode) => {
    const markup = renderPanel(null, mode);
    expect(markup).toContain("PDF/HWPX 가져오기");
    expect(markup).toContain("공문 원문");
  });

  it("renders local summary only in summary mode", () => {
    expect(renderPanel(null, "summary")).toContain("기본 핵심정리");
    expect(renderPanel(null, "create")).not.toContain("기본 핵심정리");
    expect(renderPanel(null, "revision")).not.toContain("기본 핵심정리");
  });

  it.each([
    ["openai" as const, "OpenAI 연결하여 작성"],
    ["gemini" as const, "Gemini 연결하여 작성"],
  ])("renders the connected %s action", (provider, label) => {
    expect(renderPanel(provider)).toContain(label);
  });

  it("renders final confirmation even for content the automatic privacy check does not flag", () => {
    const prompt = "자유 서술 개인정보 가능 내용을 포함한 공문 프롬프트";
    expect(inspectOfficialDocumentPrivacy(prompt).isSafe).toBe(true);

    const markup = renderToStaticMarkup(
      <OfficialDocumentAiConfirmation
        confirmation={{ prompt, providerLabel: "OpenAI" }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(markup).toContain("AI 전송 내용 확인");
    expect(markup).toContain("모든 개인정보를 탐지하지 못할 수 있습니다");
    expect(markup).toContain("확인 후 전송");
    expect(markup).toContain(prompt);
  });
});
