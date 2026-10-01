import { RefreshCw, Utensils } from "lucide-react";
import { Panel } from "../components/Panel";
import { executeNativeDesktopAction } from "../desktop/actions";
import { useMealData } from "../meal/MealDataContext";
import type { MealState } from "../meal/types";

export const MEAL_SCHOOL_SETTINGS_ACTION_ID = "bogunon-school-settings" as const;

const actionButton = (label: string, onClick: () => void) => (
  <button className="meal-action" type="button" onClick={onClick}>{label}</button>
);

function MealContent({ state, onRefresh }: { readonly state: MealState; readonly onRefresh: () => void }) {
  switch (state.status) {
    case "loading":
      return <p className="meal-state">급식 정보를 불러오는 중입니다.</p>;
    case "signedOut":
      return <p className="meal-state">급식을 보려면 Google 계정을 연결해 주세요.</p>;
    case "connectionRequired":
      return <div className="meal-state"><p>BOGUNON 연결이 필요합니다.</p>{actionButton("설정 열기", () => void executeNativeDesktopAction("settings"))}</div>;
    case "school-missing":
      return <div className="meal-state"><p>학교를 등록하면 오늘의 급식을 확인할 수 있습니다.</p>{actionButton("BOGUNON에서 학교 등록", () => void executeNativeDesktopAction(MEAL_SCHOOL_SETTINGS_ACTION_ID))}</div>;
    case "disabled":
      return <div className="meal-state"><p>BOGUNON에서 급식 표시가 꺼져 있습니다.</p>{actionButton("설정에서 켜기", () => void executeNativeDesktopAction(MEAL_SCHOOL_SETTINGS_ACTION_ID))}</div>;
    case "empty":
      return <div className="meal-ready"><strong>{state.schoolName}</strong><p className="meal-state">오늘은 급식 정보가 없습니다.</p></div>;
    case "error":
      return <div className="meal-state"><p>급식 정보를 불러오지 못했습니다.</p>{actionButton("새로고침", onRefresh)}</div>;
    case "ready": {
      const visibleMenu = state.menu.slice(0, 4);
      const hiddenCount = state.menu.length - visibleMenu.length;
      return (
        <div className="meal-ready">
          <strong title={state.schoolName}>{state.schoolName}</strong>
          <ul>{visibleMenu.map((menu, index) => <li key={`${index}-${menu}`} title={menu}>{menu}</li>)}</ul>
          {(hiddenCount > 0 || state.calories !== null) && (
            <div className="meal-meta">
              {hiddenCount > 0 && <span className="meal-more">+{hiddenCount}</span>}
              {state.calories !== null && <small>{state.calories}</small>}
            </div>
          )}
        </div>
      );
    }
  }
}

export function MealWidget() {
  const { state, refresh } = useMealData();
  return (
    <Panel
      title="오늘의 급식"
      icon={Utensils}
      className="meal-panel"
      action={state.status === "ready" || state.status === "empty"
        ? <button className="meal-refresh" type="button" aria-label="급식 새로고침" onClick={refresh}><RefreshCw size={14} /></button>
        : undefined}
    >
      <MealContent state={state} onRefresh={refresh} />
    </Panel>
  );
}
