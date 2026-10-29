import { describe, expect, it } from "vitest";
import { composeOfficialDocumentDraft, createEmptyOfficialDocumentInput, generateOfficialDocumentDraft } from "./documentGenerator";

describe("attachment quantities", () => {
  it.each([
    ["확인표", "확인표 1부."],
    ["확인표 1부.", "확인표 1부."],
    ["운영계획서 2부", "운영계획서 2부."],
    ["참고자료 1매", "참고자료 1매."],
    ["제2부 운영계획", "제2부 운영계획 1부."],
    ["1매 크기 참고자료", "1매 크기 참고자료 1부."],
  ])("formats %s without duplicating a terminal quantity", (attachments, expected) => {
    const input = { ...createEmptyOfficialDocumentInput(), attachments };
    const draft = generateOfficialDocumentDraft(input);
    expect(draft.body).toContain(`붙임  ${expected}  끝.`);
    expect(draft.attachments).toBe(`붙임\n1. ${expected}\n끝.`);
  });

  it("keeps mixed attachment order and multiline content", () => {
    const input = { ...createEmptyOfficialDocumentInput(), attachments: "확인표, 운영계획서 2부;참고자료 1매.", mainContent: "첫째 일반 문장입니다.\n둘째 일반 문장입니다." };
    const draft = generateOfficialDocumentDraft(input);
    expect(draft.body).toContain("붙임  확인표 1부.\n운영계획서 2부.\n참고자료 1매.  끝.");
    expect(draft.body).toContain("첫째 일반 문장입니다.\n  둘째 일반 문장입니다.");
    expect(draft.body.match(/끝\./gu)).toHaveLength(1);
  });

  it.each([false, true])("preserves quantities from the selected source (user override: %s)", (override) => {
    const reference = { templateBody: "1. 합성 본문", attachmentExample: "참고 확인표 2부", messengerExample: "", checklist: "", tableCopyText: "", tableCopyGuide: "" };
    const input = { ...createEmptyOfficialDocumentInput(), attachments: override ? "사용자 확인표 1매." : "" };
    const draft = generateOfficialDocumentDraft(input, reference);
    const expected = override ? "사용자 확인표 1매." : "참고 확인표 2부.";
    expect(draft.body).toBe(`1. 합성 본문\n\n붙임  ${expected}  끝.`);
    expect(draft.attachments).toBe(`붙임\n1. ${expected}\n끝.`);
    expect(composeOfficialDocumentDraft(draft).split(expected)).toHaveLength(2);
  });
});

const completeInput = {
  ...createEmptyOfficialDocumentInput(),
  purpose: "계획 기안" as const,
  workArea: "건강검진 시행계획" as const,
  schoolYear: "2026학년도",
  schoolName: "○○고등학교",
  relatedDocument: "교육지원청 보건교육과-0000(2026. 3. 2.)",
  workName: "1학년 건강검진 시행계획",
  target: "1학년 학생 전체",
  dateTime: "2026. 6. 18.(목) 09:00~12:00",
  place: "각 반 교실 및 보건실",
  method: "검진기관 방문 검진",
  organization: "○○검진기관",
  peopleCount: "학생 180명",
  budget: "비예산",
  mainContent: "학생 건강검진을 원활하게 실시하기 위한 세부 운영 계획 수립",
  attachments: "건강검진 안내 가정통신문, 검진 일정표",
  notes: "미검자는 추후 별도 안내",
};

