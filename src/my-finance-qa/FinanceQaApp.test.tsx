// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FinanceQaApp } from "./FinanceQaApp";
const api = vi.hoisted(() => ({ invoke: vi.fn(), close: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: api.invoke }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ close: api.close }) }));
vi.mock("../my-finance/FinanceScreen", () => ({ FinanceScreen: ({ qa }: { qa: boolean }) => <p>finance-only {String(qa)}</p> }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("only mounts finance after native isolation info passes", async () => {
  api.invoke.mockResolvedValue({ identifier: "kr.sungandi.schoolhealthdesk.myfinanceqa", sourceSha: "a".repeat(40), localData: "synthetic-qa-local", settingsData: "synthetic-qa-settings", loginEnabled: false, updaterEnabled: false, deepLinkEnabled: false, autostartEnabled: false, trayEnabled: false });
  render(<FinanceQaApp />); await screen.findByText("finance-only true");
  expect(screen.getByText(/합성 데이터 전용/)).toBeTruthy(); expect(api.invoke).toHaveBeenCalledWith("my_finance_qa_info");
});
it("fails closed on a production identity without mounting finance", async () => {
  api.invoke.mockResolvedValue({ identifier: "kr.sungandi.schoolhealthdesk", updaterEnabled: true });
  render(<FinanceQaApp />); await screen.findByRole("alert"); expect(screen.queryByText("finance-only true")).toBeNull();
});
