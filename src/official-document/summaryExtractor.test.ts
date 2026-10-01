import { describe, expect, it } from "vitest";
import { extractOfficialDocumentSummary, formatOfficialDocumentSummary } from "./summaryExtractor";

const completeDocument = `2026년 보건교사 연수 참석 안내
가. 대상: 관내 고등학교 보건교사
나. 행사일시: 2026. 9. 20.(일) 14:00
다. 제출기한: 2026. 9. 23.(수)까지
라. 제출방법: 업무관리시스템 공문 제출
마. 제출자료
- 붙임 1 참석자 명단
- 개인정보 수집 동의서
참석 희망자는 붙임 서식을 작성하여 제출하여 주시기 바랍니다.
붙임  1. 참석자 명단 서식 1부.
      2. 운영계획 1부.  끝.
문의: ○○교육지원청 보건과 02-123-4567`;

describe("extractOfficialDocumentSummary", () => {
  it("extracts explicit fields and preserves their original evidence", () => {
    const summary = extractOfficialDocumentSummary(completeDocument);

    expect(summary.target).toEqual({
      value: "관내 고등학교 보건교사",
      evidence: "가. 대상: 관내 고등학교 보건교사",
    });
    expect(summary.deadline.value).toBe("2026. 9. 23.(수)");
    expect(summary.deadline.evidence).toBe("다. 제출기한: 2026. 9. 23.(수)까지");
    expect(summary.submissionMethod.value).toBe("업무관리시스템 공문 제출");
    expect(summary.contact.value).toContain("○○교육지원청 보건과");
  });

  it("collects bounded materials and attachments in source order", () => {
    const summary = extractOfficialDocumentSummary(completeDocument);

    expect(summary.materials.map((item) => item.value)).toEqual([
      "붙임 1 참석자 명단",
      "개인정보 수집 동의서",
    ]);
    expect(summary.attachments.map((item) => item.value)).toEqual([
      "1. 참석자 명단 서식 1부.",
      "2. 운영계획 1부.",
    ]);
  });

  it("extracts at most three explicit action requests", () => {
    const summary = extractOfficialDocumentSummary(`자료는 홈페이지에 게시합니다.
참석 희망자는 명단을 제출하여 주시기 바랍니다.
교육 신청 바랍니다.
기관별 결과를 회신 바랍니다.
시스템에 현황을 입력 바랍니다.`);

    expect(summary.actions).toHaveLength(3);
    expect(summary.actions.map((item) => item.value)).toEqual([
      "참석 희망자는 명단을 제출하여 주시기 바랍니다.",
      "교육 신청 바랍니다.",
      "기관별 결과를 회신 바랍니다.",
    ]);
  });

  it("does not infer target, deadline, method, or attachments from incidental prose", () => {
    const summary = extractOfficialDocumentSummary(`학생 대상 교육을 운영합니다.
행사일시: 2026. 9. 20.(일)
담당자 이메일 example@example.com
세부 내용은 붙임을 참고하시기 바랍니다.`);

    expect(summary.target.value).toBeNull();
    expect(summary.deadline.value).toBeNull();
    expect(summary.submissionMethod.value).toBeNull();
    expect(summary.attachments).toEqual([]);
  });

  it("selects the explicitly labeled deadline when the document has several dates", () => {
    const summary = extractOfficialDocumentSummary(`행사일시: 2026. 9. 20.(일)
신청기한: 2026-09-18
운영기간: 2026. 9. 20. ~ 9. 30.`);

    expect(summary.deadline.value).toBe("2026-09-18");
  });

  it("supports a conservative next-line value after an explicit label", () => {
    const summary = extractOfficialDocumentSummary(`제출대상:
관내 특수학교
제출 방법
자료집계시스템 입력
문의처
○○과 장학사`);

    expect(summary.target.value).toBe("관내 특수학교");
    expect(summary.submissionMethod.value).toBe("자료집계시스템 입력");
    expect(summary.contact.value).toBe("○○과 장학사");
  });

  it("stops material collection at the next explicit section", () => {
    const summary = extractOfficialDocumentSummary(`제출자료
- 참가 신청서
- 개인정보 동의서
제출기한: 9월 23일
문의: 교육지원과`);

    expect(summary.materials.map((item) => item.value)).toEqual(["참가 신청서", "개인정보 동의서"]);
    expect(summary.deadline.value).toBe("9월 23일");
  });

  it("supports separated and compact attachment headings", () => {
    const separated = extractOfficialDocumentSummary(`붙임:
1. 신청서 1부.
2. 운영계획 1부.  끝.`);
    const compact = extractOfficialDocumentSummary("붙임1. 참석자 명단 1부.");

    expect(separated.attachments.map((item) => item.value)).toEqual([
      "1. 신청서 1부.",
      "2. 운영계획 1부.",
    ]);
    expect(compact.attachments[0]?.value).toBe("1. 참석자 명단 1부.");
  });

  it("caps collected material items at ten", () => {
    const items = Array.from({ length: 12 }, (_, index) => `- 제출 서식 ${index + 1}`).join("\n");
    const summary = extractOfficialDocumentSummary(`제출자료\n${items}`);

    expect(summary.materials).toHaveLength(10);
  });

  it("handles PDF-like whitespace without rewriting evidence", () => {
    const source = "○  제출대상:   관내 보건교사\n○ 제출 기간:  2026. 9. 23. ~ 9. 30.";
    const summary = extractOfficialDocumentSummary(source);

    expect(summary.target.value).toBe("관내 보건교사");
    expect(summary.target.evidence).toBe("○  제출대상:   관내 보건교사");
    expect(summary.deadline.value).toBe("2026. 9. 23. ~ 9. 30.");
  });

  it("leaves every missing field empty instead of inventing facts", () => {
    const summary = extractOfficialDocumentSummary("교육과정 운영에 협조해 주시기 바랍니다.");

    expect(summary).toEqual({
      actions: [],
      target: { value: null, evidence: null },
      deadline: { value: null, evidence: null },
      submissionMethod: { value: null, evidence: null },
      materials: [],
      attachments: [],
      contact: { value: null, evidence: null },
    });
  });

  it("formats a copyable summary without evidence or invented values", () => {
    const text = formatOfficialDocumentSummary(extractOfficialDocumentSummary(completeDocument));

    expect(text).toContain("[내가 해야 할 일]\n- 참석 희망자는 붙임 서식을 작성하여 제출하여 주시기 바랍니다.");
    expect(text).toContain("[대상]\n관내 고등학교 보건교사");
    expect(text).toContain("[제출자료]\n- 붙임 1 참석자 명단");
    expect(text).toContain("[붙임]\n- 1. 참석자 명단 서식 1부.");
    expect(text).not.toContain("근거:");
  });
});
