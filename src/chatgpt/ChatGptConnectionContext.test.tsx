import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ChatGptConnectionProvider,
  runChatGptPlanOperation,
  useChatGptConnection,
} from "./ChatGptConnectionContext";
import { createChatGptConnectionService } from "./chatgptConnectionService";
import { ChatGptPlanRequestError } from "./chatgptPlanService";
import type {
  ChatGptConnectionService,
  ChatGptConnectionState,
  ChatGptNativeConnectionState,
} from "./types";

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

const connectedNativeState: ChatGptNativeConnectionState = {
  status: "connected",
  email: "teacher@example.test",
  displayName: "Teacher",
  planUsageEnabled: true,
  clientRegistrationExists: true,
  showPlanUsageNotice: true,
  notice: null,
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
      <ChatGptConnectionProvider createService={createService} loadSelectedModel={() => null}>
        <ChatGptStatusProbe />
      </ChatGptConnectionProvider>,
    );
    const second = renderToStaticMarkup(
      <ChatGptConnectionProvider createService={createService} loadSelectedModel={() => null}>
        <ChatGptStatusProbe />
      </ChatGptConnectionProvider>,
    );

    expect(first).toContain("disconnected::no-plan");
    expect(second).toContain("disconnected::no-plan");
    expect(createService).toHaveBeenCalledTimes(2);
    expect(`${first}${second}`).not.toMatch(/accessToken|refreshToken|idToken|authorizationCode|pkce|verifier/i);
  });

  it("refreshes native connection state and clears models after refreshModels requires reauthentication", async () => {
    // Given
    const loadNative = vi.fn(async (): Promise<ChatGptNativeConnectionState> => ({
      ...disconnectedState,
      clientRegistrationExists: true,
    }));
    const service = createChatGptConnectionService(
      loadNative,
      async () => connectedNativeState,
      async () => ({ ...disconnectedState, clientRegistrationExists: true }),
    );
    await service.startSignIn();
    let models = ["gpt-account"];
    const error = new ChatGptPlanRequestError("reauthenticationRequired");

    // When
    const operation = runChatGptPlanOperation(
      async () => Promise.reject(error),
      service,
      () => { models = []; },
    );

    // Then
    await expect(operation).rejects.toBe(error);
    expect(loadNative).toHaveBeenCalledOnce();
    expect(service.getState()).toMatchObject({
      status: "disconnected",
      clientRegistrationExists: true,
    });
    expect(models).toEqual([]);
  });

  it("resynchronizes generateText reauthentication before rethrowing the original error", async () => {
    // Given
    const service = createChatGptConnectionService(
      async () => ({ ...disconnectedState, clientRegistrationExists: true }),
      async () => connectedNativeState,
      async () => ({ ...disconnectedState, clientRegistrationExists: true }),
    );
    await service.startSignIn();
    const error = new ChatGptPlanRequestError("reauthenticationRequired");

    // When / Then
    await expect(runChatGptPlanOperation(
      async () => Promise.reject(error),
      service,
      () => undefined,
    )).rejects.toBe(error);
    expect(service.getState()).toMatchObject({
      status: "disconnected",
      clientRegistrationExists: true,
    });
  });

  it.each(["usageLimitExceeded", "usageUnavailable", "rateLimited", "temporaryFailure", "accessDenied"] as const)(
    "keeps the connected state for %s plan failures",
    async (code) => {
      // Given
      const loadNative = vi.fn(async () => ({ ...disconnectedState, clientRegistrationExists: true }));
      const service = createChatGptConnectionService(
        loadNative,
        async () => connectedNativeState,
        async () => ({ ...disconnectedState, clientRegistrationExists: true }),
      );
      await service.startSignIn();
      const resetModels = vi.fn();
      const error = new ChatGptPlanRequestError(code);

      // When / Then
      await expect(runChatGptPlanOperation(
        async () => Promise.reject(error),
        service,
        resetModels,
      )).rejects.toBe(error);
      expect(loadNative).not.toHaveBeenCalled();
      expect(resetModels).not.toHaveBeenCalled();
      expect(service.getState().status).toBe("connected");
    },
  );
});
