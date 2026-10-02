import { describe, expect, it } from "vitest";
import { createChatGptConnectionService, disconnectedChatGptState } from "./chatgptConnectionService";
import type { ChatGptNativeConnectionState } from "./types";

const connectedState: ChatGptNativeConnectionState = {
  status: "connected",
  email: "teacher@example.test",
  displayName: "Teacher",
  planUsageEnabled: true,
  clientRegistrationExists: true,
  showPlanUsageNotice: true,
  notice: null,
};

class DeferredSetupError extends Error {
  readonly name = "DeferredSetupError";
}

const deferred = <T,>() => {
  let resolvePromise = (_value: T | PromiseLike<T>): void => {
    throw new DeferredSetupError("deferred resolver was not initialized");
  };
  const promise = new Promise<T>((nextResolve) => {
    resolvePromise = nextResolve;
  });
  return { promise, resolve: resolvePromise };
};

describe("createChatGptConnectionService", () => {
  it("publishes token-free native DTOs without credential fields", async () => {
    const service = createChatGptConnectionService(
      async () => ({ ...disconnectedChatGptState }),
      async () => connectedState,
      async () => ({ ...disconnectedChatGptState }),
    );
    const seen: string[] = [];
    service.subscribe((state) => seen.push(state.status));

    await service.startSignIn();

    expect(service.getState()).toMatchObject(connectedState);
    expect(JSON.stringify(service.getState())).not.toMatch(/accessToken|refreshToken|idToken|authorizationCode|pkce/i);
    expect(seen).toEqual(["busy", "connected"]);
  });

  it("marks plan usage disabled when the native scope decision is false", async () => {
    const service = createChatGptConnectionService(
      async () => ({ ...disconnectedChatGptState }),
      async () => ({ ...connectedState, planUsageEnabled: false, notice: { code: "planUsageUnavailable", message: "scope missing" } }),
      async () => ({ ...disconnectedChatGptState }),
    );

    await service.startSignIn();

    expect(service.getState().status).toBe("connected");
    expect(service.getState().planUsageEnabled).toBe(false);
    expect(service.getState().notice?.code).toBe("planUsageUnavailable");
  });

  it("uses a sanitized failed state when native sign-in fails", async () => {
    const service = createChatGptConnectionService(
      async () => ({ ...disconnectedChatGptState }),
      async () => { throw new Error("ChatGPT 로그인 응답을 확인할 수 없습니다."); },
      async () => ({ ...disconnectedChatGptState }),
    );

    await service.startSignIn();

    expect(service.getState()).toMatchObject({
      status: "failed",
      notice: { code: "signInFailed", message: "ChatGPT 로그인 응답을 확인할 수 없습니다." },
    });
  });

  it("does not copy credential-shaped native extras into public state", async () => {
    const nativeWithExtraFields = Object.assign({}, connectedState, {
      accessToken: "access-sentinel",
      refreshToken: "refresh-sentinel",
      idToken: "id-sentinel",
      authorizationCode: "code-sentinel",
      pkceVerifier: "verifier-sentinel",
    });
    const service = createChatGptConnectionService(
      async () => ({ ...disconnectedChatGptState }),
      async () => nativeWithExtraFields,
      async () => ({ ...disconnectedChatGptState }),
    );

    await service.startSignIn();

    const serialized = JSON.stringify(service.getState());
    expect(serialized).not.toContain("access-sentinel");
    expect(serialized).not.toContain("refresh-sentinel");
    expect(serialized).not.toContain("id-sentinel");
    expect(serialized).not.toContain("code-sentinel");
    expect(serialized).not.toContain("verifier-sentinel");
  });

  it("uses fixed frontend notice copy instead of native secret-bearing messages", async () => {
    const service = createChatGptConnectionService(
      async () => ({ ...disconnectedChatGptState }),
      async () => ({
        ...connectedState,
        notice: { code: "planUsageUnavailable", message: "access-sentinel code-sentinel verifier-sentinel" },
      }),
      async () => ({ ...disconnectedChatGptState }),
    );

    await service.startSignIn();

    expect(service.getState().notice).toEqual({
      code: "planUsageUnavailable",
      message: "ChatGPT 요금제 사용 권한이 승인되지 않았습니다.",
    });
    expect(JSON.stringify(service.getState())).not.toMatch(/access-sentinel|code-sentinel|verifier-sentinel/);
  });

  it("normalizes unknown native error bodies and ignores duplicate active actions", async () => {
    const pending = deferred<ChatGptNativeConnectionState>();
    let calls = 0;
    let refreshCalls = 0;
    const service = createChatGptConnectionService(
      async () => {
        refreshCalls += 1;
        return { ...disconnectedChatGptState };
      },
      async () => {
        calls += 1;
        return pending.promise;
      },
      async () => ({ ...disconnectedChatGptState }),
    );

    const first = service.startSignIn();
    const second = service.startSignIn();
    const refreshDuringSignIn = service.refresh();
    pending.resolve(connectedState);
    await Promise.all([first, second, refreshDuringSignIn]);

    expect(calls).toBe(1);
    expect(refreshCalls).toBe(0);
    expect(service.getState().status).toBe("connected");

    const failing = createChatGptConnectionService(
      async () => ({ ...disconnectedChatGptState }),
      async () => { throw new Error("raw access-sentinel provider body"); },
      async () => ({ ...disconnectedChatGptState }),
    );
    await failing.startSignIn();
    expect(JSON.stringify(failing.getState())).not.toContain("access-sentinel");
  });

  it("ignores stale refresh responses after a newer refresh wins", async () => {
    const slow = deferred<ChatGptNativeConnectionState>();
    const fast = deferred<ChatGptNativeConnectionState>();
    let refreshCalls = 0;
    const service = createChatGptConnectionService(
      async () => {
        refreshCalls += 1;
        return refreshCalls === 1 ? slow.promise : fast.promise;
      },
      async () => connectedState,
      async () => ({ ...disconnectedChatGptState }),
    );

    const first = service.refresh();
    const second = service.refresh();
    fast.resolve(connectedState);
    await second;
    slow.resolve({ ...disconnectedChatGptState, notice: { code: "remoteRevocationFailed", message: "late stale response" } });
    await first;

    expect(service.getState()).toMatchObject({
      status: "connected",
      email: connectedState.email,
      planUsageEnabled: true,
      notice: null,
    });
  });
});
