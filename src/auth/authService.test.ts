import type { Session, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getCurrent: vi.fn(),
  getSession: vi.fn(),
  invoke: vi.fn(),
  onAuthStateChange: vi.fn(),
  onOpenUrl: vi.fn(),
  openHandler: null as ((urls: string[]) => void) | null,
  secureClear: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/plugin-deep-link", () => ({
  getCurrent: mocks.getCurrent,
  onOpenUrl: mocks.onOpenUrl,
}));
vi.mock("../desktop/actions", () => ({ isDesktopRuntime: () => true }));
vi.mock("./secureSessionStorage", () => ({
  SecureSessionStorageError: class SecureSessionStorageError extends Error {},
  secureSessionStorage: { clear: mocks.secureClear },
}));
vi.mock("./supabaseClient", () => ({
  getSupabaseClient: () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithOAuth: mocks.signInWithOAuth,
      signOut: mocks.signOut,
    },
  }),
}));

const user = {
  id: "user-1",
  email: "teacher@example.com",
  app_metadata: {},
  aud: "authenticated",
  created_at: "2026-09-19T00:00:00.000Z",
  user_metadata: { full_name: "보건 교사" },
} satisfies User;

const session = {
  access_token: "test-access-token",
  expires_in: 3600,
  refresh_token: "test-refresh-token",
  token_type: "bearer",
  user,
} satisfies Session;

const productionOrigin = "https://xxownwxxajzrviuvvfiu.supabase.co";
const firstFlowId = "11111111111111111111111111111111";
const secondFlowId = "22222222222222222222222222222222";

const loadService = async () => (await import("./authService")).authService;

