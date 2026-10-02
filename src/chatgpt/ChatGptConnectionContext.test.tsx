import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatGptConnectionProvider, useChatGptConnection } from "./ChatGptConnectionContext";
import type { ChatGptConnectionService, ChatGptConnectionState } from "./types";

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

const createStaticService = (): ChatGptConnectionService => ({
  getState: () => disconnectedState,
  subscribe: () => () => undefined,
  refresh: async () => undefined,
  startSignIn: async () => undefined,
  disconnect: async () => undefined,
});

function ChatGptStatusProbe() {
  const connection = useChatGptConnection();
  return (
    <span>
      {connection.state.status}:{connection.state.email}:{connection.state.planUsageEnabled ? "plan" : "no-plan"}
    </span>
  );
}

describe("ChatGptConnectionProvider lifecycle", () => {
  it("mounts independent token-free provider state for each app tree", () => {
    const createService = vi.fn(createStaticService);

    const first = renderToStaticMarkup(
      <ChatGptConnectionProvider createService={createService}>
        <ChatGptStatusProbe />
      </ChatGptConnectionProvider>,
    );
    const second = renderToStaticMarkup(
      <ChatGptConnectionProvider createService={createService}>
        <ChatGptStatusProbe />
      </ChatGptConnectionProvider>,
    );

    expect(first).toContain("disconnected::no-plan");
    expect(second).toContain("disconnected::no-plan");
    expect(createService).toHaveBeenCalledTimes(2);
    expect(`${first}${second}`).not.toMatch(/accessToken|refreshToken|idToken|authorizationCode|pkce|verifier/i);
  });
});
