import { describe, expect, it } from "vitest";
import { inspectRecordHelperPrivacy } from "./privacyGuard";

describe("record helper privacy guard", () => {
  it.each([
    ["학생명: 김가상", "학생 이름"],
    ["학번: 20269999", "학번"],
    ["010-2345-6789", "휴대전화번호"],
    ["991231-2345678", "주민등록번호"],
    ["student@example.test", "이메일"],
    ["연락처: 보호자 전화", "연락처"],
  ])("detects identifying text %s", (text, expectedLabel) => {
    const result = inspectRecordHelperPrivacy(text);

    expect(result.isSafe).toBe(false);
    expect(result.findings).toContain(expectedLabel);
  });

  it.each([
    "진단명: 가상 질환",
    "질병 관련 메모",
    "치료 경과",
    "병원 방문",
    "상담 내용: 가상 상담",
    "검사결과: 가상 결과",
    "장애 관련 지원",
    "특수교육 대상 여부",
  ])("detects sensitive school-record labels in %s", (text) => {
    expect(inspectRecordHelperPrivacy(text)).toMatchObject({
      isSafe: false,
      findings: ["건강·민감정보"],
    });
  });

  it("allows a generic non-identifying activity memo", () => {
    expect(inspectRecordHelperPrivacy("모둠 활동에서 자료를 정리하고 발표 준비에 꾸준히 참여함.")).toEqual({
      isSafe: true,
      findings: [],
    });
  });
});