describe("authService", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", productionOrigin);
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    mocks.exchangeCodeForSession.mockReset();
    mocks.getCurrent.mockReset().mockResolvedValue(null);
    mocks.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
    mocks.invoke.mockReset().mockResolvedValue(undefined);
    mocks.onAuthStateChange.mockReset().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mocks.openHandler = null;
    mocks.onOpenUrl.mockReset().mockImplementation(async (handler: (urls: string[]) => void) => {
      mocks.openHandler = handler;
      return vi.fn();
    });
    mocks.secureClear.mockReset().mockResolvedValue(undefined);
    mocks.signInWithOAuth.mockReset();
    mocks.signOut.mockReset().mockResolvedValue({ error: null });
  });

  it("restores a persisted Supabase user without syncing account settings", async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    const service = await loadService();

    await service.initialize();

    expect(service.getState()).toMatchObject({
      status: "signedIn",
      user: { id: "user-1", email: "teacher@example.com", displayName: "보건 교사" },
    });
  });

  it("opens the system-browser OAuth URL with PKCE redirect settings", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({
      data: {
        flowId: firstFlowId,
        provider: "google",
        url: `${productionOrigin}/auth/v1/authorize?provider=google`,
      },
      error: null,
    });
    const service = await loadService();

    await service.signInWithGoogle();

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        queryParams: { prompt: "select_account" },
        redirectTo: "school-health-desk://auth/callback",
        skipBrowserRedirect: true,
      },
    });
    expect(mocks.invoke).toHaveBeenCalledWith("open_auth_url", {
      url: `${productionOrigin}/auth/v1/authorize?provider=google`,
    });
  });

  it("handles a cancellation only for the active login attempt", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({
      data: { flowId: firstFlowId, provider: "google", url: `${productionOrigin}/auth/v1/authorize` },
      error: null,
    });
    const service = await loadService();
    await service.signInWithGoogle();

    mocks.openHandler?.([
      `school-health-desk://auth/callback?error=access_denied&sb_flow_id=${firstFlowId}`,
    ]);
    expect(service.getState()).toMatchObject({
      status: "signedOut",
      notice: { message: "Google 로그인이 취소되었습니다." },
    });
  });

  it("exchanges a callback only for the active login attempt", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({
      data: { flowId: firstFlowId, provider: "google", url: `${productionOrigin}/auth/v1/authorize` },
      error: null,
    });
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ data: { user }, error: null });
    const service = await loadService();
    await service.signInWithGoogle();

    mocks.openHandler?.([
      `school-health-desk://auth/callback?code=one-time-code&sb_flow_id=${firstFlowId}`,
    ]);
    await vi.waitFor(() => expect(service.getState().status).toBe("signedIn"));
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("one-time-code", { flowId: firstFlowId });
    expect(service.getState().user).toMatchObject({ id: "user-1" });
  });

  it("ignores stale callbacks without changing an existing signed-in session", async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    const service = await loadService();
    await service.initialize();

    mocks.openHandler?.([
      `school-health-desk://auth/callback?error=access_denied&sb_flow_id=${firstFlowId}`,
      `school-health-desk://auth/callback?code=stale-code&sb_flow_id=${firstFlowId}`,
    ]);

    expect(service.getState()).toMatchObject({ status: "signedIn", user: { id: "user-1" }, notice: null });
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("ignores a callback for a different login attempt", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({
      data: { flowId: firstFlowId, provider: "google", url: `${productionOrigin}/auth/v1/authorize` },
      error: null,
    });
    const service = await loadService();
    await service.signInWithGoogle();

    mocks.openHandler?.([
      `school-health-desk://auth/callback?code=wrong-code&sb_flow_id=${secondFlowId}`,
    ]);

    expect(service.getState().status).toBe("signingIn");
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("does not exchange the same active callback twice", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({
      data: { flowId: firstFlowId, provider: "google", url: `${productionOrigin}/auth/v1/authorize` },
      error: null,
    });
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ data: { user }, error: null });
    const service = await loadService();
    await service.signInWithGoogle();
    const callback = `school-health-desk://auth/callback?code=one-time-code&sb_flow_id=${firstFlowId}`;

    mocks.openHandler?.([callback, callback]);
    await vi.waitFor(() => expect(service.getState().status).toBe("signedIn"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledOnce();
  });

  it("refuses to open OAuth when Supabase does not return a correlated flow identifier", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({
      data: { flowId: null, provider: "google", url: `${productionOrigin}/auth/v1/authorize` },
      error: null,
    });
    const service = await loadService();

    await service.signInWithGoogle();

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(service.getState()).toMatchObject({
      status: "signedOut",
      notice: { message: "Google 로그인을 안전하게 시작하지 못했습니다. 다시 시도해 주세요." },
    });
  });

  it("clears only secure auth storage when signing out", async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    const service = await loadService();
    await service.initialize();

    await service.signOut();

    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.secureClear).toHaveBeenCalledOnce();
    expect(service.getState()).toEqual({ status: "signedOut", user: null, notice: null });
  });

  it("supports two login cycles with one client and one callback listener", async () => {
    mocks.signInWithOAuth
      .mockResolvedValueOnce({
        data: { flowId: firstFlowId, provider: "google", url: `${productionOrigin}/auth/v1/authorize?attempt=1` },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { flowId: secondFlowId, provider: "google", url: `${productionOrigin}/auth/v1/authorize?attempt=2` },
        error: null,
      });
    mocks.exchangeCodeForSession
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user }, error: null });
    const service = await loadService();
    await service.initialize();

    await service.signInWithGoogle();
    mocks.openHandler?.([
      `school-health-desk://auth/callback?code=first-code&sb_flow_id=${firstFlowId}`,
    ]);
    await vi.waitFor(() => expect(service.getState().status).toBe("signedIn"));

    await service.signOut();
    expect(service.getState().status).toBe("signedOut");

    await service.signInWithGoogle();
    mocks.openHandler?.([
      `school-health-desk://auth/callback?code=second-code&sb_flow_id=${secondFlowId}`,
    ]);
    await vi.waitFor(() => expect(service.getState().status).toBe("signedIn"));

    expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(2);
    expect(mocks.signInWithOAuth).toHaveBeenNthCalledWith(2, {
      provider: "google",
      options: {
        queryParams: { prompt: "select_account" },
        redirectTo: "school-health-desk://auth/callback",
        skipBrowserRedirect: true,
      },
    });
    expect(mocks.exchangeCodeForSession).toHaveBeenNthCalledWith(2, "second-code", {
      flowId: secondFlowId,
    });
    expect(mocks.onOpenUrl).toHaveBeenCalledOnce();
    expect(mocks.onAuthStateChange).toHaveBeenCalledOnce();
  });

  it("does not claim sign-out when secure session removal fails", async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    mocks.secureClear.mockRejectedValueOnce(new Error("storage unavailable"));
    const service = await loadService();
    await service.initialize();

    await service.signOut();

    expect(service.getState()).toMatchObject({
      status: "signedIn",
      user: { id: "user-1" },
      notice: { message: "로그인 정보를 보안 저장소에서 제거하지 못했습니다. 로그아웃을 다시 시도해 주세요." },
    });
  });
});
