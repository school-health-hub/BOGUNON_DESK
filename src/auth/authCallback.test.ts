import { describe, expect, it } from "vitest";
import { fingerprintAuthCallback, parseAuthCallback, parseOAuthFlowId } from "./authCallback";

describe("parseAuthCallback", () => {
  it("accepts the configured callback and extracts the PKCE code", () => {
    expect(parseAuthCallback("school-health-desk://auth/callback?code=oauth-code&sb_flow_id=flow-id-1"))
      .toEqual({ kind: "code", code: "oauth-code", flowId: "flow-id-1" });
  });

  it("returns a friendly cancellation result", () => {
    expect(parseAuthCallback("school-health-desk://auth/callback?error=access_denied&sb_flow_id=flow-id-1"))
      .toEqual({
        kind: "cancelled",
        message: "Google 로그인이 취소되었습니다.",
        flowId: "flow-id-1",
      });
  });

  it("rejects callbacks without a code", () => {
    expect(parseAuthCallback("school-health-desk://auth/callback"))
      .toEqual({ kind: "invalid", message: "로그인 응답에 인증 코드가 없습니다.", flowId: null });
  });

  it("rejects malformed PKCE flow identifiers without rejecting the callback shape", () => {
    expect(parseOAuthFlowId("short")).toBeNull();
    expect(parseOAuthFlowId("flow id with spaces")).toBeNull();
    expect(parseAuthCallback("school-health-desk://auth/callback?code=oauth-code&sb_flow_id=short"))
      .toEqual({ kind: "code", code: "oauth-code", flowId: null });
  });

  it("ignores unrelated or spoofed deep links", () => {
    expect(parseAuthCallback("school-health-desk://settings/callback?code=secret")).toBeNull();
    expect(parseAuthCallback("https://auth/callback?code=secret")).toBeNull();
  });

  it("deduplicates callbacks without retaining the authorization code", () => {
    const callback = "school-health-desk://auth/callback?code=one-time-code";
    expect(fingerprintAuthCallback(callback)).toBe(fingerprintAuthCallback(callback));
    expect(fingerprintAuthCallback(callback)).not.toContain("one-time-code");
  });
});
