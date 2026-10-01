import { CheckCircle2, LogOut, Sparkles } from "lucide-react";
import type { ChatGptConnectionState } from "../../chatgpt/types";

type ChatGptAccountSettingsProps = {
  readonly state: ChatGptConnectionState;
  readonly onDisconnect: () => void;
  readonly onSignIn: () => void;
};

export function ChatGptAccountSettings({
  state,
  onDisconnect,
  onSignIn,
}: ChatGptAccountSettingsProps) {
  const isBusy = state.status === "busy" || state.isLoading || state.isSigningIn || state.isDisconnecting;
  const isConnected = state.status === "connected" || state.isDisconnecting;
  const identity = state.email ?? state.displayName ?? "ChatGPT 계정 연결됨";
  const signInLabel = state.isLoading
    ? "상태 확인 중..."
    : state.isSigningIn
      ? "브라우저에서 연결 중..."
      : "Continue with ChatGPT";
  const notice = state.notice?.message === state.error ? null : state.notice;

  return (
    <section
      className="desktop-ai-subsection"
      aria-labelledby="settings-chatgpt-heading"
      aria-busy={isBusy}
    >
      <div className="desktop-ai-subsection__heading">
        <strong id="settings-chatgpt-heading">ChatGPT 계정</strong>
        <span className="desktop-ai-copy desktop-ai-copy--cjk">
          ChatGPT 계정을 연결하면 지원되는 AI 기능에 ChatGPT 요금제를 사용할 수 있습니다.
        </span>
      </div>

      {isConnected ? (
        <div className="desktop-ai-status is-connected" role="status" aria-live="polite">
          <CheckCircle2 size={17} aria-hidden="true" />
          <div>
            <strong className="desktop-ai-identity">{identity}</strong>
            <span className="desktop-ai-copy desktop-ai-copy--cjk">
              ChatGPT 요금제 사용: {state.planUsageEnabled ? "사용 가능" : "사용 안 함"}
            </span>
          </div>
        </div>
      ) : (
        <div className="desktop-ai-guidance">
          <Sparkles size={16} aria-hidden="true" />
          <p>
            <strong>ChatGPT 계정 연결</strong>
            <span className="desktop-ai-copy desktop-ai-copy--cjk">
              계정 연결 정보는 이 앱의 API Key 방식과 별도로 관리됩니다.
            </span>
          </p>
        </div>
      )}

      {!isConnected && state.clientRegistrationExists ? (
        <p className="desktop-ai-copy desktop-ai-registration" role="status">
          이 PC의 ChatGPT 앱 등록 정보는 유지되어 다음 로그인에 재사용됩니다.
        </p>
      ) : null}

      {state.showPlanUsageNotice ? (
        <p className="desktop-ai-copy desktop-ai-notice" role="status">
          ChatGPT 요금제를 사용 중입니다.
        </p>
      ) : null}

      {notice !== null ? (
        <p className="desktop-ai-copy desktop-ai-notice" role="status">{notice.message}</p>
      ) : null}

      {state.error !== null ? (
        <p className="desktop-ai-copy desktop-ai-error" role="alert">{state.error}</p>
      ) : null}

      <div className="desktop-ai-actions">
        {isConnected ? (
          <button
            className="desktop-ai-action is-secondary"
            type="button"
            aria-label="ChatGPT 계정 연결 해제"
            disabled={isBusy}
            onClick={onDisconnect}
          >
            <LogOut size={13} aria-hidden="true" />
            {state.isDisconnecting ? "연결 해제 중..." : "연결 해제"}
          </button>
        ) : (
          <button
            className="desktop-ai-action"
            type="button"
            aria-label="ChatGPT 계정 연결"
            disabled={isBusy}
            onClick={onSignIn}
          >
            {signInLabel}
          </button>
        )}
      </div>
    </section>
  );
}
