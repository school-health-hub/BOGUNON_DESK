import { expect, it, vi } from "vitest";
import { createSchoolAdminMfaPort } from "./school02-adapter.js";
import { TrustedMfaClient } from "./trusted-client.js";

const ids = {
  intentId: "10000000-0000-4000-8000-000000000001",
  factorId: "20000000-0000-4000-8000-000000000002",
  schoolId: "30000000-0000-4000-8000-000000000003",
  targetId: "40000000-0000-4000-8000-000000000004",
} as const;

it("keeps the H1 token in the server adapter and binds verify to one attempt", async () => {
  const requests: Request[] = [];
  const client = new TrustedMfaClient({
    baseUrl: "https://trusted.invalid",
    fetcher: vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return Response.json({ accessToken: "upgraded-token" });
    }),
  });
  const auth = {
    authorized: async <T>(operation: (accessToken: string, signal: AbortSignal) => Promise<T>) => operation(
      "private-h1-token",
      new AbortController().signal,
    ),
  };
  const backend = {
    begin: vi.fn(async () => ({
      intentId: ids.intentId,
      factorId: ids.factorId,
      schoolId: ids.schoolId,
      purpose: "propose",
      expiresAt: Date.now() + 120_000,
    })),
    execute: vi.fn(async () => undefined),
  };
  const port = createSchoolAdminMfaPort(auth, client, backend);
  const signal = new AbortController().signal;

  const attempt = await port.start({
    schoolId: ids.schoolId,
    purpose: "propose",
    targetId: ids.targetId,
    mode: "transfer",
  }, signal);
  await port.verify(attempt, "123456", signal);
  await port.execute(attempt, signal);
  await port.cancel(attempt, signal);

  expect(backend.begin).toHaveBeenCalledWith("private-h1-token", expect.anything(), expect.any(AbortSignal));
  expect(backend.execute).toHaveBeenCalledWith("private-h1-token", attempt, expect.any(AbortSignal));
  expect(requests).toHaveLength(2);
  expect(requests.every(request => request.headers.get("authorization") === "Bearer private-h1-token")).toBe(true);
  expect(JSON.stringify(await requests[0]?.clone().json())).not.toContain("private-h1-token");
});

it("rejects a backend attempt that changes the requested scope", async () => {
  const client = new TrustedMfaClient({ baseUrl: "https://trusted.invalid", fetcher: vi.fn() });
  const auth = {
    authorized: async <T>(operation: (accessToken: string, signal: AbortSignal) => Promise<T>) => operation(
      "private-h1-token",
      new AbortController().signal,
    ),
  };
  const port = createSchoolAdminMfaPort(auth, client, {
    begin: vi.fn(async () => ({ ...ids, purpose: "different", expiresAt: Date.now() + 120_000 })),
    execute: vi.fn(async () => undefined),
  });

  await expect(port.start({
    schoolId: ids.schoolId,
    purpose: "propose",
    targetId: ids.targetId,
  }, new AbortController().signal)).rejects.toThrow();
});

it("does not accept a malformed trusted-server response", async () => {
  const client = new TrustedMfaClient({
    baseUrl: "https://trusted.invalid",
    fetcher: vi.fn(async () => Response.json({ verified: true })),
  });
  const auth = {
    authorized: async <T>(operation: (accessToken: string, signal: AbortSignal) => Promise<T>) => operation(
      "private-h1-token",
      new AbortController().signal,
    ),
  };
  const port = createSchoolAdminMfaPort(auth, client, {
    begin: vi.fn(async () => ({
      intentId: ids.intentId,
      factorId: ids.factorId,
      schoolId: ids.schoolId,
      purpose: "propose",
      expiresAt: Date.now() + 120_000,
    })),
    execute: vi.fn(async () => undefined),
  });
  const signal = new AbortController().signal;
  const attempt = await port.start({
    schoolId: ids.schoolId,
    purpose: "propose",
    targetId: ids.targetId,
  }, signal);

  await expect(port.verify(attempt, "123456", signal)).rejects.toThrow();
});
