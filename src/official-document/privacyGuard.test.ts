import { describe, expect, it } from "vitest";
import { inspectOfficialDocumentPrivacy } from "./privacyGuard";

describe("official document privacy preflight", () => {
  it.each([
    ["학생명: 홍길동", "학생 이름"],
    ["학번: 20261234", "학번"],
    ["연락처: 010-1234-5678", "연락처"],
    ["진단명: 독감", "건강정보"],
    ["검사결과: 양성", "건강정보"],
    ["상담 내용: 개인 심리상담", "건강정보"],
  ])("blocks obvious sensitive text %s", (text, expectedLabel) => {
    const result = inspectOfficialDocumentPrivacy(text);
    expect(result.isSafe).toBe(false);
    expect(result.findings).toContain(expectedLabel);
  });

  it("allows a generic official document with no identifiable student data", () => {
    expect(inspectOfficialDocumentPrivacy("1학년 전체를 대상으로 건강검진 일정을 안내합니다.")).toEqual({
      isSafe: true,
      findings: [],
    });
  });
});
