// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { composeOfficialDocumentDraft, createEmptyOfficialDocumentInput, generateOfficialDocumentDraft } from "../../official-document/documentGenerator";
import { officialDocumentDraftQualityScenarios } from "../../official-document/documentOutputQuality.fixtures";
import { OfficialDocumentOutput } from "./OfficialDocumentOutput";

describe("OfficialDocumentOutput quality scenarios", () => {
  afterEach(cleanup);

  it("preserves ordinary multiline sentences in the preview and all copy payloads", () => {
    // Given: a corrected draft with synthetic multiline prose and an attachment.
    const draft = generateOfficialDocumentDraft({
      ...createEmptyOfficialDocumentInput(),
      mainContent: "    첫째 일반 문장입니다.\n\n    둘째 일반 문장입니다.",
      attachments: "합성 확인표",
    });
    const onCopy = vi.fn();

    // When: the production output component renders the draft and copies it.
    const view = render(
      <OfficialDocumentOutput
        aiResponse="" aiStatus="idle" draft={draft} localSummary={null} mode="create"
        onCopy={onCopy} onSendSummaryToQuickAdd={vi.fn()} prompt=""
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "제목 복사" }));
    fireEvent.click(view.getByRole("button", { name: "본문 복사" }));
    fireEvent.click(view.getByRole("button", { name: "전체 복사" }));

    // Then: preview and copy use the same intact sentences without a grammar suffix.
    const bodyText = view.getByRole("region", { name: "공문 본문" }).textContent;
    expect(bodyText).toContain("2. 주요 내용\n      첫째 일반 문장입니다.\n  \n      둘째 일반 문장입니다.");
    expect(bodyText).not.toContain("입니다.을(를)");
    expect(bodyText).toBe(draft.body);
    expect(onCopy.mock.calls).toEqual([
      ["제목", draft.title], ["본문", bodyText], ["전체", composeOfficialDocumentDraft(draft)],
    ]);
  });

  it.each(officialDocumentDraftQualityScenarios)("matches preview text and copy payloads: $label", (scenario) => {
    // Given: a production draft created from a synthetic quality fixture.
    const draft = generateOfficialDocumentDraft(scenario.input);
    const onCopy = vi.fn();

    // When: the document preview is rendered and each copy command is activated.
    const view = render(
      <OfficialDocumentOutput
        aiResponse=""
        aiStatus="idle"
        draft={draft}
        localSummary={null}
        mode="create"
        onCopy={onCopy}
        onSendSummaryToQuickAdd={vi.fn()}
        prompt=""
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "제목 복사" }));
    fireEvent.click(view.getByRole("button", { name: "본문 복사" }));
    fireEvent.click(view.getByRole("button", { name: "전체 복사" }));

    // Then: visible document regions and emitted copy payloads use the same draft strings.
    expect(view.getByRole("heading", { level: 3 }).textContent).toBe(draft.title);
    expect(view.getByRole("region", { name: "공문 본문" }).textContent).toBe(draft.body);
    const paperText = view.getByRole("article").textContent ?? "";
    expect(paperText.match(/끝\./gu)).toHaveLength(1);
    for (const attachment of scenario.expectedAttachments.filter((item) => item !== "[확인 필요]")) {
      expect(paperText.split(attachment)).toHaveLength(2);
    }
    expect(onCopy.mock.calls).toEqual([
      ["제목", draft.title],
      ["본문", draft.body],
      ["전체", composeOfficialDocumentDraft(draft)],
    ]);
  });
});
