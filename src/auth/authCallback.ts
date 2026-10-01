export const AUTH_CALLBACK_URL = "school-health-desk://auth/callback";

const OAUTH_FLOW_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

export const parseOAuthFlowId = (value: string | null | undefined): string | null =>
  typeof value === "string" && OAUTH_FLOW_ID_PATTERN.test(value) ? value : null;

export type AuthCallbackResult =
  | { readonly kind: "code"; readonly code: string; readonly flowId: string | null }
  | { readonly kind: "cancelled"; readonly message: string; readonly flowId: string | null }
  | { readonly kind: "invalid"; readonly message: string; readonly flowId: string | null };

export const parseAuthCallback = (value: string): AuthCallbackResult | null => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== "school-health-desk:"
    || url.hostname !== "auth"
    || url.pathname !== "/callback"
    || url.username !== ""
    || url.password !== ""
  ) {
    return null;
  }

  const flowId = parseOAuthFlowId(url.searchParams.get("sb_flow_id"));

  const oauthError = url.searchParams.get("error");
  if (oauthError !== null) {
    return {
      kind: "cancelled",
      message: oauthError === "access_denied"
        ? "Google 로그인이 취소되었습니다."
        : "Google 로그인을 완료하지 못했습니다. 다시 시도해 주세요.",
      flowId,
    };
  }

  const code = url.searchParams.get("code")?.trim() ?? "";
  if (code === "") {
    return { kind: "invalid", message: "로그인 응답에 인증 코드가 없습니다.", flowId };
  }
  return { kind: "code", code, flowId };
};

export const fingerprintAuthCallback = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};
