// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractOfficialDocumentSummary } from "../../official-document/summaryExtractor";
import { composeOfficialDocumentDraft, createEmptyOfficialDocumentInput, generateOfficialDocumentDraft } from "../../official-document/documentGenerator";
import { OfficialDocumentOutput } from "./OfficialDocumentOutput";

describe("OfficialDocumentOutput", () => {
  afterEach(cleanup);
  it.each(["계획서, 안내문", ""])("renders one canonical body without changing copied data (%s)", (attachments) => {
    const draft = generateOfficialDocumentDraft({ ...createEmptyOfficialDocumentInput(), attachments });
    const onCopy = vi.fn();
    const view = render(<OfficialDocumentOutput aiResponse="" aiStatus="idle" draft={draft} isExportingOdt={false} localSummary={null} mode="create" onCopy={onCopy} onExportOdt={vi.fn()} onSendSummaryToQuickAdd={vi.fn()} prompt="" />);
    expect(view.getByRole("region", { name: "공문 본문" }).textContent).toBe(draft.body);
    expect(view.queryByRole("region", { name: "붙임" })).toBeNull();
    const paperText = view.getByRole("article").textContent ?? "";
    expect(paperText.match(/끝\./gu)).toHaveLength(1);
    if (attachments !== "") {
      expect(paperText.split("계획서")).toHaveLength(2);
      expect(paperText.split("안내문")).toHaveLength(2);
    }
    fireEvent.click(view.getByRole("button", { name: "전체 복사" }));
    expect(onCopy).toHaveBeenCalledWith("전체", composeOfficialDocumentDraft(draft));
    view.unmount();
  });

  it("renders and copies reference table text separately", () => {
    const onCopy = vi.fn();
    render(
      <OfficialDocumentOutput
        aiResponse=""
        aiStatus="idle"
        draft={{ title: "제목", body: "본문", attachments: "붙임", messenger: "메신저", checklist: "체크", tableText: "구분\t인원", tableGuide: "표에 붙여넣으세요." }}
        isExportingOdt={false}
        localSummary={null}
        mode="create"
        onCopy={onCopy}
        onExportOdt={vi.fn()}
        onSendSummaryToQuickAdd={vi.fn()}
        prompt=""
      />,
    );
    expect(screen.getByText("표에 붙여넣으세요.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "표 복사" }));
    expect(onCopy).toHaveBeenCalledWith("표", "구분\t인원");
  });

  it("keeps local summary, prompt, and AI result as separate ordered sections", () => {
    const markup = renderToStaticMarkup(
      <OfficialDocumentOutput
        aiResponse="연결한 AI 결과"
        aiStatus="idle"
        draft={null}
        isExportingOdt={false}
        localSummary={extractOfficialDocumentSummary("대상: 관내 학교")}
        mode="summary"
        onCopy={vi.fn()}
        onExportOdt={vi.fn()}
        onSendSummaryToQuickAdd={vi.fn()}
        prompt="AI 프롬프트"
      />,
    );

    const localIndex = markup.indexOf("기본 핵심정리");
    const promptIndex = markup.indexOf("AI 프롬프트 미리보기");
    const aiIndex = markup.indexOf("연결한 AI 작성 결과");
    expect(localIndex).toBeGreaterThan(-1);
    expect(promptIndex).toBeGreaterThan(localIndex);
    expect(aiIndex).toBeGreaterThan(promptIndex);
  });

  it.each([
    ["generating" as const, "이전 AI 결과", "새 결과를 작성하는 동안 이전 정상 결과를 표시합니다."],
    ["error" as const, "이전 AI 결과 유지됨", null],
  ])("labels a preserved result while AI status is %s", (aiStatus, heading, notice) => {
    const markup = renderToStaticMarkup(
      <OfficialDocumentOutput
        aiResponse="보존된 정상 결과"
        aiStatus={aiStatus}
        draft={null}
        isExportingOdt={false}
        localSummary={null}
        mode="revision"
        onCopy={vi.fn()}
        onExportOdt={vi.fn()}
        onSendSummaryToQuickAdd={vi.fn()}
        prompt="검토된 전송본"
      />,
    );
    expect(markup).toContain(heading);
    expect(markup).toContain("보존된 정상 결과");
    if (notice !== null) expect(markup).toContain(notice);
  });

  it("shows the ODT export action only for a draft and disables it while saving", () => {
    const draft = generateOfficialDocumentDraft(createEmptyOfficialDocumentInput());
    const onExportOdt = vi.fn();
    const view = render(
      <OfficialDocumentOutput
        aiResponse=""
        aiStatus="idle"
        draft={draft}
        isExportingOdt={true}
        localSummary={null}
        mode="create"
        onCopy={vi.fn()}
        onExportOdt={onExportOdt}
        onSendSummaryToQuickAdd={vi.fn()}
        prompt=""
      />,
    );

    const exportButton = view.getByRole("button", { name: "K-에듀파인용 ODT 저장 중" });
    expect(exportButton).toHaveProperty("disabled", true);
    fireEvent.click(exportButton);
    expect(onExportOdt).not.toHaveBeenCalled();
    view.unmount();

    render(
      <OfficialDocumentOutput
        aiResponse=""
        aiStatus="idle"
        draft={null}
        isExportingOdt={false}
        localSummary={null}
        mode="create"
        onCopy={vi.fn()}
        onExportOdt={onExportOdt}
        onSendSummaryToQuickAdd={vi.fn()}
        prompt=""
      />,
    );
    expect(screen.queryByRole("button", { name: "K-에듀파인용 ODT 저장" })).toBeNull();
  });
});
