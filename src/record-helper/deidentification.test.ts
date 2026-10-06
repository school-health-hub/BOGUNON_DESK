import { describe, expect, it } from "vitest";
import {
  deidentifyRecordHelperContent,
  inspectRecordHelperIdentityContent,
  inspectRecordHelperSensitiveContent,
} from "./deidentification";

describe("record helper deidentification", () => {
  it("redacts labeled names, student numbers, phones, RRN, email, and exact hints", () => {
    const reportText = "학생명: 홍길동 학번 20261234 2학년 3반 15번 010-1234-5678 090101-3123456 test@example.com";
    const result = deidentifyRecordHelperContent({ reportText, teacherMemo: "홍길동 연락처 010 9999 8888", studentLabel: "홍길동", classLabel: "2학년 3반 15번" });
    expect(result.reportText).not.toMatch(/홍길동|20261234|2학년 3반 15번|010-1234-5678|090101-3123456|test@example.com/);
    expect(result.teacherMemo).not.toContain("홍길동");
    expect(result.teacherMemo).toBe("[학생] [연락처 제거]");
    expect(result.redactions.length).toBeGreaterThanOrEqual(6);
    expect(reportText).toContain("홍길동");
  });

  it("does not guess normal Korean words as names", () => {
    const reportText = "이름으로 주제를 정함. 이름표를 제작함. 연락처를 정리하는 방법을 조사함. 연락처가 필요한 경우를 토론함. 환경보건 주제로 협력함.";
    const result = deidentifyRecordHelperContent({ reportText, teacherMemo: "", studentLabel: "", classLabel: "" });
    expect(result.reportText).toBe(reportText);
    expect(inspectRecordHelperIdentityContent(reportText)).toEqual([]);
  });

  it("redacts labeled identity values only when a value separator is present", () => {
    const reportText = "이름: 홍길동 이름 김가상 학번: 20261234 연락처: 010-1234-5678";
    const result = deidentifyRecordHelperContent({ reportText, teacherMemo: "", studentLabel: "", classLabel: "" });
    expect(result.reportText).toBe("[학생] [학생] [학번 제거] [연락처 제거]");
    expect(inspectRecordHelperIdentityContent(reportText)).toEqual(expect.arrayContaining([
      "학생 이름",
      "학번",
      "연락처",
    ]));
  });

  it("blocks sensitive content until it is removed", () => {
    expect(inspectRecordHelperSensitiveContent("병원 검사 결과를 상담함")).toEqual(expect.arrayContaining(["병원", "검사 결과", "상담"]));
    expect(inspectRecordHelperSensitiveContent("자료를 조사하고 발표함")).toEqual([]);
    expect(inspectRecordHelperSensitiveContent("검사결과를 기록함")).toContain("검사 결과");
  });

  it("redacts the full grade class number before applying a partial class hint", () => {
    const result = deidentifyRecordHelperContent({ reportText: "2학년 3반 15번 학생", teacherMemo: "", studentLabel: "", classLabel: "2학년 3반" });
    expect(result.reportText).toBe("[학생 식별정보 제거] 학생");
    expect(result.reportText).not.toContain("15번");
  });
});
