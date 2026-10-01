import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  ChatGptConnectionService,
  ChatGptConnectionState,
  ChatGptNativeConnectionState,
  ChatGptNotice,
  ChatGptNoticeCode,
} from "./types";

export const CHATGPT_CONNECTION_ERROR = "ChatGPT 계정 연결 상태를 확인하지 못했습니다.";
const allowedNativeErrors = new Set([
  CHATGPT_CONNECTION_ERROR,
  "ChatGPT 로그인이 이미 진행 중입니다.",
  "브라우저에서 ChatGPT 로그인을 열 수 없습니다.",
  "Windows 기본 브라우저를 열지 못했습니다.",
  "ChatGPT 로그인 응답을 확인할 수 없습니다.",
  "ChatGPT 로그인 시간이 초과되었습니다.",
  "ChatGPT 인증 서버 요청에 실패했습니다.",
  "ChatGPT 연결 정보를 저장할 수 없습니다.",
  "ChatGPT 연결 저장소에 접근할 수 없습니다.",
  "이 PC에 등록된 ChatGPT 계정과 다른 계정입니다.",
]);

export const disconnectedChatGptState: ChatGptConnectionState = {
  status: "disconnected",
  email: null,
  displayName: null,
  planUsageEnabled: false,
  clientRegistrationExists: false,
  showPlanUsageNotice: false,
  notice: null,
  isLoading: false,
  isSigningIn: false,
  isDisconnecting: false,
  error: null,
};

const failedState = (message: string): ChatGptConnectionState => ({
  ...disconnectedChatGptState,
  status: "failed",
  error: message,
  notice: { code: "signInFailed", message },
});

const chatGptNoticeMessages: Record<ChatGptNoticeCode, string> = {
  planUsageUnavailable: "ChatGPT 요금제 사용 권한이 승인되지 않았습니다.",
  remoteRevocationFailed: "원격 연결 해제 확인은 실패했지만 이 PC의 ChatGPT 연결 정보는 제거되었습니다.",
  signInFailed: CHATGPT_CONNECTION_ERROR,
};

export const normalizeChatGptConnectionError = (error: unknown): string => {
  const message = typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : "";
  return allowedNativeErrors.has(message) ? message : CHATGPT_CONNECTION_ERROR;
};

export type ChatGptNativeCommand = () => Promise<ChatGptNativeConnectionState>;

export const getChatGptConnectionStateNative: ChatGptNativeCommand = async () => {
  if (!isTauri()) return nativeFromState(disconnectedChatGptState);
  return invoke<ChatGptNativeConnectionState>("chatgpt_get_connection_state");
};

export const startChatGptSignInNative: ChatGptNativeCommand = async () => {
  if (!isTauri()) throw new Error(CHATGPT_CONNECTION_ERROR);
  return invoke<ChatGptNativeConnectionState>("chatgpt_start_sign_in");
};

export const disconnectChatGptNative: ChatGptNativeCommand = async () => {
  if (!isTauri()) return nativeFromState(disconnectedChatGptState);
  return invoke<ChatGptNativeConnectionState>("chatgpt_disconnect");
};

const nativeFromState = (state: ChatGptConnectionState): ChatGptNativeConnectionState => ({
  status: state.status,
  email: state.email,
  displayName: state.displayName,
  planUsageEnabled: state.planUsageEnabled,
  clientRegistrationExists: state.clientRegistrationExists,
  showPlanUsageNotice: state.showPlanUsageNotice,
  notice: noticeFromNative(state.notice),
});

const noticeFromNative = (notice: ChatGptNotice | null): ChatGptNotice | null =>
  notice === null ? null : {
    code: notice.code,
    message: chatGptNoticeMessages[notice.code],
  };

const stateFromNative = (
  nativeState: ChatGptNativeConnectionState,
  flags: Pick<ChatGptConnectionState, "isLoading" | "isSigningIn" | "isDisconnecting" | "error">,
): ChatGptConnectionState => ({
  status: nativeState.status,
  email: nativeState.email,
  displayName: nativeState.displayName,
  planUsageEnabled: nativeState.planUsageEnabled,
  clientRegistrationExists: nativeState.clientRegistrationExists,
  showPlanUsageNotice: nativeState.showPlanUsageNotice,
  notice: noticeFromNative(nativeState.notice),
  isLoading: flags.isLoading,
  isSigningIn: flags.isSigningIn,
  isDisconnecting: flags.isDisconnecting,
  error: flags.error,
});

export const createChatGptConnectionService = (
  loadNative: ChatGptNativeCommand = getChatGptConnectionStateNative,
  startNative: ChatGptNativeCommand = startChatGptSignInNative,
  disconnectNative: ChatGptNativeCommand = disconnectChatGptNative,
): ChatGptConnectionService => {
  let state = disconnectedChatGptState;
  let sequence = 0;
  let action: "signIn" | "disconnect" | null = null;
  const listeners = new Set<(nextState: ChatGptConnectionState) => void>();

  const publish = (nextState: ChatGptConnectionState): void => {
    state = nextState;
    listeners.forEach((listener) => listener(state));
  };

  const run = async (
    kind: "refresh" | "signIn" | "disconnect",
    command: ChatGptNativeCommand,
  ): Promise<void> => {
    if (action !== null) return;
    const requestId = ++sequence;
    if (kind === "signIn") action = "signIn";
    if (kind === "disconnect") action = "disconnect";
    publish({
      ...state,
      status: kind === "refresh" ? state.status : "busy",
      notice: null,
      isLoading: kind === "refresh",
      isSigningIn: kind === "signIn",
      isDisconnecting: kind === "disconnect",
      error: null,
    });
    try {
      const nextState = await command();
      if (requestId === sequence) {
        publish(stateFromNative(nextState, {
          isLoading: false,
          isSigningIn: false,
          isDisconnecting: false,
          error: null,
        }));
      }
    } catch (error: unknown) {
      if (requestId === sequence) publish(failedState(normalizeChatGptConnectionError(error)));
    } finally {
      if (requestId === sequence) action = null;
    }
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh: () => run("refresh", loadNative),
    startSignIn: () => run("signIn", startNative),
    disconnect: () => run("disconnect", disconnectNative),
  };
};
