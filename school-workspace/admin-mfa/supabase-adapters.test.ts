import { describe, expect, it, vi } from "vitest";
import {
  SqlIntentProofStore,
  SqlLiveSessionProbe,
  SupabaseAuthMfaProvider,
  SupabaseVerifiedTokenService,
} from "./supabase-adapters.js";
import { parseBoundProof } from "./trusted-server.js";

const origin = "https://xxownwxxajzrviuvvfiu.supabase.co";
const issuer = `${origin}/auth/v1`;
const ids = {
  intent: "10000000-0000-4000-8000-000000000001",
  factor: "20000000-0000-4000-8000-000000000002",
  challenge: "30000000-0000-4000-8000-000000000003",
  user: "40000000-0000-4000-8000-000000000004",
  session: "50000000-0000-4000-8000-000000000005",
} as const;

describe("Supabase Auth MFA adapter", () => {
  it("calls the official challenge and verify routes with one bearer session", async () => {
    const requests: Request[] = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.url.endsWith("/challenge")) return Response.json({ id: ids.challenge });
      return Response.json({ access_token: "verified-token" });
    });
    const provider = new SupabaseAuthMfaProvider({ origin, publishableKey: "sb_publishable_test", fetcher });

    const challenge = await provider.challenge({ accessToken: "initial-token", factorId: ids.factor });
    const verified = await provider.verify({
      accessToken: "initial-token",
      factorId: ids.factor,
      challengeId: ids.challenge,
      code: "123456",
    });

    expect(challenge).toEqual({ id: ids.challenge });
    expect(verified).toEqual({ accessToken: "verified-token" });
    expect(requests.map(request => new URL(request.url).pathname)).toEqual([
      `/auth/v1/factors/${ids.factor}/challenge`,
      `/auth/v1/factors/${ids.factor}/verify`,
    ]);
    expect(requests.every(request => request.headers.get("authorization") === "Bearer initial-token")).toBe(true);
    expect(await requests[1]?.json()).toEqual({ challenge_id: ids.challenge, code: "123456" });
  });

  it("fails closed when Supabase rejects an expired challenge", async () => {
    const provider = new SupabaseAuthMfaProvider({
      origin,
      publishableKey: "sb_publishable_test",
      fetcher: vi.fn(async () => Response.json({ message: "expired" }, { status: 422 })),
    });

    await expect(provider.verify({
      accessToken: "initial-token",
      factorId: ids.factor,
      challengeId: ids.challenge,
      code: "123456",
    })).rejects.toMatchObject({ code: "AUTH_PROVIDER_REJECTED" });
  });
});

describe("Supabase verified token adapter", () => {
  it("requires signed claims, the matching Auth user, and a live session row", async () => {
    const claims = {
      sub: ids.user,
      session_id: ids.session,
      aal: "aal2",
      aud: "authenticated",
      iss: issuer,
      exp: 2_000_000_000,
    };
    const auth = {
      getClaims: vi.fn(async () => ({ data: { claims }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: ids.user } }, error: null })),
    };
    const liveSessions = { isLive: vi.fn(async () => true) };
    const tokens = new SupabaseVerifiedTokenService({ auth, liveSessions, expectedIssuer: issuer });

    await expect(tokens.verify("signed-token")).resolves.toEqual(claims);
    expect(liveSessions.isLive).toHaveBeenCalledWith({ userId: ids.user, sessionId: ids.session });
  });

  it("rejects a token whose session is no longer live", async () => {
    const claims = { sub: ids.user, session_id: ids.session };
    const tokens = new SupabaseVerifiedTokenService({
      expectedIssuer: issuer,
      auth: {
        getClaims: vi.fn(async () => ({ data: { claims }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: { id: ids.user } }, error: null })),
      },
      liveSessions: { isLive: vi.fn(async () => false) },
    });

    await expect(tokens.verify("signed-token")).rejects.toMatchObject({ code: "SESSION_NOT_LIVE" });
  });

  it("rejects claims whose signed subject differs from the Auth user", async () => {
    const tokens = new SupabaseVerifiedTokenService({
      expectedIssuer: issuer,
      auth: {
        getClaims: vi.fn(async () => ({ data: { claims: { sub: ids.user, session_id: ids.session } }, error: null })),
        getUser: vi.fn(async () => ({
          data: { user: { id: "60000000-0000-4000-8000-000000000006" } },
          error: null,
        })),
      },
      liveSessions: { isLive: vi.fn(async () => true) },
    });

    await expect(tokens.verify("signed-token")).rejects.toMatchObject({ code: "TOKEN_VERIFICATION_FAILED" });
  });
});

describe("SQL proof adapter", () => {
  it("uses parameterized verifier calls and user-scoped cancellation", async () => {
    const calls: { readonly text: string; readonly values: readonly string[]; readonly mode: "verifier" | "user"; readonly accessToken?: string }[] = [];
    const database = {
      executeVerifier: vi.fn(async (query: { readonly text: string; readonly values: readonly string[] }) => {
        calls.push({ ...query, mode: "verifier" });
      }),
      executeUser: vi.fn(async (query: { readonly text: string; readonly values: readonly string[] }, accessToken: string) => {
        calls.push({ ...query, mode: "user", accessToken });
      }),
      queryBoolean: vi.fn(async () => true),
    };
    const store = new SqlIntentProofStore(database, "initial-token");
    const proof = parseBoundProof({
      intentId: ids.intent,
      userId: ids.user,
      sessionId: ids.session,
      factorId: ids.factor,
      challengeId: ids.challenge,
    });

    await store.bind(proof);
    await store.attest(proof);
    await store.reject(proof);

    expect(calls).toHaveLength(3);
    expect(calls[0]?.text).toContain("workspace_admin_mfa.bind_factor");
    expect(calls[1]?.text).toContain("workspace_admin_mfa.attest_factor");
    expect(calls[2]?.text).toContain("workspace_admin_mfa.cancel_intent");
    expect(calls.map(call => call.mode)).toEqual(["verifier", "verifier", "user"]);
    expect(calls.every(call => !call.text.includes(ids.intent))).toBe(true);
    expect(calls[2]?.accessToken).toBe("initial-token");
  });

  it("checks the exact user and session against auth.sessions", async () => {
    const database = {
      executeVerifier: vi.fn(async () => undefined),
      executeUser: vi.fn(async () => undefined),
      queryBoolean: vi.fn(async () => true),
    };
    const probe = new SqlLiveSessionProbe(database);

    await expect(probe.isLive({ userId: ids.user, sessionId: ids.session })).resolves.toBe(true);

    expect(database.queryBoolean).toHaveBeenCalledWith({
      text: expect.stringContaining("FROM auth.sessions"),
      values: [ids.session, ids.user],
    });
  });
});
