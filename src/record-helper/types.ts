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
};

export type RecordHelperSessionAction =
  | { readonly type: "updateActivityMemo"; readonly value: string }
  | { readonly type: "updateWritingRequest"; readonly value: string }
  | { readonly type: "checkInput" };