describe("official document deterministic generator", () => {
  it("creates a title without duplicating an existing purpose suffix", () => {
    expect(generateOfficialDocumentDraft(completeInput).title).toBe("2026학년도 1학년 건강검진 시행계획");
  });

  it("builds related-document and numbered official body sections", () => {
    const body = generateOfficialDocumentDraft(completeInput).body;
    expect(body).toContain("1. 관련: 교육지원청 보건교육과-0000(2026. 3. 2.)");
    expect(body).toContain("2. 학생 건강검진을 원활하게 실시하기 위한 세부 운영 계획 수립을(를) 위해 다음과 같이 시행하고자 합니다.");
    expect(body).toContain("가. 대상: 1학년 학생 전체");
    expect(body).toContain("라. 방법: 검진기관 방문 검진");
    expect(body).toContain("붙임  건강검진 안내 가정통신문 1부.\n검진 일정표 1부.  끝.");
  });

  it("creates attachments, messenger copy, and the pre-draft checklist", () => {
    const result = generateOfficialDocumentDraft(completeInput);
    expect(result.attachments).toContain("1. 건강검진 안내 가정통신문 1부.");
    expect(result.messenger).toContain("1학년 건강검진 시행계획 안내");
    expect(result.checklist).toContain("□ 관련 공문 번호와 시행 근거를 확인했습니다.");
    expect(result.checklist).toContain("검진기관, 일정, 대상 학년을 확인합니다.");
  });

  it("omits empty optional detail rows and uses the fallback template", () => {
    const result = generateOfficialDocumentDraft({
      ...createEmptyOfficialDocumentInput(),
      purpose: "결과 보고",
      workArea: "기타",
    });
    expect(result.title).toBe("기타 보건업무 결과보고");
    expect(result.body).toContain("1. 관련: [입력 필요]");
    expect(result.body).toContain("가. 세부 내용: [입력 필요]");
    expect(result.body).not.toContain("기관명:");
    expect(result.attachments).toContain("[확인 필요]");
    expect(result.attachments).not.toContain("관련 계획 또는 결과 자료");
  });

  it("uses only attachments explicitly entered by the user", () => {
    const result = generateOfficialDocumentDraft({
      ...completeInput,
      attachments: "사용자 입력 붙임",
    });
    expect(result.attachments).toContain("사용자 입력 붙임");
    expect(result.attachments).not.toContain("검진 일정표");
  });

  it("ends an attachment-free body after its final content without fabricating an attachment", () => {
    // Given: a synthetic document with no attachment input.
    const input = {
      ...createEmptyOfficialDocumentInput(),
      mainContent: "합성 본문 마지막 내용",
    };

    // When: the deterministic generator creates the body.
    const body = generateOfficialDocumentDraft(input).body;

    // Then: the canonical body has no placeholder attachment and owns one terminal marker.
    expect(body).not.toContain("붙임");
    expect(body).not.toContain("[붙임 자료 입력 필요]");
    expect(body.match(/끝\./gu)).toHaveLength(1);
    expect(body.endsWith("끝.")).toBe(true);
  });

  it.each([
    ["one", "합성 붙임", ["합성 붙임"]],
    ["many", "합성 붙임 A, 합성 붙임 B", ["합성 붙임 A", "합성 붙임 B"]],
  ] as const)("includes %s attachment input once in the canonical body", (_label, attachments, expectedItems) => {
    // Given: one or more synthetic attachment names.
    const input = { ...createEmptyOfficialDocumentInput(), mainContent: "합성 본문", attachments };

    // When: the deterministic generator creates the body.
    const body = generateOfficialDocumentDraft(input).body;

    // Then: every attachment occurs once and the body has one terminal marker.
    for (const item of expectedItems) {
      expect(body.match(new RegExp(item, "gu"))).toHaveLength(1);
    }
    expect(body.match(/끝\./gu)).toHaveLength(1);
  });

  it.each([
    ["attachment and end", "1. 합성 참고 본문\n붙임  합성 참고 서식 1부.  끝."],
    ["attachment without end", "1. 합성 참고 본문\n붙임  합성 참고 서식 1부."],
    ["multiline attachments and end", "1. 합성 참고 본문\n붙임\n1. 합성 참고 서식 1부.\n2. 합성 참고 목록 1부.  끝."],
  ] as const)("normalizes a reference template with %s to one terminal marker", (_label, templateBody) => {
    // Given: a reference template that owns an attachment block.
    const reference = {
      templateBody,
      attachmentExample: "",
      messengerExample: "",
      checklist: "",
      tableCopyText: "",
      tableCopyGuide: "",
    };

    // When: the reference-based draft is generated.
    const body = generateOfficialDocumentDraft(createEmptyOfficialDocumentInput(), reference).body;

    // Then: the reference attachment remains once and the completed body ends once.
    expect(body.match(/합성 참고 서식/gu)).toHaveLength(1);
    expect(body.match(/끝\./gu)).toHaveLength(1);
    expect(body.endsWith("끝.")).toBe(true);
  });

  it("does not treat ordinary user prose ending in 끝. as the generator-owned terminal marker", () => {
    // Given: a reference body whose ordinary sentence happens to end with the word 끝.
    const reference = {
      templateBody: "1. 합성 참고 본문\n2. 업무 설명은 끝.",
      attachmentExample: "",
      messengerExample: "",
      checklist: "",
      tableCopyText: "",
      tableCopyGuide: "",
    };

    // When: the reference-based draft is generated without attachments.
    const body = generateOfficialDocumentDraft(createEmptyOfficialDocumentInput(), reference).body;

    // Then: the user's sentence remains and a distinct generator boundary is appended.
    expect(body).toBe("1. 합성 참고 본문\n2. 업무 설명은 끝.  끝.");
  });

  it("does not treat a user placeholder value ending with a standalone 끝. as the template boundary", () => {
    // Given: user content ending in a standalone end phrase fills a reference placeholder.
    const reference = {
      templateBody: "1. 합성 참고 본문\n2. 주요 내용: [주요 내용]",
      attachmentExample: "",
      messengerExample: "",
      checklist: "",
      tableCopyText: "",
      tableCopyGuide: "",
    };
    const input = {
      ...createEmptyOfficialDocumentInput(),
      mainContent: "합성 사용자 설명\n끝.",
    };

    // When: the placeholder is rendered into the reference body.
    const body = generateOfficialDocumentDraft(input, reference).body;

    // Then: user text remains and the generator appends its own distinct terminal boundary.
    expect(body).toBe("1. 합성 참고 본문\n2. 주요 내용: 합성 사용자 설명\n끝.  끝.");
  });

  it("ends a reference body without attachments after its content", () => {
    // Given: a reference template and no attachment input or example.
    const reference = {
      templateBody: "1. 합성 참고 본문",
      attachmentExample: "",
      messengerExample: "",
      checklist: "",
      tableCopyText: "",
      tableCopyGuide: "",
    };

    // When: the reference-based draft is generated.
    const body = generateOfficialDocumentDraft(createEmptyOfficialDocumentInput(), reference).body;

    // Then: no placeholder attachment is fabricated and one terminal marker is appended.
    expect(body).toBe("1. 합성 참고 본문  끝.");
  });

  it("places reference attachment examples once in the canonical body", () => {
    // Given: a reference whose attachment examples are the only attachment source.
    const reference = {
      templateBody: "1. 합성 참고 본문",
      attachmentExample: "합성 참고 서식, 합성 참고 목록",
      messengerExample: "",
      checklist: "",
      tableCopyText: "",
      tableCopyGuide: "",
    };

    // When: the reference-based draft is generated without user attachment input.
    const draft = generateOfficialDocumentDraft(createEmptyOfficialDocumentInput(), reference);

    // Then: fallback attachments are part of the canonical body exactly once.
    expect(draft.body.match(/합성 참고 서식/gu)).toHaveLength(1);
    expect(draft.body.match(/합성 참고 목록/gu)).toHaveLength(1);
    expect(draft.body.match(/끝\./gu)).toHaveLength(1);
  });

  it("replaces stale reference attachments with user-confirmed attachments", () => {
    // Given: a reference template with a stale attachment and an explicit user attachment.
    const reference = {
      templateBody: "1. 합성 참고 본문\n\n붙임  오래된 참고 붙임 1부.  끝.",
      attachmentExample: "오래된 참고 예시",
      messengerExample: "",
      checklist: "",
      tableCopyText: "",
      tableCopyGuide: "",
    };
    const input = {
      ...createEmptyOfficialDocumentInput(),
      attachments: "사용자 확정 붙임",
    };

    // When: the user-confirmed input is applied to the reference draft.
    const draft = generateOfficialDocumentDraft(input, reference);
    const fullCopy = composeOfficialDocumentDraft(draft);

    // Then: the stale template data is gone and the confirmed attachment is canonical once.
    expect(draft.body).not.toContain("오래된 참고 붙임");
    expect(draft.body).not.toContain("오래된 참고 예시");
    expect(draft.body.match(/사용자 확정 붙임/gu)).toHaveLength(1);
    expect(draft.body.match(/끝\./gu)).toHaveLength(1);
    expect(fullCopy.match(/사용자 확정 붙임/gu)).toHaveLength(1);
    expect(fullCopy.match(/끝\./gu)).toHaveLength(1);
  });

  it("preserves a user-authored non-terminal end phrase and appends the generator boundary", () => {
    // Given: user prose containing an end phrase that is not the document boundary.
    const input = {
      ...createEmptyOfficialDocumentInput(),
      mainContent: "이 문장의 표현은 끝. 다음 설명은 계속됩니다.",
    };

    // When: the body is generated.
    const body = generateOfficialDocumentDraft(input).body;

    // Then: user prose is retained and a separate terminal marker completes the body.
    expect(body).toContain("이 문장의 표현은 끝. 다음 설명은 계속됩니다.");
    expect(body.match(/이 문장의 표현은 끝\. 다음 설명은 계속됩니다\./gu)).toHaveLength(2);
    expect(body.match(/끝\.\s*$/gu)).toHaveLength(1);
    expect(body.endsWith("끝.")).toBe(true);
  });

  it("preserves explicit internal newlines and post-newline indentation", () => {
    // Given: ordinary prose with a user-authored newline and indentation.
    const mainContent = "첫째 일반 문장입니다.\n    둘째 일반 문장입니다.";

    // When: the body is generated.
    const body = generateOfficialDocumentDraft({ ...createEmptyOfficialDocumentInput(), mainContent }).body;

    // Then: the explicit newline and its four user spaces remain unchanged.
    expect(body).toContain("2. 주요 내용\n  첫째 일반 문장입니다.\n      둘째 일반 문장입니다.");
    expect(body).not.toContain("입니다.을(를)");
  });

  it.each(["1. 사전 준비", "가. 사전 준비", "1) 사전 준비", "가) 사전 준비"])(
    "preserves an existing list marker in main content: %s",
    (mainContent) => {
      // Given: synthetic main content that already owns its list marker.
      const input = { ...createEmptyOfficialDocumentInput(), mainContent };

      // When: the deterministic generator creates the body.
      const body = generateOfficialDocumentDraft(input).body;

      // Then: the user marker remains intact without a generated top-level prefix.
      expect(body).toContain(`\n\n2. 주요 내용\n  ${mainContent}`);
      expect(body.endsWith(`${mainContent}  끝.`)).toBe(true);
      expect(body).not.toContain(`2. ${mainContent}`);
      expect(body).not.toContain("세부 내용: [입력 필요]");
      expect(body.match(new RegExp(mainContent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gu"))).toHaveLength(1);
    },
  );

  it.each([
    ["계획 기안", "합성 운영 시행", "합성 운영 시행계획"],
    ["결과 보고", "합성 검진 결과", "합성 검진 결과보고"],
    ["안내문 발송", "합성 감염병 안내문", "합성 감염병 안내문 발송"],
    ["실적 보고", "합성 교육 실적", "합성 교육 실적 보고"],
    ["외부기관 제출", "합성 검진 결과", "합성 검진 결과 제출"],
  ] as const)("joins an overlapping purpose suffix once: %s", (purpose, workName, expectedTitle) => {
    // Given: a synthetic work name ending with the suffix's leading semantic term.
    const input = { ...createEmptyOfficialDocumentInput(), purpose, workName };

    // When: the deterministic generator creates the title.
    const title = generateOfficialDocumentDraft(input).title;

    // Then: the shared boundary is emitted once without deleting unrelated repeated words.
    expect(title).toBe(expectedTitle);
  });

  it("keeps ordinary Korean prose in the generated purpose sentence", () => {
    // Given: ordinary prose whose first syllable is not a supported sequence marker.
    const mainContent = "끝. 세부 결과를 보고합니다.";

    // When: the deterministic generator creates the body.
    const body = generateOfficialDocumentDraft({ ...createEmptyOfficialDocumentInput(), mainContent }).body;

    // Then: the prose keeps the normal generated section framing.
    expect(body).toContain(`2. ${mainContent}을(를) 위해 다음과 같이 시행하고자 합니다.`);
  });
});
