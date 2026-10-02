import { inspectRecordHelperPrivacy } from "./privacyGuard";
import type { RecordHelperSession, RecordHelperSessionAction } from "./types";

const idleCheck = { status: "idle" } as const;

export const createRecordHelperSession = (): RecordHelperSession => ({
  activityMemo: "",
  writingRequest: "",
  check: idleCheck,
  aiStatus: "idle",
  aiResponse: "",
  aiError: null,
  activeAiRequestId: null,
});

const invalidateAi = (state: RecordHelperSession): RecordHelperSession => ({
  ...state,
  check: idleCheck,
  aiStatus: "idle",
  aiResponse: "",
  aiError: null,
  activeAiRequestId: null,
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
      return invalidateAi({ ...state, activityMemo: action.value });
    case "updateWritingRequest":
      return invalidateAi({ ...state, writingRequest: action.value });
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
          message: "비식별 입력 확인 완료. AI 작성 전 전송 내용을 확인할 수 있습니다.",
        },
      };
    }
    case "beginAiRequest":
      return {
        ...state,
        activeAiRequestId: action.requestId,
        aiStatus: "generating",
        aiResponse: "",
        aiError: null,
      };
    case "resolveAiRequest":
      if (state.activeAiRequestId !== action.requestId) return state;
      return {
        ...state,
        activeAiRequestId: null,
        aiStatus: "success",
        aiResponse: action.response,
        aiError: null,
      };
    case "failAiRequest":
      if (state.activeAiRequestId !== action.requestId) return state;
      return {
        ...state,
        activeAiRequestId: null,
        aiStatus: "error",
        aiError: action.error,
      };
    default:
      return assertNever(action);
  }
};
