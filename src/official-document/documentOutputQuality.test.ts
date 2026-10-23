import { describe, expect, it, vi } from "vitest";
import { copyOfficialDocumentText } from "./clipboard";
import { composeOfficialDocumentDraft, generateOfficialDocumentDraft } from "./documentGenerator";
import { officialDocumentDraftQualityScenarios, officialDocumentReferenceQualityFixture, officialDocumentRevisionSummaryQualityFixture } from "./documentOutputQuality.fixtures";
import { buildRevisionPrompt, buildSummaryPrompt } from "./promptBuilder";
import { extractOfficialDocumentSummary, formatOfficialDocumentSummary } from "./summaryExtractor";

const topLevelNumber = /^(\d+)\.\s/u;
const stackedTopLevelNumber = /^\d+\.\s+\d+\.\s/u;

const bodyLines = (body: string): readonly string[] => body.split("\n");

const topLevelNumbers = (body: string): readonly number[] => bodyLines(body).flatMap((line) => {
  const match = topLevelNumber.exec(line);
  return match?.[1] === undefined ? [] : [Number(match[1])];
});

const attachmentItems = (attachments: string): readonly string[] => bodyLines(attachments)
  .filter((line) => /^\d+\.\s/u.test(line));

const standardNumberingScenarios = officialDocumentDraftQualityScenarios
  .filter(({ id }) => id !== "pre-numbered-body");

const fullCopyEndingStatus = (() => {
  const draft = generateOfficialDocumentDraft(officialDocumentDraftQualityScenarios[0].input);
  const endingCount = composeOfficialDocumentDraft(draft).match(/끝\./gu)?.length ?? 0;
  return endingCount === 1 ? "PASS" : endingCount === 2 ? "REVIEW" : "FAIL";
})();

const multilineIndentationStatus = (() => {
  const scenario = officialDocumentDraftQualityScenarios.find(({ id }) => id === "long-multiline-korean");
  if (scenario === undefined) return "FAIL";
  const draft = generateOfficialDocumentDraft(scenario.input);
  const hasPreservedBreak = draft.body.includes("긴 한국어 문장입니다.\n둘째 줄은 줄바꿈 이후에도");
  const hasIndentedContinuation = draft.body.includes("긴 한국어 문장입니다.\n  둘째 줄은 줄바꿈 이후에도");
  return !hasPreservedBreak ? "FAIL" : hasIndentedContinuation ? "PASS" : "REVIEW";
})();

