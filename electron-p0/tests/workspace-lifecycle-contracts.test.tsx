// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { P0App } from "../renderer/P0App";
import { WorkspaceBoundary } from "../renderer/WorkspaceBoundary";

const newsletterLifecycle = vi.hoisted(() => ({ mounts: 0 }));

vi.mock("../../src/newsletter/NewsletterStudio", async () => {
  const { useState } = await import("react");
  return {
    NewsletterStudio: ({ onClose }: { readonly onClose: () => void }) => {
      const [instance] = useState(() => {
        newsletterLifecycle.mounts += 1;
        return newsletterLifecycle.mounts;
      });
      return <main><h1>{`합성 소식지 ${instance}`}</h1><button type="button" onClick={onClose}>소식지 닫기</button></main>;
    },
  };
});
vi.mock("../renderer/school-profile/SchoolProfile", () => ({
  SchoolProfileProvider: ({ children }: { readonly children: ReactNode }) => <>{children}</>,
  SchoolInitialSetup: () => null,
  SchoolProfileSettings: () => null,
}));
vi.mock("../renderer/purchase/PurchaseSession", () => ({ PurchaseSession: () => null }));
vi.mock("../../src/components/dashboard/DesktopWidgetLayout", () => ({ DesktopWidgetLayout: () => <div>합성 Home</div> }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  newsletterLifecycle.mounts = 0;
});

function setupDashboard(): void {
  vi.stubGlobal("ResizeObserver", class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  });
  vi.stubGlobal("electronP0", {
    info: async () => ({ appId: "kr.sungandi.schoolhealthdesk.electronp0", userData: "/synthetic-profile" }),
    readSettings: async () => null,
    writeSettings: vi.fn(async () => undefined),
  });
  vi.stubGlobal("electronWork", {
    memo: { read: async () => ({ ok: true, data: { version: 1, text: "" } }), write: vi.fn() },
    tasks: {
      load: async () => ({ ok: true, data: { document: { version: 1, revision: 0, tasks: [] }, recovered: false } }),
      save: vi.fn(),
    },
  });
}

it("keeps Newsletter mounted while its workspace is closed and reopened", async () => {
  // Given: the current P0 dashboard and its existing Settings handoff into Newsletter.
  setupDashboard();
  render(<P0App />);
  fireEvent.click(await screen.findByRole("button", { name: "설정" }));
  fireEvent.click(screen.getByRole("button", { name: "앱 정보" }));

  // When: Newsletter is opened, closed, and opened again through the same current entry path.
  fireEvent.click(screen.getByRole("button", { name: "보건소식지 제작소" }));
  expect(await screen.findByRole("heading", { name: "합성 소식지 1" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "소식지 닫기" }));
  fireEvent.click(await screen.findByRole("button", { name: "설정" }));
  fireEvent.click(screen.getByRole("button", { name: "앱 정보" }));
  fireEvent.click(screen.getByRole("button", { name: "보건소식지 제작소" }));

  // Then: the original component instance is revealed rather than remounted.
  expect(await screen.findByRole("heading", { name: "합성 소식지 1" })).toBeTruthy();
  expect(newsletterLifecycle.mounts).toBe(1);
});

it("keeps a failed SCHOOL workspace inside its independent error boundary", () => {
  // Given: a SCHOOL child that fails before shared data can render.
  const close = vi.fn();
  const reactError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const BrokenSchool = (): ReactNode => {
    throw new TypeError("synthetic SCHOOL failure");
  };

  // When: the current SCHOOL boundary catches the failure.
  render(<WorkspaceBoundary onClose={close}><BrokenSchool /></WorkspaceBoundary>);
  fireEvent.click(screen.getByRole("button", { name: "개인 업무로 돌아가기" }));

  // Then: shared content is not exposed and the existing personal-work return path is used.
  expect(screen.getByRole("alert").textContent).toContain("개인 업무는 계속 사용할 수 있습니다");
  expect(close).toHaveBeenCalledOnce();
  expect(reactError).toHaveBeenCalled();
  reactError.mockRestore();
});
