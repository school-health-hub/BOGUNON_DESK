import { describe, expect, it } from "vitest";
import { createEmptyOfficialDocumentInput } from "./documentGenerator";
import { buildCreatePrompt, buildRevisionPrompt, buildSummaryPrompt } from "./promptBuilder";

describe("provider-neutral official document prompts", () => {
  it("builds a new-document prompt without provider-specific instructions", () => {
    const prompt = buildCreatePrompt({
      ...createEmptyOfficialDocumentInput(),
      purpose: "안내문 발송",
      workArea: "감염병 확진 안내문 발송",
      target: "전체 학부모",
      mainContent: "감염병 예방수칙 안내",
    });
    expect(prompt).toContain("학교 공문 초안을 작성해 주세요.");
    expect(prompt).toContain("[작성 원칙]");
    expect(prompt).toContain("[입력 정보]");
    expect(prompt).not.toMatch(/OpenAI|Gemini|ChatGPT/);
  });

  it("builds the revision prompt with request, output contract, and original", () => {
    const prompt = buildRevisionPrompt({
      original: "기존 공문 본문",
      request: "제출기한은 9월 23일",
    });
    expect(prompt).toContain("[수정 요청]\n제출기한은 9월 23일");
    expect(prompt).toContain("1. 변경사항 요약");
    expect(prompt).toContain("[원문]\n기존 공문 본문");
    expect(prompt).not.toMatch(/OpenAI|Gemini|ChatGPT/);
  });

  it("builds the summary prompt with every required output field", () => {
    const prompt = buildSummaryPrompt("정리할 공문 본문");
    for (const label of ["내가 해야 할 일", "대상", "제출기한", "제출방법", "제출자료", "붙임", "담당자 확인사항"]) {
      expect(prompt).toContain(label);
    }
    expect(prompt).toContain("[원문]\n정리할 공문 본문");
    expect(prompt).not.toMatch(/OpenAI|Gemini|ChatGPT/);
  });

  it.each([
    ["관련 공문번호", "관련 공문번호"],
    ["법령명", "법령명"],
    ["기관명", "기관명"],
    ["날짜", "날짜"],
    ["금액", "금액"],
    ["수량", "수량"],
    ["붙임", "붙임"],
  ])("forbids inventing an unprovided administrative fact: %s", (_label, expected) => {
    const prompt = buildCreatePrompt(createEmptyOfficialDocumentInput());
    expect(prompt).toContain(expected);
    expect(prompt).toContain("[확인 필요]");
    expect(prompt).toContain("임의로 생성하지 말 것");
  });

  it("keeps revision facts unless the source or request explicitly changes them", () => {
    const prompt = buildRevisionPrompt({ original: "기존 공문 본문", request: "문체를 간결하게 수정" });
    expect(prompt).toContain("원문에 없는 공문번호, 법령명, 지침명, 기관명, 일정, 금액, 붙임을 새로 만들지 말 것");
    expect(prompt).toContain("수정 요청이 명시하지 않은 행정 사실은 원문 값을 유지할 것");
  });

  it("forbids inferring any missing administrative fact while summarizing", () => {
    const prompt = buildSummaryPrompt("정리할 공문 본문");
    expect(prompt).toContain("원문에 명시되지 않은 행정 사실을 추론하거나 만들어내지 말 것");
    expect(prompt).toContain("[확인 필요]");
  });
});
