import { lazy, Suspense, useState } from "react";
import "./styles/base.css";
import "./styles/dashboard.css";
import "./styles/components.css";
import "./styles/release-ui.css";
import "./styles/desktop-workspace.css";
import { AiConnectionProvider } from "./ai/AiConnectionContext";
import { AuthProvider } from "./auth/AuthContext";
import { ChatGptConnectionProvider } from "./chatgpt/ChatGptConnectionContext";
import { DashboardCanvas } from "./components/dashboard/DashboardCanvas";
import { WidgetSessionProvider } from "./dashboard/WidgetSessionContext";
import { MealDataProvider } from "./meal/MealDataContext";
import { OfficialDocumentSessionProvider } from "./official-document/OfficialDocumentSessionContext";
import { OnboardingProvider } from "./onboarding/OnboardingContext";
import { AccountSyncProvider } from "./settings/AccountSyncContext";
import { WorkspaceDataProvider } from "./workspace-data/WorkspaceDataContext";
import { WeatherDataProvider } from "./weather/WeatherDataContext";
import { DesktopUpdaterProvider } from "./updater/DesktopUpdaterContext";

const FinanceScreen = lazy(() => import("./my-finance/FinanceScreen").then((module) => ({ default: module.FinanceScreen })));

export function App() {
  const [financeOpen, setFinanceOpen] = useState(false);
  const closeFinance = () => {
    setFinanceOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("[data-finance-launcher]")?.focus());
  };
  return (
    <>
    <div hidden={financeOpen} inert={financeOpen} style={{ display: financeOpen ? "none" : undefined }}>
    <ChatGptConnectionProvider>
      <AiConnectionProvider>
        <AuthProvider>
          <OnboardingProvider>
            <AccountSyncProvider>
              <WidgetSessionProvider>
                <WorkspaceDataProvider>
                  <MealDataProvider>
                    <WeatherDataProvider>
                      <OfficialDocumentSessionProvider>
                        <DesktopUpdaterProvider>
                          <DashboardCanvas onOpenFinance={() => setFinanceOpen(true)} suspended={financeOpen} />
                        </DesktopUpdaterProvider>
                      </OfficialDocumentSessionProvider>
                    </WeatherDataProvider>
                  </MealDataProvider>
                </WorkspaceDataProvider>
              </WidgetSessionProvider>
            </AccountSyncProvider>
          </OnboardingProvider>
        </AuthProvider>
      </AiConnectionProvider>
    </ChatGptConnectionProvider>
    </div>
    {financeOpen && <Suspense fallback={<main aria-busy="true"><p role="status">MY FINANCE 화면을 불러오는 중입니다…</p><button type="button" onClick={closeFinance}>보건 업무로</button></main>}><FinanceScreen onClose={closeFinance} /></Suspense>}
    </>
  );
}