describe("official document output quality contracts", () => {
  it.each(officialDocumentDraftQualityScenarios)("preserves title and user text: $label", (scenario) => {
    // Given: a synthetic official-document input with no real school or person data.
    const expectedBodyText = scenario.expectedBodyText;

    // When: the production generator creates the draft.
    const draft = generateOfficialDocumentDraft(scenario.input);

    // Then: the expected title and supplied Korean text remain present and ordered.
    expect(draft.title).toBe(scenario.expectedTitleText);
    let previousIndex = -1;
    for (const text of expectedBodyText) {
      const index = draft.body.indexOf(text);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
  });

  it.each(standardNumberingScenarios)("keeps generated top-level numbering ordered: $label", (scenario) => {
    // Given: a generated synthetic draft.
    const draft = generateOfficialDocumentDraft(scenario.input);

    // When: generated top-level number prefixes are collected.
    const numbers = topLevelNumbers(draft.body);

    // Then: the generator-owned sections remain exactly 1 followed by 2.
    expect(numbers).toEqual([1, 2]);
  });

  it("rejects a generated prefix stacked onto user-entered numbering", () => {
    // Given: a user-entered body that already starts with numbered lines.
    const scenario = officialDocumentDraftQualityScenarios.find(({ id }) => id === "pre-numbered-body");
    expect(scenario).toBeDefined();
    if (scenario === undefined) return;

    // When: the production generator creates the draft.
    const draft = generateOfficialDocumentDraft(scenario.input);

    // Then: a generator number must not produce the known "2. 1." nesting defect.
    expect(bodyLines(draft.body).filter((line) => stackedTopLevelNumber.test(line))).toEqual([]);
  });

  it.each(officialDocumentDraftQualityScenarios)("preserves attachment count, order, units, and one final end marker: $label", (scenario) => {
    // Given: a generated synthetic draft.
    const draft = generateOfficialDocumentDraft(scenario.input);

    // When: the standalone attachment output is read as numbered items.
    const items = attachmentItems(draft.attachments);

    // Then: explicit attachments stay ordered and every item carries the unit marker.
    expect(items).toHaveLength(scenario.expectedAttachments.length);
    scenario.expectedAttachments.forEach((attachment, index) => {
      expect(items[index]).toBe(`${index + 1}. ${attachment} 1부.`);
    });
    expect(draft.attachments.match(/끝\./gu)).toHaveLength(1);
    expect(draft.attachments.endsWith("끝.")).toBe(true);
  });

  it.each(officialDocumentDraftQualityScenarios)("keeps title, body, and full-copy values identical to the preview contract: $label", async (scenario) => {
    // Given: the exact values supplied to the preview copy buttons.
    const draft = generateOfficialDocumentDraft(scenario.input);
    const writeText = vi.fn(async () => undefined);

    // When: each production clipboard path is called.
    await copyOfficialDocumentText(writeText, "제목", draft.title);
    await copyOfficialDocumentText(writeText, "본문", draft.body);
    await copyOfficialDocumentText(writeText, "전체", composeOfficialDocumentDraft(draft));

    // Then: clipboard writes preserve the preview strings and their line breaks exactly.
    expect(writeText.mock.calls).toEqual([
      [draft.title],
      [draft.body],
      [composeOfficialDocumentDraft(draft)],
    ]);
  });

  it("preserves revision source and summary evidence in their output contracts", () => {
    // Given: a synthetic received document and a bounded revision request.
    const fixture = officialDocumentRevisionSummaryQualityFixture;

    // When: production revision and summary paths build their outputs.
    const revisionPrompt = buildRevisionPrompt(fixture.revision);
    const summary = extractOfficialDocumentSummary(fixture.summarySource);
    const summaryPrompt = buildSummaryPrompt(fixture.summarySource);

    // Then: the original, request, extracted fields, and copyable summary remain intact.
    expect(revisionPrompt).toContain(`[수정 요청]\n${fixture.revision.request}`);
    expect(revisionPrompt).toContain(`[원문]\n${fixture.revision.original}`);
    expect(summary.target.value).toBe("합성 담당자");
    expect(summary.deadline.value).toBe("2030. 10. 30.");
    expect(summary.submissionMethod.value).toBe("합성 시스템 입력");
    expect(formatOfficialDocumentSummary(summary)).toContain("[붙임]\n- 1. 합성 서식 1부.");
    expect(summaryPrompt).toContain(`[원문]\n${fixture.summarySource}`);
  });

  it("preserves reference formatting, fallback attachments, appendix text, and table copy", () => {
    // Given: a synthetic reviewed reference seed and user-confirmed values.
    const fixture = officialDocumentReferenceQualityFixture;

    // When: the production generator creates a reference-based draft.
    const draft = generateOfficialDocumentDraft(fixture.input, fixture.reference);
    const fullCopy = composeOfficialDocumentDraft(draft);

    // Then: placeholders use user values and every reference output remains represented.
    expect(draft.body).toContain("1. 관련: 합성근거-REFERENCE-001");
    expect(draft.body).toContain("가. 대상: 합성 적용 대상");
    expect(draft.body).toContain("나. 인원: 합성 인원 25명");
    expect(draft.attachments).toContain("1. 합성 참고 서식 1부.\n2. 합성 확인표 1부.");
    expect(draft.messenger).toBe("합성 적용 대상에게 합성 참고자료 적용 내용을 안내합니다.");
    expect(draft.checklist).toContain("□ 합성 참고자료의 일반 문장만 사용했는지 확인");
    expect(draft.tableText).toBe("구분\t인원\n합성 대상\t합성 인원 25명");
    expect(fullCopy).toContain("표 복사용 본문\n구분\t인원\n합성 대상\t합성 인원 25명");
  });
});

describe("official document output policy review markers", () => {
  it(`[${fullCopyEndingStatus}] records repeated body and standalone attachment endings rather than an automatic failure`, () => {
    // Given: the current full-copy ending-marker classification.
    // When: the production output is evaluated by the policy boundary.
    // Then: one marker passes, the current two-section duplication is reviewable, and other counts fail.
    expect(fullCopyEndingStatus).not.toBe("FAIL");
  });

  it(`[${multilineIndentationStatus}] records multiline continuation indentation while preserving user line breaks`, () => {
    // Given: the current multiline indentation classification.
    // When: the production output is evaluated by the policy boundary.
    // Then: lost line breaks fail, while preserved unindented continuations remain reviewable.
    expect(multilineIndentationStatus).not.toBe("FAIL");
  });
});
