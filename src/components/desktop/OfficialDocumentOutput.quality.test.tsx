// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { composeOfficialDocumentDraft, generateOfficialDocumentDraft } from "../../official-document/documentGenerator";
import { officialDocumentDraftQualityScenarios } from "../../official-document/documentOutputQuality.fixtures";
import { OfficialDocumentOutput } from "./OfficialDocumentOutput";

describe("OfficialDocumentOutput quality scenarios", () => {
  afterEach(cleanup);

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
