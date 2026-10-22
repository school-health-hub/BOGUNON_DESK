// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfficialDocumentQaApp } from "./OfficialDocumentQaApp";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tauri-apps/api/core")>(),
  invoke,
  isTauri: () => true,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ close: vi.fn(async () => undefined) }),
}));

vi.mock("../ai/AiConnectionContext", async () => await import("./inertConnections"));
vi.mock("../chatgpt/ChatGptConnectionContext", async () => await import("./inertConnections"));

const isolatedInfo = {
  identifier: "kr.sungandi.schoolhealthdesk.officialdocumentqa",
  sourceSha: "a".repeat(40),
  localData: "C:\\QA\\kr.sungandi.schoolhealthdesk.officialdocumentqa",
  webviewData: "C:\\QA\\kr.sungandi.schoolhealthdesk.officialdocumentqa\\EBWebView",
  networkEnabled: false,
  loginEnabled: false,
  chatGptEnabled: false,
  aiEnabled: false,
  accountSyncEnabled: false,
  updaterEnabled: false,
  deepLinkEnabled: false,
  autostartEnabled: false,
  trayEnabled: false,
  externalUrlEnabled: false,
} as const;

describe("OfficialDocumentQaApp", () => {
  afterEach(cleanup);

  beforeEach(() => {
    invoke.mockReset();
  });

  it("renders the existing document workspace only after native isolation is verified", async () => {
    invoke.mockImplementation(async (command: string) => {
      if (command === "official_document_qa_info") return isolatedInfo;
      if (command === "read_official_reference_package") return null;
      throw new Error(`unexpected command: ${command}`);
    });

    render(<OfficialDocumentQaApp />);
    expect(screen.queryByRole("dialog", { name: "공문 작업실" })).toBeNull();

    await act(async () => undefined);

    expect(await screen.findByRole("dialog", { name: "공문 작업실" })).toBeTruthy();
    expect(screen.getByText("격리 QA · 합성 데이터 전용")).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith("official_document_qa_info");
    expect(invoke).not.toHaveBeenCalledWith("chatgpt_get_connection_state");
    expect(invoke).not.toHaveBeenCalledWith("validate_ai_connection");
  });

  it("fails closed when native isolation metadata is not exact", async () => {
    invoke.mockResolvedValue({ ...isolatedInfo, identifier: "kr.sungandi.schoolhealthdesk" });

    render(<OfficialDocumentQaApp />);

    expect((await screen.findByRole("alert")).textContent).toContain("QA 격리 정보를 확인하지 못했습니다");
    expect(screen.queryByRole("dialog", { name: "공문 작업실" })).toBeNull();
  });

  it("fails closed when native isolation metadata reports the old synthetic WebView path", async () => {
    invoke.mockResolvedValue({
      ...isolatedInfo,
      webviewData: "C:\\QA\\kr.sungandi.schoolhealthdesk.officialdocumentqa\\main\\official-document-qa-webview",
    });

    render(<OfficialDocumentQaApp />);

    expect((await screen.findByRole("alert")).textContent).toContain("QA 격리 정보를 확인하지 못했습니다");
    expect(screen.queryByRole("dialog", { name: "공문 작업실" })).toBeNull();
  });
});
