import { createEmptyOfficialDocumentInput } from "./documentGenerator";
import type {
  OfficialDocumentMode,
  OfficialDocumentModeOutput,
  OfficialDocumentSession,
  OfficialDocumentSessionAction,
} from "./types";

const emptyOutput = (): OfficialDocumentModeOutput => ({ prompt: "", aiResponse: "" });

export const createOfficialDocumentSession = (): OfficialDocumentSession => ({
  mode: "create",
  createInput: createEmptyOfficialDocumentInput(),
  revisionInput: { original: "", request: "" },
  revisionSourceName: null,
  summaryOriginal: "",
  summarySourceName: null,
  summaryLocalResult: null,
  draft: null,
  outputs: { create: emptyOutput(), revision: emptyOutput(), summary: emptyOutput() },
  aiStatus: "idle",
  aiError: null,
  activeAiRequestId: null,
});

const invalidateAiRequest = (state: OfficialDocumentSession): OfficialDocumentSession => ({
  ...state,
  aiStatus: "idle",
  aiError: null,
  activeAiRequestId: null,
});

const updateOutput = (
  state: OfficialDocumentSession,
  mode: OfficialDocumentMode,
  output: OfficialDocumentModeOutput,
): OfficialDocumentSession => ({
  ...state,
  outputs: { ...state.outputs, [mode]: output },
});

const clearOutput = (
  state: OfficialDocumentSession,
  mode: OfficialDocumentMode,
): OfficialDocumentSession => updateOutput(state, mode, emptyOutput());

const assertNever = (value: never): never => {
  throw new TypeError(`지원하지 않는 공문 작업실 action: ${String(value)}`);
};

export const reduceOfficialDocumentSession = (
  state: OfficialDocumentSession,
  action: OfficialDocumentSessionAction,
): OfficialDocumentSession => {
  switch (action.type) {
    case "selectMode":
      return invalidateAiRequest({ ...state, mode: action.mode });
    case "updateCreate":
      return invalidateAiRequest(clearOutput({ ...state, createInput: { ...state.createInput, [action.field]: action.value }, draft: null }, "create"));
    case "updateCreatePurpose":
      return invalidateAiRequest(clearOutput({ ...state, createInput: { ...state.createInput, purpose: action.purpose }, draft: null }, "create"));
    case "updateCreateWorkArea":
      return invalidateAiRequest(clearOutput({ ...state, createInput: { ...state.createInput, workArea: action.workArea }, draft: null }, "create"));
    case "updateRevision":
      return invalidateAiRequest(clearOutput({ ...state, revisionInput: action.value }, "revision"));
    case "importRevisionSource":
      return invalidateAiRequest(clearOutput({
        ...state,
        revisionInput: { ...state.revisionInput, original: action.original },
        revisionSourceName: action.sourceName,
      }, "revision"));
    case "updateSummary":
      return invalidateAiRequest(clearOutput({ ...state, summaryOriginal: action.original, summaryLocalResult: null }, "summary"));
    case "importSummarySource":
      return invalidateAiRequest(clearOutput({
        ...state,
        summaryOriginal: action.original,
        summarySourceName: action.sourceName,
        summaryLocalResult: null,
      }, "summary"));
    case "setSummaryLocalResult":
      return { ...state, summaryLocalResult: action.result };
    case "setDraft":
      return { ...state, draft: action.draft };
    case "setPrompt":
      return updateOutput(state, action.mode, { ...state.outputs[action.mode], prompt: action.prompt });
    case "setAiResponse":
      return updateOutput(state, action.mode, { ...state.outputs[action.mode], aiResponse: action.response });
    case "setAiStatus":
      return { ...state, aiStatus: action.status, aiError: action.error };
    case "beginAiRequest":
      return { ...state, activeAiRequestId: action.requestId, aiStatus: "generating", aiError: null };
    case "resolveAiRequest":
      if (state.activeAiRequestId !== action.requestId) return state;
      return updateOutput({ ...state, activeAiRequestId: null, aiStatus: "idle", aiError: null }, action.mode, {
        ...state.outputs[action.mode],
        aiResponse: action.response,
      });
    case "failAiRequest":
      if (state.activeAiRequestId !== action.requestId) return state;
      return { ...state, activeAiRequestId: null, aiStatus: "error", aiError: action.error };
    case "reset":
      return createOfficialDocumentSession();
    default:
      return assertNever(action);
  }
};
