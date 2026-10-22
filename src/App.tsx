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
import { ConnectedFinder } from "./education-video/ConnectedFinder";

const FinanceScreen = lazy(() => import("./my-finance/FinanceScreen").then((module) => ({ default: module.FinanceScreen })));

export function App() {
  const [videoFinderOpen, setVideoFinderOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const closeVideoFinder = () => {
    setVideoFinderOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("[data-education-video-launcher]")?.focus());
  };
  const closeFinance = () => {
    setFinanceOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("[data-finance-launcher]")?.focus());
  };
  return (
    <>
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
                          <div hidden={financeOpen || videoFinderOpen} inert={financeOpen || videoFinderOpen} style={{ display: financeOpen || videoFinderOpen ? "none" : undefined }}>
                            <DashboardCanvas onOpenFinance={() => setFinanceOpen(true)} onOpenEducationVideo={() => setVideoFinderOpen(true)} suspended={financeOpen || videoFinderOpen} />
                          </div>
                          {videoFinderOpen && <ConnectedFinder onClose={closeVideoFinder} />}
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
    {financeOpen && <Suspense fallback={<main aria-busy="true"><p role="status">MY FINANCE 화면을 불러오는 중입니다…</p><button type="button" onClick={closeFinance}>보건 업무로</button></main>}><FinanceScreen onClose={closeFinance} /></Suspense>}
    </>
  );
}
