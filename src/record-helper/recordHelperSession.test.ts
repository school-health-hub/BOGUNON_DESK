import { describe, expect, it } from "vitest";
import { createRecordHelperSession, reduceRecordHelperSession } from "./recordHelperSession";

describe("record helper local session", () => {
  it("starts with memory-only empty inputs", () => {
    expect(createRecordHelperSession()).toEqual({
      activityMemo: "",
      writingRequest: "",
      check: { status: "idle" },
    });
  });

  it("requires an activity memo before local review", () => {
    const checked = reduceRecordHelperSession(createRecordHelperSession(), { type: "checkInput" });

    expect(checked.check).toEqual({
      status: "empty",
      message: "비식별 활동·관찰 메모를 입력해 주세요.",
    });
  });

  it("reports local success for a safe generic memo", () => {
    const withMemo = reduceRecordHelperSession(createRecordHelperSession(), {
      type: "updateActivityMemo",
      value: "모둠 활동에서 준비물을 정리하고 발표에 참여함.",
    });

    expect(reduceRecordHelperSession(withMemo, { type: "checkInput" }).check).toEqual({
      status: "ready",
      message: "비식별 입력 확인 완료. AI 작성 기능은 다음 단계에서 연결됩니다.",
    });
  });

  it("blocks a privacy finding without clearing either input", () => {
    const withMemo = reduceRecordHelperSession(createRecordHelperSession(), {
      type: "updateActivityMemo",
      value: "학생명: 김가상",
    });
    const withRequest = reduceRecordHelperSession(withMemo, {
      type: "updateWritingRequest",
      value: "협업 과정을 강조",
    });
    const checked = reduceRecordHelperSession(withRequest, { type: "checkInput" });

    expect(checked.activityMemo).toBe("학생명: 김가상");
    expect(checked.writingRequest).toBe("협업 과정을 강조");
    expect(checked.check).toEqual({
      status: "blocked",
      findings: ["학생 이름"],
    });
  });

  it("invalidates the previous result when an input changes", () => {
    const populated = reduceRecordHelperSession(createRecordHelperSession(), {
      type: "updateActivityMemo",
      value: "자료 정리 활동에 꾸준히 참여함.",
    });
    const checked = reduceRecordHelperSession(populated, { type: "checkInput" });
    const edited = reduceRecordHelperSession(checked, {
      type: "updateWritingRequest",
      value: "책임감을 강조",
    });

    expect(edited.activityMemo).toBe(populated.activityMemo);
    expect(edited.writingRequest).toBe("책임감을 강조");
    expect(edited.check).toEqual({ status: "idle" });
  });
});
