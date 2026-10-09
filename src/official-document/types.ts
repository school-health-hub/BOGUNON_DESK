import type { OfficialDocumentPurpose, OfficialDocumentWorkArea } from "./options";
import type { OfficialDocumentLocalSummary } from "./summaryExtractor";

export const officialDocumentModes = ["create", "revision", "summary"] as const;
export type OfficialDocumentMode = (typeof officialDocumentModes)[number];

export type OfficialDocumentInput = {
  readonly purpose: OfficialDocumentPurpose;
  readonly workArea: OfficialDocumentWorkArea;
  readonly schoolYear: string;
  readonly schoolName: string;
  readonly relatedDocument: string;
  readonly workName: string;
  readonly target: string;
  readonly dateTime: string;
  readonly place: string;
  readonly method: string;
  readonly organization: string;
  readonly peopleCount: string;
  readonly budget: string;
  readonly mainContent: string;
  readonly attachments: string;
  readonly notes: string;
};

export type OfficialDocumentInputField = Exclude<keyof OfficialDocumentInput, "purpose" | "workArea">;

export type OfficialDocumentDraft = {
  readonly title: string;
  readonly body: string;
  readonly attachments: string;
  readonly messenger: string;
  readonly checklist: string;
};

export type OfficialDocumentRevisionInput = {
  readonly original: string;
  readonly request: string;
};

export type OfficialDocumentModeOutput = {
  readonly prompt: string;
  readonly aiResponse: string;
  readonly reviewedOutbound: string | null;
};

export type OfficialDocumentAiStatus = "idle" | "generating" | "error";

export type OfficialDocumentSession = {
  readonly mode: OfficialDocumentMode;
  readonly createInput: OfficialDocumentInput;
  readonly revisionInput: OfficialDocumentRevisionInput;
  readonly revisionSourceName: string | null;
  readonly summaryOriginal: string;
  readonly summarySourceName: string | null;
  readonly summaryLocalResult: OfficialDocumentLocalSummary | null;
  readonly draft: OfficialDocumentDraft | null;
  readonly outputs: Readonly<Record<OfficialDocumentMode, OfficialDocumentModeOutput>>;
  readonly aiStatus: OfficialDocumentAiStatus;
  readonly aiError: string | null;
  readonly activeAiRequestId: number | null;
};

export type OfficialDocumentSessionAction =
  | { readonly type: "selectMode"; readonly mode: OfficialDocumentMode }
  | { readonly type: "updateCreate"; readonly field: OfficialDocumentInputField; readonly value: string }
  | { readonly type: "updateCreatePurpose"; readonly purpose: OfficialDocumentPurpose }
  | { readonly type: "updateCreateWorkArea"; readonly workArea: OfficialDocumentWorkArea }
  | { readonly type: "updateRevision"; readonly value: OfficialDocumentRevisionInput }
  | { readonly type: "importRevisionSource"; readonly original: string; readonly sourceName: string }
  | { readonly type: "updateSummary"; readonly original: string }
  | { readonly type: "importSummarySource"; readonly original: string; readonly sourceName: string }
  | { readonly type: "setSummaryLocalResult"; readonly result: OfficialDocumentLocalSummary }
  | { readonly type: "setDraft"; readonly draft: OfficialDocumentDraft }
  | { readonly type: "setPrompt"; readonly mode: OfficialDocumentMode; readonly prompt: string }
  | { readonly type: "setAiResponse"; readonly mode: OfficialDocumentMode; readonly response: string }
  | { readonly type: "storeReviewedOutbound"; readonly mode: OfficialDocumentMode; readonly outboundText: string }
  | { readonly type: "setAiStatus"; readonly status: OfficialDocumentAiStatus; readonly error: string | null }
  | { readonly type: "beginAiRequest"; readonly requestId: number }
  | { readonly type: "cancelAiRequest"; readonly requestId: number }
  | { readonly type: "resolveAiRequest"; readonly requestId: number; readonly mode: OfficialDocumentMode; readonly response: string }
  | { readonly type: "failAiRequest"; readonly requestId: number; readonly error: string }
  | { readonly type: "reset" };
