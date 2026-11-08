import { describe, expect, it, vi } from "vitest";
import { createTrustedMfaHandler, InMemoryIntentGate } from "./trusted-http.js";
import { TrustedMfaClient } from "./trusted-client.js";

const issuer = "https://xxownwxxajzrviuvvfiu.supabase.co/auth/v1";
const ids = {
  intent: "10000000-0000-4000-8000-000000000001",
  factor: "20000000-0000-4000-8000-000000000002",
  challenge: "30000000-0000-4000-8000-000000000003",
  user: "40000000-0000-4000-8000-000000000004",
  session: "50000000-0000-4000-8000-000000000005",
} as const;

function fixture() {
  const proofs = {
    bind: vi.fn(async () => undefined),
    attest: vi.fn(async () => undefined),
    reject: vi.fn(async () => undefined),
  };
  const dependencies = {
    tokens: {
      expectedIssuer: issuer,
      verify: vi.fn(async (token: string): Promise<Record<string, unknown>> => ({
        sub: ids.user,
        session_id: ids.session,
        aal: token === "verified-token" ? "aal2" : "aal1",
        aud: "authenticated",
        iss: issuer,
        exp: 2_000_000_000,
      })),
    },
    provider: {
      challenge: vi.fn(async () => ({ id: ids.challenge })),
      verify: vi.fn(async () => ({ accessToken: "verified-token" })),
    },
    proofs,
  };
  const cancel = vi.fn(async () => undefined);
  const handler = createTrustedMfaHandler({
    createDependencies: () => dependencies,
    cancel,
    gate: new InMemoryIntentGate(),
  });
  return { handler, dependencies, proofs, cancel };
}

function verifyRequest(token = "initial-token") {
  return new Request("https://trusted.invalid/trusted-mfa/v1/verify", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ intentId: ids.intent, factorId: ids.factor, code: "123456" }),
  });
}

describe("trusted MFA HTTP boundary", () => {
  it("verifies MFA without accepting an access token from the JSON body", async () => {
    const f = fixture();

    const response = await f.handler(verifyRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accessToken: "verified-token" });
    expect(f.dependencies.tokens.verify).toHaveBeenNthCalledWith(1, "initial-token");
  });

  it("rejects forged or malformed HTTP authentication before calling MFA", async () => {
    const f = fixture();
    const request = verifyRequest();
    request.headers.delete("authorization");

    const response = await f.handler(request);

    expect(response.status).toBe(401);
    expect(f.dependencies.provider.challenge).not.toHaveBeenCalled();
  });

  it("closes the intent when the client explicitly cancels", async () => {
    const f = fixture();
    const response = await f.handler(new Request("https://trusted.invalid/trusted-mfa/v1/cancel", {
      method: "POST",
      headers: { authorization: "Bearer initial-token", "content-type": "application/json" },
      body: JSON.stringify({ intentId: ids.intent }),
    }));

    expect(response.status).toBe(204);
    expect(f.cancel).toHaveBeenCalledWith({ accessToken: "initial-token", intentId: ids.intent });
  });

  it("fails closed when cancellation cannot be confirmed", async () => {
    const f = fixture();
    f.cancel.mockRejectedValue(new Error("database unavailable"));

    const response = await f.handler(new Request("https://trusted.invalid/trusted-mfa/v1/cancel", {
      method: "POST",
      headers: { authorization: "Bearer initial-token", "content-type": "application/json" },
      body: JSON.stringify({ intentId: ids.intent }),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "CANCEL_FAILED" });
  });

  it("allows only one in-flight request for the same access token and intent", async () => {
    const f = fixture();
    let release: (() => void) | undefined;
    f.dependencies.provider.verify.mockImplementation(async () => {
      await new Promise<void>(resolve => { release = resolve; });
      return { accessToken: "verified-token" };
    });

    const first = f.handler(verifyRequest());
    await vi.waitFor(() => expect(f.dependencies.provider.verify).toHaveBeenCalledOnce());
    const duplicate = await f.handler(verifyRequest());
    release?.();

    expect(duplicate.status).toBe(409);
    expect((await first).status).toBe(200);
    expect(f.dependencies.provider.challenge).toHaveBeenCalledOnce();
  });

  it("rejects a stale provider challenge and closes its bound proof", async () => {
    const f = fixture();
    f.dependencies.provider.verify.mockRejectedValue(new Error("stale challenge"));

    const response = await f.handler(verifyRequest());

    expect(response.status).toBe(401);
    expect(f.proofs.attest).not.toHaveBeenCalled();
    expect(f.proofs.reject).toHaveBeenCalledOnce();
  });

  it("rejects a verified JWT from a different session at the HTTP boundary", async () => {
    const f = fixture();
    f.dependencies.tokens.verify.mockImplementation(async (token: string) => ({
      sub: ids.user,
      session_id: token === "verified-token" ? "60000000-0000-4000-8000-000000000006" : ids.session,
      aal: token === "verified-token" ? "aal2" : "aal1",
      aud: "authenticated",
      iss: issuer,
      exp: 2_000_000_000,
    }));

    const response = await f.handler(verifyRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "SESSION_MISMATCH" });
    expect(f.proofs.reject).toHaveBeenCalledOnce();
  });
});

describe("trusted MFA UI client", () => {
  it("sends the session only in Authorization and supports verify plus cancel", async () => {
    const requests: Request[] = [];
    const client = new TrustedMfaClient({
      baseUrl: "https://trusted.invalid",
      fetcher: vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const request = new Request(input, init);
        requests.push(request);
        return request.url.endsWith("/cancel")
          ? new Response(null, { status: 204 })
          : Response.json({ accessToken: "verified-token" });
      }),
    });

    await expect(client.verify({
      accessToken: "initial-token",
      intentId: ids.intent,
      factorId: ids.factor,
      code: "123456",
    })).resolves.toEqual({ accessToken: "verified-token" });
    await expect(client.cancel({ accessToken: "initial-token", intentId: ids.intent })).resolves.toBeUndefined();

    expect(requests).toHaveLength(2);
    expect(requests.every(request => request.headers.get("authorization") === "Bearer initial-token")).toBe(true);
    expect(await requests[0]?.json()).toEqual({ intentId: ids.intent, factorId: ids.factor, code: "123456" });
  });
});
