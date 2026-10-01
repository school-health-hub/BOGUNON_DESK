import "./styles/base.css";
import "./styles/dashboard.css";
import "./styles/components.css";
import { AiConnectionProvider } from "./ai/AiConnectionContext";
import { AuthProvider } from "./auth/AuthContext";
import { DashboardCanvas } from "./components/dashboard/DashboardCanvas";
import { WidgetSessionProvider } from "./dashboard/WidgetSessionContext";
import { MealDataProvider } from "./meal/MealDataContext";
import { OfficialDocumentSessionProvider } from "./official-document/OfficialDocumentSessionContext";
import { OnboardingProvider } from "./onboarding/OnboardingContext";
import { AccountSyncProvider } from "./settings/AccountSyncContext";
import { WorkspaceDataProvider } from "./workspace-data/WorkspaceDataContext";
import { WeatherDataProvider } from "./weather/WeatherDataContext";
import { DesktopUpdaterProvider } from "./updater/DesktopUpdaterContext";

export function App() {
  return (
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
                        <DashboardCanvas />
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
  );
}
