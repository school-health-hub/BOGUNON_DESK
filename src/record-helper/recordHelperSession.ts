import { inspectRecordHelperPrivacy } from "./privacyGuard";
import type { RecordHelperSession, RecordHelperSessionAction } from "./types";

const idleCheck = { status: "idle" } as const;

export const createRecordHelperSession = (): RecordHelperSession => ({
  activityMemo: "",
  writingRequest: "",
  check: idleCheck,
});

const assertNever = (value: never): never => {
  throw new TypeError(`지원하지 않는 생기부 도우미 action: ${String(value)}`);
};

export const reduceRecordHelperSession = (
  state: RecordHelperSession,
  action: RecordHelperSessionAction,
): RecordHelperSession => {
  switch (action.type) {
    case "updateActivityMemo":
      return { ...state, activityMemo: action.value, check: idleCheck };
    case "updateWritingRequest":
      return { ...state, writingRequest: action.value, check: idleCheck };
    case "checkInput": {
      if (state.activityMemo.trim() === "") {
        return {
          ...state,
          check: { status: "empty", message: "비식별 활동·관찰 메모를 입력해 주세요." },
        };
      }
      const privacy = inspectRecordHelperPrivacy(`${state.activityMemo}\n${state.writingRequest}`);
      if (!privacy.isSafe) {
        return { ...state, check: { status: "blocked", findings: privacy.findings } };
      }
      return {
        ...state,
        check: {
          status: "ready",
          message: "비식별 입력 확인 완료. AI 작성 기능은 다음 단계에서 연결됩니다.",
        },
      };
    }
    default:
      return assertNever(action);
  }
};
