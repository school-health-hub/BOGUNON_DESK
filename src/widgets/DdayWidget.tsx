import { Flag } from "lucide-react";
import { Panel } from "../components/Panel";
import { WorkspaceDataEmpty, WorkspaceDataNotice } from "../workspace-data/WorkspaceDataNotice";
import { formatDday } from "../dashboard/dateSource";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";
import { useWorkspaceData } from "../workspace-data/WorkspaceDataContext";

export const DDAY_EMPTY_MESSAGE = "다가오는 D-Day가 없습니다.";

export function DdayWidget() {
  const { now } = useWidgetSession();
  const { state } = useWorkspaceData();
  const items = state.status === "ready" ? state.data.ddayItems : [];
  return (
    <Panel title="D-Day" icon={Flag} className="dday-panel">
      {state.status !== "ready" ? <WorkspaceDataNotice state={state} /> : items.length === 0 ? (
        <WorkspaceDataEmpty>{DDAY_EMPTY_MESSAGE}</WorkspaceDataEmpty>
      ) : (
        <ul className="dday-list">
          {items.map((item) => <li key={`${item.source}:${item.id}`}><strong>{formatDday(item.targetDate, now)}</strong><span>{item.title}</span></li>)}
        </ul>
      )}
    </Panel>
  );
}
