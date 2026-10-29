import { describe, expect, it, vi } from "vitest";
import { copyOfficialDocumentText } from "./clipboard";
import { composeOfficialDocumentDraft, createEmptyOfficialDocumentInput, generateOfficialDocumentDraft } from "./documentGenerator";
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
    expect(draft.body.match(/합성 참고 서식/gu)).toHaveLength(1);
    expect(draft.body.match(/합성 확인표/gu)).toHaveLength(1);
    expect(draft.messenger).toBe("합성 적용 대상에게 합성 참고자료 적용 내용을 안내합니다.");
    expect(draft.checklist).toContain("□ 합성 참고자료의 일반 문장만 사용했는지 확인");
    expect(draft.tableText).toBe("구분\t인원\n합성 대상\t합성 인원 25명");
    expect(fullCopy).toContain("표 복사용 본문\n구분\t인원\n합성 대상\t합성 인원 25명");
    expect(fullCopy.match(/합성 참고 서식/gu)).toHaveLength(1);
    expect(fullCopy.match(/합성 확인표/gu)).toHaveLength(1);
    expect(fullCopy.match(/끝\./gu)).toHaveLength(1);
  });

  it.each(officialDocumentDraftQualityScenarios)("keeps one canonical attachment representation and terminal marker in full copy: $label", (scenario) => {
    // Given: a synthetic production draft with no user-authored end phrase.
    const draft = generateOfficialDocumentDraft(scenario.input);

    // When: the complete copy payload is assembled.
    const fullCopy = composeOfficialDocumentDraft(draft);

    // Then: the canonical body is not followed by a duplicate auxiliary attachment section.
    expect(fullCopy.match(/끝\./gu)).toHaveLength(1);
    expect(fullCopy.match(/^붙임 목록$/gmu)).toEqual(null);
    for (const attachment of scenario.expectedAttachments.filter((item) => item !== "[확인 필요]")) {
      expect(fullCopy.split(attachment)).toHaveLength(2);
    }
  });

  it("preserves list markers and post-newline user indentation", () => {
    // Given: user-owned structured content with four spaces on a continuation line.
    const scenario = officialDocumentDraftQualityScenarios.find(({ id }) => id === "pre-numbered-body");
    expect(scenario).toBeDefined();
    if (scenario === undefined) return;
    const input = {
      ...scenario.input,
      mainContent: "1. 사전 준비\n    세부 준비\n가. 당일 운영\n1) 확인 항목\n가) 마무리",
    };

    // When: the production generator creates the draft.
    const body = generateOfficialDocumentDraft(input).body;

    // Then: markers, line order, and user indentation remain present without viewport-derived breaks.
    expect(body).toContain("  1. 사전 준비\n      세부 준비\n  가. 당일 운영\n  1) 확인 항목\n  가) 마무리");
  });
});

describe("ordinary multiline output quality contracts", () => {
  it.each([
    ["two sentences", "첫째 일반 문장입니다.\n둘째 일반 문장입니다."],
    ["three sentences", "첫째 일반 문장입니다.\n둘째 일반 문장입니다.\n셋째 일반 문장입니다."],
    ["blank line", "첫째 일반 문장입니다.\n\n둘째 일반 문장입니다."],
    ["leading whitespace", "    첫째 일반 문장입니다.\n    둘째 일반 문장입니다."],
    ["Korean particles", "학생 건강을 확인합니다.\n안내 자료를 전달합니다."],
    ["leading newline", "\n첫째 일반 문장입니다."],
    ["trailing newline", "첫째 일반 문장입니다.\n"],
  ])("preserves ordinary multiline text without a purpose suffix: %s", (_label, mainContent) => {
    // Given: ordinary synthetic sentences with user-owned line breaks and spaces.
    const input = { ...officialDocumentDraftQualityScenarios[0].input, mainContent, attachments: "합성 안내문" };
    // When: the production generator creates a draft and complete copy.
    const draft = generateOfficialDocumentDraft(input);
    const fullCopy = composeOfficialDocumentDraft(draft);
    // Then: sentences appear once, retaining user whitespace and document boundaries.
    const block = mainContent.split("\n").map((line) => "  " + line).join("\n");
    expect(draft.body).toContain("2. 주요 내용\n" + block);
    expect(draft.body).not.toContain("을(를) 위해");
    expect(draft.body).not.toContain("아. 주요 내용:");
    for (const sentence of mainContent.split("\n").map((line) => line.trim()).filter(Boolean)) {
      expect(draft.body.split(sentence)).toHaveLength(2);
    }
    expect(draft.title).toBe(generateOfficialDocumentDraft({ ...input, mainContent: "" }).title);
    expect(draft.body.match(/합성 안내문 1부\./gu)).toHaveLength(1);
    expect(fullCopy).toContain(draft.body);
    expect(fullCopy.match(/끝\./gu)).toHaveLength(1);
  });

  it("retains the existing single-line purpose construction", () => {
    // Given: a single-line purpose previously receiving the purpose particle.
    const input = { ...officialDocumentDraftQualityScenarios[0].input, mainContent: "학생 건강 확인" };
    // When: the normal draft is generated.
    const body = generateOfficialDocumentDraft(input).body;
    // Then: the established single-line construction is unchanged.
    expect(body).toContain("2. 학생 건강 확인을(를) 위해 다음과 같이 시행하고자 합니다.");
  });

  it.each(["", "합성 확인표"])("retains trailing user whitespace before the document boundary: %s", (attachments) => {
    // Given: no optional detail fields can mask trimming of the user-owned block.
    const input = {
      ...createEmptyOfficialDocumentInput(),
      mainContent: "첫째 일반 문장입니다.\n둘째 일반 문장입니다.  \n",
      attachments,
    };
    // When: the draft is generated with or without an attachment boundary.
    const body = generateOfficialDocumentDraft(input).body;
    // Then: user trailing spaces and the explicit final newline precede the generated boundary.
    expect(body).toContain("2. 주요 내용\n  첫째 일반 문장입니다.\n  둘째 일반 문장입니다.  \n  ");
    expect(body.match(/끝\./gu)).toHaveLength(1);
  });
});
