// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SchoolClientStore } from "../core/client-store.js";
import type { Action, SchoolState } from "../core/types.js";
import { SchoolWorkspace } from "../ui/SchoolWorkspace.js";

const school = "10000000-0000-4000-8000-000000000001";
const target = "20000000-0000-4000-8000-000000000002";

function state(status: "ready" | "challenge" | "unsupported", notice?: string): SchoolState {
  return {
    workspace: {
      phase: "approved",
      context: {
        schoolId: school,
        role: "SCHOOL_ADMIN",
        memberCode: "admin",
        epoch: 1,
        version: 1,
        permissions: [],
        evidence: "MOCK",
      },
    },
    selected: school,
    directory: [],
    self: { memberships: [], space_requests: [] },
    admin: {
      requests: [],
      members: [{
        id: target,
        member_code: "teacher-02",
        role: "HEALTH_TEACHER",
        status: "active",
        version: 1,
        approved_at: null,
        valid_until: null,
      }],
    },
    transfers: [],
    adminMfa: status === "challenge"
      ? { status, purpose: "propose", expiresAt: Date.now() + 120_000 }
      : { status },
    ...(notice ? { notice } : {}),
  };
}

afterEach(cleanup);

it("collects a six-digit code only after a purpose-bound challenge", async () => {
  let current = state("ready");
  const command = vi.fn(async (action: Action) => {
    if (action === "propose") current = state("challenge");
    if (action === "mfaVerify") current = state("ready", "서버에서 관리자 변경 결과를 확인했습니다.");
    return current;
  });
  const store = new SchoolClientStore({ command });
  await store.command("state");
  render(<SchoolWorkspace store={store} client="electron" connected />);

  fireEvent.change(screen.getByLabelText("대상 보건교사"), { target: { value: target } });
  fireEvent.click(screen.getByRole("button", { name: "수락 요청 보내기" }));
  fireEvent.click(screen.getByRole("button", { name: "MFA 인증 시작" }));

  const input = await screen.findByLabelText("인증번호");
  fireEvent.change(input, { target: { value: "12a3456" } });
  expect(input).toBeInstanceOf(HTMLInputElement);
  if (!(input instanceof HTMLInputElement)) throw new TypeError("Expected MFA input");
  expect(input.value).toBe("123456");
  fireEvent.click(screen.getByRole("button", { name: "인증하고 계속" }));

  await waitFor(() => expect(screen.queryByLabelText("인증번호")).toBeNull());
  expect(command).toHaveBeenCalledWith("mfaVerify", { code: "123456" });
  expect(screen.getByText("서버에서 관리자 변경 결과를 확인했습니다.")).toBeTruthy();
});

it("keeps admin transfer disabled when the trusted server is unavailable", async () => {
  const store = new SchoolClientStore({ command: vi.fn(async () => state("unsupported")) });
  await store.command("state");
  render(<SchoolWorkspace store={store} client="electron" connected />);

  fireEvent.change(screen.getByLabelText("대상 보건교사"), { target: { value: target } });

  const submit = screen.getByRole("button", { name: "수락 요청 보내기" });
  expect(submit).toBeInstanceOf(HTMLButtonElement);
  if (!(submit instanceof HTMLButtonElement)) throw new TypeError("Expected admin transfer button");
  expect(submit.disabled).toBe(true);
  expect(screen.getByText(/Trusted MFA 서버와 DB 권한이 구성되지 않아/)).toBeTruthy();
});
