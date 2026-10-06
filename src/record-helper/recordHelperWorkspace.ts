export type RecordHelperReportId = string;

export const recordHelperReportFormats = ["pdf", "hwpx", "docx", "hwp"] as const;

export type RecordHelperReportFormat = (typeof recordHelperReportFormats)[number];

export type RecordHelperReportMetadata = {
  readonly studentLabel: string;
  readonly classLabel: string;
  readonly activityLabel: string;
};

export type RecordHelperImportedReport = {
  readonly id: RecordHelperReportId;
  readonly sourceName: string;
  readonly format: RecordHelperReportFormat;
  readonly extractedText: string;
};

export type RecordHelperReport = RecordHelperImportedReport &
  RecordHelperReportMetadata & {
    readonly teacherMemo: string;
    readonly aiStatus: "idle" | "generating" | "success" | "error";
    readonly aiDraft: string;
    readonly aiError: string | null;
    readonly activeAiRequestId: number | null;
  };

export type RecordHelperImportFailure = {
  readonly sourceName: string;
  readonly error: string;
};

export type RecordHelperImportStatus = "idle" | "importing" | "success" | "error";

export type RecordHelperWorkspace = {
  readonly reports: readonly RecordHelperReport[];
  readonly selectedReportId: RecordHelperReportId | null;
  readonly importStatus: RecordHelperImportStatus;
  readonly importError: string | null;
  readonly activeImportRequestId: number | null;
  readonly latestBatchFailures: readonly RecordHelperImportFailure[];
};

export type RecordHelperWorkspaceAction =
  | { readonly type: "beginImport"; readonly requestId: number }
  | {
      readonly type: "resolveImport";
      readonly requestId: number;
      readonly reports: readonly RecordHelperImportedReport[];
      readonly failures: readonly RecordHelperImportFailure[];
    }
  | {
      readonly type: "failImport";
      readonly requestId: number;
      readonly error: string;
      readonly failures: readonly RecordHelperImportFailure[];
    }
  | { readonly type: "selectReport"; readonly reportId: RecordHelperReportId }
  | { readonly type: "removeReport"; readonly reportId: RecordHelperReportId }
  | { readonly type: "clearAll" }
  | {
      readonly type: "updateReportMetadata";
      readonly reportId: RecordHelperReportId;
      readonly metadata: RecordHelperReportMetadata;
    }
  | { readonly type: "updateTeacherMemo"; readonly reportId: RecordHelperReportId; readonly teacherMemo: string }
  | { readonly type: "beginAiRequest"; readonly reportId: RecordHelperReportId; readonly requestId: number }
  | { readonly type: "resolveAiRequest"; readonly reportId: RecordHelperReportId; readonly requestId: number; readonly response: string }
  | { readonly type: "failAiRequest"; readonly reportId: RecordHelperReportId; readonly requestId: number; readonly error: string };

const emptyMetadata: RecordHelperReportMetadata = {
  studentLabel: "",
  classLabel: "",
  activityLabel: "",
};

export const createRecordHelperReportId = (value: string): RecordHelperReportId => value;

export const createRecordHelperWorkspace = (): RecordHelperWorkspace => ({
  reports: [],
  selectedReportId: null,
  importStatus: "idle",
  importError: null,
  activeImportRequestId: null,
  latestBatchFailures: [],
});

const assertNever = (value: never): never => {
  throw new TypeError(`지원하지 않는 생기부 도우미 workspace action: ${String(value)}`);
};

const toReport = (report: RecordHelperImportedReport): RecordHelperReport => ({
  ...report,
  ...emptyMetadata,
  teacherMemo: "",
  aiStatus: "idle",
  aiDraft: "",
  aiError: null,
  activeAiRequestId: null,
});

const reportExists = (reports: readonly RecordHelperReport[], reportId: RecordHelperReportId): boolean =>
  reports.some((report) => report.id === reportId);

export const reduceRecordHelperWorkspace = (
  state: RecordHelperWorkspace,
  action: RecordHelperWorkspaceAction,
): RecordHelperWorkspace => {
  switch (action.type) {
    case "beginImport":
      return {
        ...state,
        importStatus: "importing",
        importError: null,
        activeImportRequestId: action.requestId,
        latestBatchFailures: [],
      };
    case "resolveImport": {
      if (state.activeImportRequestId !== action.requestId) return state;
      const importedReports = action.reports.map(toReport);
      const firstNewReport = importedReports[0];
      return {
        ...state,
        reports: [...state.reports, ...importedReports],
        selectedReportId: firstNewReport === undefined ? state.selectedReportId : firstNewReport.id,
        importStatus: "success",
        importError: null,
        activeImportRequestId: null,
        latestBatchFailures: action.failures,
      };
    }
    case "failImport":
      if (state.activeImportRequestId !== action.requestId) return state;
      return {
        ...state,
        importStatus: "error",
        importError: action.error,
        activeImportRequestId: null,
        latestBatchFailures: action.failures,
      };
    case "selectReport":
      return reportExists(state.reports, action.reportId) ? { ...state, selectedReportId: action.reportId } : state;
    case "removeReport": {
      const removedIndex = state.reports.findIndex((report) => report.id === action.reportId);
      if (removedIndex === -1) return state;
      const nextReport = state.reports[removedIndex + 1];
      const previousReport = state.reports[removedIndex - 1];
      const selectedReportId =
        state.selectedReportId !== action.reportId
          ? state.selectedReportId
          : nextReport?.id ?? previousReport?.id ?? null;
      return {
        ...state,
        reports: state.reports.filter((report) => report.id !== action.reportId),
        selectedReportId,
      };
    }
    case "clearAll":
      return createRecordHelperWorkspace();
    case "updateReportMetadata":
      return {
        ...state,
        reports: state.reports.map((report) =>
          report.id === action.reportId ? { ...report, ...action.metadata } : report,
        ),
      };
    case "updateTeacherMemo":
      return {
        ...state,
        reports: state.reports.map((report) =>
          report.id === action.reportId ? { ...report, teacherMemo: action.teacherMemo, aiStatus: "idle", aiDraft: "", aiError: null, activeAiRequestId: null } : report,
        ),
      };
    case "beginAiRequest":
      return { ...state, reports: state.reports.map((report) => report.id === action.reportId ? { ...report, aiStatus: "generating", aiError: null, activeAiRequestId: action.requestId } : report) };
    case "resolveAiRequest":
      if (!state.reports.some((report) => report.id === action.reportId && report.activeAiRequestId === action.requestId)) return state;
      return { ...state, reports: state.reports.map((report) => report.id === action.reportId ? { ...report, aiStatus: "success", aiDraft: action.response, aiError: null, activeAiRequestId: null } : report) };
    case "failAiRequest":
      if (!state.reports.some((report) => report.id === action.reportId && report.activeAiRequestId === action.requestId)) return state;
      return { ...state, reports: state.reports.map((report) => report.id === action.reportId ? { ...report, aiStatus: "error", aiDraft: "", aiError: action.error, activeAiRequestId: null } : report) };
    default:
      return assertNever(action);
  }
};
