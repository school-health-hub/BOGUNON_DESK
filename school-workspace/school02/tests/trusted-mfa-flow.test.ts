import { expect, it, vi } from "vitest";
import type { WorkspaceAuthStatus } from "../../auth/common/types.js";
import { WorkspaceCoordinator } from "../../integration/core/workspace.js";
import {
  SchoolController,
  type AdminMfaAttempt,
  type SchoolAdminMfaPort,
} from "../core/controller.js";

const school = "10000000-0000-4000-8000-000000000001";
const otherSchool = "10000000-0000-4000-8000-000000000002";
const target = "20000000-0000-4000-8000-000000000002";
const attempt: AdminMfaAttempt = {
  intentId: "30000000-0000-4000-8000-000000000003",
  factorId: "40000000-0000-4000-8000-000000000004",
  schoolId: school,
  purpose: "propose",
  expiresAt: Date.now() + 120_000,
};

function fixture(adminMfa?: SchoolAdminMfaPort) {
  let status: WorkspaceAuthStatus = {
    kind: "authenticated",
    session: { user: { id: "actor" }, expiresAt: Number.MAX_SAFE_INTEGER },
  };
  const workspace = new WorkspaceCoordinator({
    authStatus: async () => status,
    login: async () => {},
    logout: async () => { status = { kind: "signed_out" }; },
    invalidate: () => {},
    bootstrap: async () => ({ actor_id: "actor" }),
    membership: async () => ({ status: "active" }),
    context: async schoolId => ({
      schoolId,
      role: "SCHOOL_ADMIN",
      memberCode: "admin",
      epoch: 1,
      version: 1,
      permissions: [],
      evidence: "MOCK",
    }),
    rpc: async () => { throw new Error("unexpected coordinator RPC"); },
  });
  const legacy = vi.fn(async () => ({}));
  const controller = new SchoolController({
    workspace,
    adminMfa,
    call: async (name, args) => {
      if (name === "ws_s02_self") return { memberships: [], space_requests: [] };
      if (name === "ws_s02_admin") return { requests: [], members: [] };
      if (name === "ws_s02_transfers") return [];
      return legacy(name, args);
    },
  });
  return { controller, legacy };
}

function mfa(overrides: Partial<SchoolAdminMfaPort> = {}): SchoolAdminMfaPort {
  return {
    start: vi.fn(async () => attempt),
    verify: vi.fn(async () => ({ verified: true as const })),
    execute: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    ...overrides,
  };
}

it("executes one purpose-bound intent only after trusted verification", async () => {
  const port = mfa();
  const { controller, legacy } = fixture(port);
  await controller.command("select", { school });

  const challenged = await controller.command("propose", { id: target, mode: "transfer" });
  expect(challenged.adminMfa).toMatchObject({ status: "challenge", purpose: "propose" });
  expect(legacy).not.toHaveBeenCalledWith("ws_v1_propose_admin_change", expect.anything());

  const completed = await controller.command("mfaVerify", { code: "123456" });
  expect(port.verify).toHaveBeenCalledWith(attempt, "123456", expect.any(AbortSignal));
  expect(port.execute).toHaveBeenCalledWith(attempt, expect.any(AbortSignal));
  expect(completed.adminMfa).toEqual({ status: "ready" });
  expect(legacy).not.toHaveBeenCalledWith("ws_v1_propose_admin_change", expect.anything());
});

it("cancels the exact pending intent and never executes it", async () => {
  const port = mfa();
  const { controller } = fixture(port);
  await controller.command("select", { school });
  await controller.command("propose", { id: target, mode: "add" });

  const cancelled = await controller.command("mfaCancel");

  expect(port.cancel).toHaveBeenCalledWith(attempt, expect.any(AbortSignal));
  expect(port.verify).not.toHaveBeenCalled();
  expect(port.execute).not.toHaveBeenCalled();
  expect(cancelled.reauthNotice).toContain("취소");
});

it("fails closed on invalid verification and consumes no transfer", async () => {
  const port = mfa({ verify: vi.fn(async () => { throw new Error("invalid proof"); }) });
  const { controller } = fixture(port);
  await controller.command("select", { school });
  await controller.command("propose", { id: target, mode: "transfer" });

  const failed = await controller.command("mfaVerify", { code: "000000" });

  expect(port.execute).not.toHaveBeenCalled();
  expect(port.cancel).toHaveBeenCalled();
  expect(failed.adminMfa).toEqual({ status: "ready" });
  expect(failed.reauthNotice).toContain("실패");
});

it("rejects an expired attempt before verification", async () => {
  const expired = { ...attempt, expiresAt: Date.now() - 1 };
  const port = mfa({ start: vi.fn(async () => expired) });
  const { controller } = fixture(port);
  await controller.command("select", { school });
  const result = await controller.command("propose", { id: target, mode: "transfer" });

  expect(port.verify).not.toHaveBeenCalled();
  expect(port.execute).not.toHaveBeenCalled();
  expect(result.reauthNotice).toContain("만료");
});

it("serializes duplicate verification clicks", async () => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const port = mfa({ verify: vi.fn(async () => { await pending; return { verified: true as const }; }) });
  const { controller } = fixture(port);
  await controller.command("select", { school });
  await controller.command("propose", { id: target, mode: "transfer" });

  const first = controller.command("mfaVerify", { code: "123456" });
  const duplicate = await controller.command("mfaVerify", { code: "123456" });
  release?.();
  await first;

  expect(duplicate.notice).toContain("처리 중");
  expect(port.verify).toHaveBeenCalledTimes(1);
  expect(port.execute).toHaveBeenCalledTimes(1);
});

it.each(["select", "login", "logout"] as const)("discards and cancels a pending intent on %s", async action => {
  const port = mfa();
  const { controller } = fixture(port);
  await controller.command("select", { school });
  await controller.command("propose", { id: target, mode: "transfer" });

  await controller.command(action, action === "select" ? { school: otherSchool } : {});

  expect(port.cancel).toHaveBeenCalledWith(attempt, expect.any(AbortSignal));
  expect(controller.snapshot().adminMfa).toEqual({ status: "ready" });
});

it("keeps controls unsupported without a trusted server port", async () => {
  const { controller, legacy } = fixture();
  await controller.command("select", { school });

  const result = await controller.command("propose", { id: target, mode: "transfer" });

  expect(result.adminMfa).toEqual({ status: "unsupported" });
  expect(result.notice).toContain("지원하지");
  expect(legacy).not.toHaveBeenCalled();
});
