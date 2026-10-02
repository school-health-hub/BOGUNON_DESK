import { describe, expect, it } from "vitest";
import { buildRecordHelperPrompt } from "./promptBuilder";

describe("record helper prompt builder", () => {
  it("builds the same prompt for the same safe input", () => {
    const input = {
      activityMemo: "모둠 활동에서 자료를 분류하고 발표 준비에 꾸준히 참여함.",
      writingRequest: "협업 과정을 중심으로 정리",
    };

    const prompt = buildRecordHelperPrompt(input);
    const normalizedPrompt = buildRecordHelperPrompt({
      activityMemo: `  ${input.activityMemo}\n`,
      writingRequest: `\n${input.writingRequest}  `,
    });

    expect(prompt).toBe(normalizedPrompt);
    const memoSectionIndex = prompt.lastIndexOf("비식별 활동·관찰 메모");
    expect(prompt.indexOf("작성 원칙")).toBeLessThan(memoSectionIndex);
    expect(memoSectionIndex).toBeLessThan(prompt.indexOf("작성 요청 / 강조할 점"));
    expect(prompt.split(input.activityMemo)).toHaveLength(2);
    expect(prompt.split(input.writingRequest)).toHaveLength(2);
  });

  it("omits the optional request section when it is blank", () => {
    const prompt = buildRecordHelperPrompt({
      activityMemo: "활동 자료를 순서에 맞게 정리함.",
      writingRequest: "   ",
    });

    expect(prompt).not.toContain("작성 요청 / 강조할 점");
  });

  it("forbids fabrication and new identifying or sensitive information", () => {
    const prompt = buildRecordHelperPrompt({
      activityMemo: "토의 내용을 요약해 공유함.",
      writingRequest: "",
    });

    expect(prompt).toContain("새로운 사실, 성과, 태도, 역할을 추정하거나 만들어내지 마세요");
    expect(prompt).toContain("학생 이름, 학번, 연락처 등 식별정보를 새로 생성하지 마세요");
    expect(prompt).toContain("건강정보, 상담정보 등 민감정보를 새로 추가하지 마세요");
  });
});
