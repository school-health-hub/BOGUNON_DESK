import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ChatGptConnectionState } from "../../chatgpt/types";
import { ChatGptAccountSettings } from "./ChatGptAccountSettings";

const disconnectedState: ChatGptConnectionState = {
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

type InteractiveProps = {
  readonly "aria-label"?: string;
  readonly children?: ReactNode;
  readonly onClick?: () => void;
};

const collectElements = (
  node: ReactNode,
  result: ReactElement<InteractiveProps>[] = [],
): ReactElement<InteractiveProps>[] => {
  if (Array.isArray(node)) {
    node.forEach((child) => collectElements(child, result));
    return result;
  }
  if (!isValidElement<InteractiveProps>(node)) return result;
  result.push(node);
  collectElements(node.props.children, result);
  return result;
};

const renderAccount = (overrides: Partial<ChatGptConnectionState> = {}): string =>
  renderToStaticMarkup(
    <ChatGptAccountSettings
      state={{ ...disconnectedState, ...overrides }}
      onDisconnect={vi.fn()}
      onSignIn={vi.fn()}
    />,
  );

describe("ChatGPT account settings", () => {
  it("shows the required pre-connection copy and official button label", () => {
    const markup = renderAccount();

    expect(markup).toContain("ChatGPT 계정을 연결하면 지원되는 AI 기능에 ChatGPT 요금제를 사용할 수 있습니다.");
    expect(markup).toContain("Continue with ChatGPT");
    expect(markup).toContain('aria-label="ChatGPT 계정 연결"');
    expect(markup).toContain('class="desktop-ai-copy desktop-ai-copy--cjk"');
    expect(markup).toContain('class="desktop-ai-action"');
  });

  it("shows email, enabled plan state, and the one-time plan notice", () => {
    const markup = renderAccount({
      status: "connected",
      email: "teacher@example.test",
      displayName: "Teacher",
      planUsageEnabled: true,
      clientRegistrationExists: true,
      showPlanUsageNotice: true,
    });

    expect(markup).toContain("teacher@example.test");
    expect(markup).toContain("ChatGPT 요금제 사용: 사용 가능");
    expect(markup).toContain("ChatGPT 요금제를 사용 중입니다.");
    expect(markup).toContain('class="desktop-ai-copy desktop-ai-copy--cjk"');
    expect(markup).toContain('class="desktop-ai-action is-secondary"');
  });

  it("falls back to display name and reports disabled plan usage", () => {
    const markup = renderAccount({
      status: "connected",
      displayName: "보건 선생님",
      clientRegistrationExists: true,
    });

    expect(markup).toContain("보건 선생님");
    expect(markup).toContain("ChatGPT 요금제 사용: 사용 안 함");
    expect(markup).toContain('class="desktop-ai-action is-secondary"');
  });

  it("keeps registration visible after credentials are disconnected", () => {
    const markup = renderAccount({ clientRegistrationExists: true });

    expect(markup).toContain("이 PC의 ChatGPT 앱 등록 정보는 유지되어 다음 로그인에 재사용됩니다.");
    expect(markup).toContain("Continue with ChatGPT");
  });

  it("invokes the disconnect action from the connected account control", () => {
    const onDisconnect = vi.fn();
    const tree = ChatGptAccountSettings({
      state: { ...disconnectedState, status: "connected", clientRegistrationExists: true },
      onDisconnect,
      onSignIn: vi.fn(),
    });
    const button = collectElements(tree).find(
      (element) => element.type === "button" && element.props["aria-label"] === "ChatGPT 계정 연결 해제",
    );

    button?.props.onClick?.();

    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it("uses accessible busy labels and preserves connected details while disconnecting", () => {
    const signingIn = renderAccount({ status: "busy", isSigningIn: true });
    const disconnecting = renderAccount({
      status: "busy",
      email: "teacher@example.test",
      clientRegistrationExists: true,
      isDisconnecting: true,
    });

    expect(signingIn).toContain('aria-busy="true"');
    expect(signingIn).toContain("브라우저에서 연결 중...");
    expect(signingIn).toContain("disabled");
    expect(disconnecting).toContain("teacher@example.test");
    expect(disconnecting).toContain("연결 해제 중...");
  });

  it("renders sanitized notices as status and failures as alerts without credential fields", () => {
    const markup = renderAccount({
      status: "failed",
      clientRegistrationExists: true,
      notice: { code: "remoteRevocationFailed", message: "원격 연결 해제 확인에 실패했습니다." },
      error: "ChatGPT 계정 연결 상태를 확인하지 못했습니다.",
    });

    expect(markup).toContain('role="status"');
    expect(markup).toContain("원격 연결 해제 확인에 실패했습니다.");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("ChatGPT 계정 연결 상태를 확인하지 못했습니다.");
    expect(markup).not.toMatch(/accessToken|refreshToken|idToken|authorizationCode|pkce|verifier/i);
  });
});
