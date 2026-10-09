import { describe, expect, it } from "vitest";
import { createEmptyOfficialDocumentInput, generateOfficialDocumentDraft } from "./documentGenerator";

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
});
