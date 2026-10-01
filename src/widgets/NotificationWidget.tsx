import { BellRing } from "lucide-react";
import { NotificationList } from "../components/NotificationList";
import { Panel } from "../components/Panel";
import { useWorkspaceData } from "../workspace-data/WorkspaceDataContext";
import { WorkspaceDataEmpty, WorkspaceDataNotice } from "../workspace-data/WorkspaceDataNotice";
import { useDesktopPanels } from "../components/desktop/DesktopPanelContext";

export const NOTIFICATION_EMPTY_MESSAGE = "확인할 알림이 없습니다.";

export function NotificationWidget() {
  const { state } = useWorkspaceData();
  const { openBogunonTask, openInbox } = useDesktopPanels();
  return (
    <Panel title="알림" icon={BellRing} className="desktop-notifications" action={<button className="panel-link-action" type="button" onClick={openInbox}>전체 보기</button>}>
      {state.status !== "ready" ? <WorkspaceDataNotice state={state} /> : state.data.notifications.length === 0 ? (
        <WorkspaceDataEmpty>{NOTIFICATION_EMPTY_MESSAGE}</WorkspaceDataEmpty>
      ) : (
        <NotificationList
          items={state.data.notifications}
          onOpen={(item) => openBogunonTask(item.id, item.relevantDate ?? null)}
        />
      )}
    </Panel>
  );
}
