export type RecordHelperPrivacyResult = {
  readonly isSafe: boolean;
  readonly findings: readonly string[];
};

export type RecordHelperCheck =
  | { readonly status: "idle" }
  | { readonly status: "empty"; readonly message: string }
  | { readonly status: "blocked"; readonly findings: readonly string[] }
  | { readonly status: "ready"; readonly message: string };

export type RecordHelperSession = {
  readonly activityMemo: string;
  readonly writingRequest: string;
  readonly check: RecordHelperCheck;
  readonly aiStatus: "idle" | "generating" | "success" | "error";
  readonly aiResponse: string;
  readonly aiError: string | null;
  readonly activeAiRequestId: number | null;
};

export type RecordHelperSessionAction =
  | { readonly type: "updateActivityMemo"; readonly value: string }
  | { readonly type: "updateWritingRequest"; readonly value: string }
  | { readonly type: "checkInput" }
  | { readonly type: "beginAiRequest"; readonly requestId: number }
  | { readonly type: "resolveAiRequest"; readonly requestId: number; readonly response: string }
  | { readonly type: "failAiRequest"; readonly requestId: number; readonly error: string };
