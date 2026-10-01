import { invoke } from "@tauri-apps/api/core";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import type { Session, User } from "@supabase/supabase-js";
import { isDesktopRuntime } from "../desktop/actions";
import {
  AUTH_CALLBACK_URL,
  fingerprintAuthCallback,
  parseAuthCallback,
  parseOAuthFlowId,
} from "./authCallback";
import { AuthConfigurationError, hasSupabaseAuthConfig } from "./config";
import { SecureSessionStorageError, secureSessionStorage } from "./secureSessionStorage";
import { getSupabaseClient } from "./supabaseClient";
import type { AuthState, AuthStateListener, AuthUser } from "./types";

const toAuthUser = (user: User): AuthUser => {
  const displayName = user.user_metadata.full_name ?? user.user_metadata.name;
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: typeof displayName === "string" && displayName.trim() !== ""
      ? displayName.trim()
      : null,
  };
};

const sessionState = (session: Session | null): AuthState => session === null
  ? { status: "signedOut", user: null, notice: null }
  : { status: "signedIn", user: toAuthUser(session.user), notice: null };

const friendlyError = (error: unknown, fallback: string): string => {
  if (error instanceof AuthConfigurationError || error instanceof SecureSessionStorageError) {
    return error.message;
  }
  return fallback;
};

class AuthService {
  private state: AuthState = { status: "loading", user: null, notice: null };
  private readonly listeners = new Set<AuthStateListener>();
  private readonly processedCallbacks = new Set<string>();
  private activeOAuthFlowId: string | null = null;
  private initializePromise: Promise<void> | null = null;
  private noticeId = 0;

  getState = (): AuthState => this.state;

  subscribe = (listener: AuthStateListener): (() => void) => {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  };

  initialize = async (): Promise<void> => {
    this.initializePromise ??= this.initializeOnce();
    await this.initializePromise;
  };

  getCurrentUser = async (): Promise<AuthUser | null> => {
    await this.initialize();
    return this.state.user;
  };

  signInWithGoogle = async (): Promise<void> => {
    await this.initialize();
    if (!hasSupabaseAuthConfig()) {
      this.fail(new AuthConfigurationError(), "계정 연결 설정이 아직 준비되지 않았습니다.");
      return;
    }
    if (!isDesktopRuntime()) {
      this.fail(null, "Google 로그인은 Windows 앱에서 사용할 수 있습니다.");
      return;
    }

    this.activeOAuthFlowId = null;
    this.update({ status: "signingIn", user: null, notice: null });
    try {
      const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          queryParams: { prompt: "select_account" },
          redirectTo: AUTH_CALLBACK_URL,
          skipBrowserRedirect: true,
        },
      });
      if (error !== null) throw error;
      if (data.url === null) {
        this.fail(null, "Google 로그인 주소를 받지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      const flowId = parseOAuthFlowId(data.flowId);
      if (flowId === null) {
        this.fail(null, "Google 로그인을 안전하게 시작하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      this.activeOAuthFlowId = flowId;
      await invoke("open_auth_url", { url: data.url });
    } catch (error) {
      this.activeOAuthFlowId = null;
      this.fail(error, "Google 로그인 페이지를 열지 못했습니다. 네트워크 연결을 확인해 주세요.");
    }
  };

  signOut = async (): Promise<void> => {
    await this.initialize();
    this.activeOAuthFlowId = null;
    const previousUser = this.state.user;
    this.update({ ...this.state, status: "signingOut", notice: null });
    let signOutFailure: unknown = null;
    try {
      if (hasSupabaseAuthConfig()) {
        const { error } = await getSupabaseClient().auth.signOut();
        signOutFailure = error;
      }
    } catch (error) {
      signOutFailure = error;
    }

    try {
      await secureSessionStorage.clear();
      this.update({
        status: "signedOut",
        user: null,
        notice: signOutFailure === null
          ? null
          : this.notice("네트워크 연결을 확인하지 못했지만 이 PC에서는 로그아웃했습니다."),
      });
    } catch (error) {
      this.update({
        status: previousUser === null ? "signedOut" : "signedIn",
        user: previousUser,
        notice: this.notice(friendlyError(
          error,
          "로그인 정보를 보안 저장소에서 제거하지 못했습니다. 로그아웃을 다시 시도해 주세요.",
        )),
      });
    }
  };

  clearNotice = (): void => {
    if (this.state.notice !== null) this.update({ ...this.state, notice: null });
  };

  private initializeOnce = async (): Promise<void> => {
    if (!hasSupabaseAuthConfig() || !isDesktopRuntime()) {
      this.update({ status: "signedOut", user: null, notice: null });
      return;
    }

    try {
      await onOpenUrl((urls) => {
        for (const url of urls) void this.handleCallback(url);
      });
      const client = getSupabaseClient();
      client.auth.onAuthStateChange((_event, session) => this.update(sessionState(session)));
      const { data, error } = await client.auth.getSession();
      if (error !== null) throw error;
      this.update(sessionState(data.session));
      const currentUrls = await getCurrent();
      for (const url of currentUrls ?? []) await this.handleCallback(url);
    } catch (error) {
      this.fail(error, "로그인 상태를 복원하지 못했습니다. 네트워크 연결을 확인해 주세요.");
    }
  };

  private handleCallback = async (url: string): Promise<void> => {
    const callback = parseAuthCallback(url);
    if (
      callback === null
      || callback.flowId === null
      || callback.flowId !== this.activeOAuthFlowId
    ) {
      return;
    }

    const fingerprint = fingerprintAuthCallback(url);
    if (this.processedCallbacks.has(fingerprint)) return;
    this.processedCallbacks.add(fingerprint);
    this.activeOAuthFlowId = null;

    if (callback.kind !== "code") {
      this.update({ status: "signedOut", user: null, notice: this.notice(callback.message) });
      return;
    }

    this.update({ status: "signingIn", user: null, notice: null });
    try {
      const { data, error } = await getSupabaseClient().auth.exchangeCodeForSession(
        callback.code,
        { flowId: callback.flowId },
      );
      if (error !== null) throw error;
      if (data.user === null) {
        this.fail(null, "로그인 사용자 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      this.update({ status: "signedIn", user: toAuthUser(data.user), notice: null });
    } catch (error) {
      this.fail(error, "Google 로그인 확인에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  private fail = (error: unknown, fallback: string): void => {
    this.update({ status: "signedOut", user: null, notice: this.notice(friendlyError(error, fallback)) });
  };

  private notice = (message: string) => ({ id: ++this.noticeId, message });

  private update = (state: AuthState): void => {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  };
}

export const authService = new AuthService();
