// @vitest-environment jsdom
import { createContext, useContext, useState, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../App";
const SyncContext = createContext(false);
vi.mock("../ai/AiConnectionContext", () => ({ AiConnectionProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../auth/AuthContext", () => ({ AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../chatgpt/ChatGptConnectionContext", () => ({ ChatGptConnectionProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../dashboard/WidgetSessionContext", () => ({ WidgetSessionProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../meal/MealDataContext", () => ({ MealDataProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../official-document/OfficialDocumentSessionContext", () => ({ OfficialDocumentSessionProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../onboarding/OnboardingContext", () => ({ OnboardingProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../workspace-data/WorkspaceDataContext", () => ({ WorkspaceDataProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../weather/WeatherDataContext", () => ({ WeatherDataProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../updater/DesktopUpdaterContext", () => ({ DesktopUpdaterProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../settings/AccountSyncContext", () => ({ AccountSyncProvider: ({ children }: { children: ReactNode }) => <SyncContext.Provider value={true}>{children}</SyncContext.Provider> }));
vi.mock("../components/dashboard/DashboardCanvas", () => ({ DashboardCanvas: ({ onOpenFinance, suspended }: { onOpenFinance: () => void; suspended: boolean }) => {
  const [draft, setDraft] = useState("");
  return <div data-testid="school-work" data-suspended={suspended}><label>합성 학교 초안<input value={draft} onChange={(e) => setDraft(e.target.value)} /></label><button data-finance-launcher onClick={onOpenFinance}>MY FINANCE</button></div>;
} }));
vi.mock("./FinanceScreen", () => ({ FinanceScreen: ({ onClose }: { onClose: () => void }) => <section><h1>{useContext(SyncContext) ? "동기화 내부" : "독립 금융 공간"}</h1><button onClick={onClose}>학교로 돌아가기</button></section> }));
afterEach(cleanup);
it("keeps school drafts mounted while finance is outside the account-sync boundary", async () => {
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
  render(<App />);
  fireEvent.change(screen.getByLabelText("합성 학교 초안"), { target: { value: "합성 학교 작업" } });
  fireEvent.click(screen.getByRole("button", { name: "MY FINANCE" }));
  await screen.findByRole("heading", { name: "독립 금융 공간" });
  expect(screen.queryByRole("button", { name: "MY FINANCE" })).toBeNull();
  expect(screen.getByTestId("school-work").getAttribute("data-suspended")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "학교로 돌아가기" }));
  expect(screen.getByLabelText("합성 학교 초안")).toHaveProperty("value", "합성 학교 작업");
  expect(screen.getByTestId("school-work").getAttribute("data-suspended")).toBe("false");
  vi.unstubAllGlobals();
});
