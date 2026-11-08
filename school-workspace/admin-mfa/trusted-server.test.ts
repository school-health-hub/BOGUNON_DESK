import { describe, expect, it, vi } from "vitest";
import { completeAdminMfa } from "./trusted-server.js";

const intentId = "10000000-0000-4000-8000-000000000001";
const factorId = "20000000-0000-4000-8000-000000000002";
const challengeId = "30000000-0000-4000-8000-000000000003";
const userId = "40000000-0000-4000-8000-000000000004";
const sessionId = "50000000-0000-4000-8000-000000000005";
const issuer = "https://xxownwxxajzrviuvvfiu.supabase.co/auth/v1";

function fixture(overrides?: {
  readonly verifiedUserId?: string;
  readonly verifiedSessionId?: string;
  readonly verifiedAal?: "aal1" | "aal2";
}) {
  const calls: string[] = [];
  const initial = {
    sub: userId,
    session_id: sessionId,
    aal: "aal1" as const,
    aud: "authenticated" as const,
    iss: issuer,
    exp: 2_000_000_000,
  };
  const verified = {
    ...initial,
    sub: overrides?.verifiedUserId ?? userId,
    session_id: overrides?.verifiedSessionId ?? sessionId,
    aal: overrides?.verifiedAal ?? "aal2",
  };
  const tokens = {
    expectedIssuer: issuer,
    verify: vi.fn(async (token: string) => {
      calls.push(`token:${token}`);
      return token === "initial-token" ? initial : verified;
    }),
  };
  const provider = {
    challenge: vi.fn(async (input: { readonly accessToken: string; readonly factorId: string }) => {
      calls.push(`challenge:${input.factorId}`);
      return { id: challengeId };
    }),
    verify: vi.fn(async (input: {
      readonly accessToken: string;
      readonly factorId: string;
      readonly challengeId: string;
      readonly code: string;
    }) => {
      calls.push(`verify:${input.factorId}:${input.challengeId}`);
      return { accessToken: "verified-token" };
    }),
  };
  const proofs = {
    bind: vi.fn(async () => { calls.push("bind"); }),
    attest: vi.fn(async () => { calls.push("attest"); }),
    reject: vi.fn(async () => { calls.push("reject"); }),
  };
  return { calls, tokens, provider, proofs };
}

const request = {
  accessToken: "initial-token",
  intentId,
  factorId,
  code: "123456",
};

describe("completeAdminMfa", () => {
  it("binds and attests the exact challenge only after the same session receives aal2", async () => {
    const f = fixture();

    const result = await completeAdminMfa(request, f);

    expect(result).toEqual({ accessToken: "verified-token" });
    expect(f.calls).toEqual([
      "token:initial-token",
      `challenge:${factorId}`,
      "bind",
      `verify:${factorId}:${challengeId}`,
      "token:verified-token",
      "attest",
    ]);
    expect(f.proofs.bind).toHaveBeenCalledWith({ intentId, userId, sessionId, factorId, challengeId });
    expect(f.proofs.attest).toHaveBeenCalledWith({ intentId, userId, sessionId, factorId, challengeId });
    expect(f.proofs.reject).not.toHaveBeenCalled();
  });

  it("rejects the bound proof when verification returns a different session", async () => {
    const f = fixture({ verifiedSessionId: "60000000-0000-4000-8000-000000000006" });

    await expect(completeAdminMfa(request, f)).rejects.toMatchObject({ code: "SESSION_MISMATCH" });

    expect(f.proofs.attest).not.toHaveBeenCalled();
    expect(f.proofs.reject).toHaveBeenCalledWith({ intentId, userId, sessionId, factorId, challengeId });
  });

  it("rejects the bound proof when verification returns a different user", async () => {
    const f = fixture({ verifiedUserId: "70000000-0000-4000-8000-000000000007" });

    await expect(completeAdminMfa(request, f)).rejects.toMatchObject({ code: "USER_MISMATCH" });

    expect(f.proofs.attest).not.toHaveBeenCalled();
    expect(f.proofs.reject).toHaveBeenCalledOnce();
  });

  it("rejects the bound proof when the verified token is not aal2", async () => {
    const f = fixture({ verifiedAal: "aal1" });

    await expect(completeAdminMfa(request, f)).rejects.toMatchObject({ code: "AAL2_REQUIRED" });

    expect(f.proofs.attest).not.toHaveBeenCalled();
    expect(f.proofs.reject).toHaveBeenCalledOnce();
  });

  it("parses the request before calling any trusted dependency", async () => {
    const f = fixture();

    await expect(completeAdminMfa({ ...request, code: "12" }, f)).rejects.toBeTruthy();

    expect(f.tokens.verify).not.toHaveBeenCalled();
    expect(f.provider.challenge).not.toHaveBeenCalled();
    expect(f.proofs.bind).not.toHaveBeenCalled();
  });
});
