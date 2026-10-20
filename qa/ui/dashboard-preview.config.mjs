import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Explicit QA build only. No runtime demo switch exists in the production app.
export default defineConfig({
  build: { outDir: "dist-dashboard-synthetic" },
  plugins: [{
    name: "synthetic-dashboard-providers",
    enforce: "pre",
    transform(_code, id) {
      const path = id.replaceAll("\\", "/");
      if (path.endsWith("/workspace-data/WorkspaceDataContext.tsx")) return `
        import { syntheticWorkspace } from "/src/widgets/__fixtures__/desktopWorkspace";
        export const WorkspaceDataProvider = ({ children }) => children;
        export const useWorkspaceData = () => ({
          state: { status: "ready", data: new URLSearchParams(location.search).get("density") === "sparse" ? {
            ...syntheticWorkspace, todayTasks: syntheticWorkspace.todayTasks.slice(0, 1),
            calendarEvents: syntheticWorkspace.calendarEvents.slice(0, 1),
            upcomingEvents: syntheticWorkspace.upcomingEvents.slice(0, 1),
            ddayItems: syntheticWorkspace.ddayItems.slice(0, 1),
            weekSchedule: syntheticWorkspace.weekSchedule.map(day => ({ ...day, items: day.items.slice(0, 1) })),
            summary: { todayEventCount: 0, todayTaskCount: 1, incompleteTaskCount: 1 },
          } : syntheticWorkspace }, refresh: () => {},
          setTaskCompleted: async () => "ignored", setTaskActionState: async () => "ignored",
          pendingTaskId: null, taskMutationError: null, taskActionStateError: null,
        });`;
      if (path.endsWith("/weather/WeatherDataContext.tsx")) return `
        export const WeatherDataProvider = ({ children }) => children;
        export const useWeatherData = () => ({ refresh: () => {}, state: {
          status: "ready", schoolName: "합성 QA 학교", observedAt: "2026-10-21T09:00:00+09:00",
          temperatureC: 19, apparentTemperatureC: 18, weatherCode: 2,
          conditionLabel: "구름 조금", highC: 22, lowC: 13,
        }});`;
      if (path.endsWith("/meal/MealDataContext.tsx")) return `
        export const MealDataProvider = ({ children }) => children;
        export const useMealData = () => ({ refresh: () => {}, state: {
          status: "ready", date: "2026-10-21", schoolName: "합성 QA 학교",
          menu: ["합성 · 잡곡밥", "합성 · 채소국", "합성 · 두부조림", "합성 · 과일"], calories: "650 kcal",
        }});`;
    },
  }, react()],
});
