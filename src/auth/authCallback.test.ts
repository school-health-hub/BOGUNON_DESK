import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_AUTH_CALLBACK_URL,
  fingerprintAuthCallback,
  parseAuthCallback,
  parseOAuthFlowId,
  PRODUCTION_AUTH_CALLBACK_URL,
  resolveAuthCallbackUrl,
} from "./authCallback";

describe("parseAuthCallback", () => {
  it("accepts the configured callback and extracts the PKCE code", () => {
    expect(parseAuthCallback(
      "school-health-desk://auth/callback?code=oauth-code&sb_flow_id=flow-id-1",
      PRODUCTION_AUTH_CALLBACK_URL,
    ))
      .toEqual({ kind: "code", code: "oauth-code", flowId: "flow-id-1" });
  });

  it("accepts the isolated development callback", () => {
    expect(parseAuthCallback(
      "school-health-desk-dev://auth/callback?code=oauth-code&sb_flow_id=flow-id-1",
      DEVELOPMENT_AUTH_CALLBACK_URL,
    )).toEqual({ kind: "code", code: "oauth-code", flowId: "flow-id-1" });
  });

  it("rejects a production callback in development mode", () => {
    expect(parseAuthCallback(
      "school-health-desk://auth/callback?code=secret&sb_flow_id=flow-id-1",
      DEVELOPMENT_AUTH_CALLBACK_URL,
    )).toBeNull();
  });

  it("fails closed for an unconfigured development command", () => {
    expect(resolveAuthCallbackUrl("production")).toBe(PRODUCTION_AUTH_CALLBACK_URL);
    expect(resolveAuthCallbackUrl("desktop-dev")).toBe(DEVELOPMENT_AUTH_CALLBACK_URL);
    expect(resolveAuthCallbackUrl("development")).toBeNull();
    expect(resolveAuthCallbackUrl("test")).toBeNull();
  });

  it("returns a friendly cancellation result", () => {
    expect(parseAuthCallback(
      "school-health-desk://auth/callback?error=access_denied&sb_flow_id=flow-id-1",
      PRODUCTION_AUTH_CALLBACK_URL,
    ))
      .toEqual({
        kind: "cancelled",
        message: "Google 로그인이 취소되었습니다.",
        flowId: "flow-id-1",
      });
  });

  it("rejects callbacks without a code", () => {
    expect(parseAuthCallback("school-health-desk://auth/callback", PRODUCTION_AUTH_CALLBACK_URL))
      .toEqual({ kind: "invalid", message: "로그인 응답에 인증 코드가 없습니다.", flowId: null });
  });

  it("rejects malformed PKCE flow identifiers without rejecting the callback shape", () => {
    expect(parseOAuthFlowId("short")).toBeNull();
    expect(parseOAuthFlowId("flow id with spaces")).toBeNull();
    expect(parseAuthCallback(
      "school-health-desk://auth/callback?code=oauth-code&sb_flow_id=short",
      PRODUCTION_AUTH_CALLBACK_URL,
    ))
      .toEqual({ kind: "code", code: "oauth-code", flowId: null });
  });

  it("ignores unrelated or spoofed deep links", () => {
    expect(parseAuthCallback(
      "school-health-desk://settings/callback?code=secret",
      PRODUCTION_AUTH_CALLBACK_URL,
    )).toBeNull();
    expect(parseAuthCallback(
      "school-health-desk://auth:123/callback?code=secret",
      PRODUCTION_AUTH_CALLBACK_URL,
    )).toBeNull();
    expect(parseAuthCallback(
      "school-health-desk://auth/callback?code=secret#fragment",
      PRODUCTION_AUTH_CALLBACK_URL,
    )).toBeNull();
    expect(parseAuthCallback(
      "https://auth/callback?code=secret",
      PRODUCTION_AUTH_CALLBACK_URL,
    )).toBeNull();
  });

  it("deduplicates callbacks without retaining the authorization code", () => {
    const callback = "school-health-desk://auth/callback?code=one-time-code";
    expect(fingerprintAuthCallback(callback)).toBe(fingerprintAuthCallback(callback));
    expect(fingerprintAuthCallback(callback)).not.toContain("one-time-code");
  });
});
