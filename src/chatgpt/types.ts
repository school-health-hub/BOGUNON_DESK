export const chatGptConnectionStatuses = ["disconnected", "connected", "busy", "failed"] as const;
export type ChatGptConnectionStatus = (typeof chatGptConnectionStatuses)[number];

export const chatGptNoticeCodes = [
  "planUsageUnavailable",
  "remoteRevocationFailed",
  "signInFailed",
] as const;
export type ChatGptNoticeCode = (typeof chatGptNoticeCodes)[number];

export type ChatGptNotice = {
  readonly code: ChatGptNoticeCode;
  readonly message: string;
};

export type ChatGptNativeConnectionState = {
  readonly status: ChatGptConnectionStatus;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly planUsageEnabled: boolean;
  readonly clientRegistrationExists: boolean;
  readonly showPlanUsageNotice: boolean;
  readonly notice: ChatGptNotice | null;
};

export type ChatGptConnectionState = ChatGptNativeConnectionState & {
  readonly isLoading: boolean;
  readonly isSigningIn: boolean;
  readonly isDisconnecting: boolean;
  readonly error: string | null;
};

export type ChatGptConnectionService = {
  readonly getState: () => ChatGptConnectionState;
  readonly subscribe: (listener: (state: ChatGptConnectionState) => void) => () => void;
  readonly refresh: () => Promise<void>;
  readonly startSignIn: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
};

export type ChatGptModel = {
  readonly slug: string;
  readonly displayName: string;
};

export const chatGptPlanErrorCodes = [
  "reauthenticationRequired",
  "accessDenied",
  "usageLimitExceeded",
  "usageUnavailable",
  "rateLimited",
  "temporaryFailure",
  "invalidResponse",
  "unavailable",
] as const;
export type ChatGptPlanErrorCode = (typeof chatGptPlanErrorCodes)[number];

export type ChatGptPlanError = {
  readonly code: ChatGptPlanErrorCode;
  readonly message: string;
};

export type ChatGptPlanService = {
  readonly listModels: () => Promise<readonly ChatGptModel[]>;
  readonly generateText: (model: string, prompt: string) => Promise<string>;
};
