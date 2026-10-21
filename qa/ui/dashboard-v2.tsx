import { useState } from "react";
import { createRoot } from "react-dom/client";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../../src/styles/base.css";
import "../../src/styles/dashboard.css";
import "../../src/styles/components.css";
import "../../src/styles/release-ui.css";
import "../../src/styles/desktop-workspace.css";
import { DesktopWidgetLayout } from "../../src/components/dashboard/DesktopWidgetLayout";
import { DesktopPanelProvider } from "../../src/components/desktop/DesktopPanelContext";
import { calculateDashboardGridMetrics, useViewportWidth, useViewportHeight } from "../../src/components/dashboard/dashboardCanvasSupport";
import { createDefaultDashboardLayout } from "../../src/dashboard/layouts";
import { resolveDeskGeometry } from "../../src/dashboard/deskGeometry";
import { AppDock } from "../../src/dock/AppDock";
import { createDefaultDockLayout } from "../../src/dock/storage";
import { useWidgetSession } from "../../src/dashboard/WidgetSessionContext";

function Preview() {
  const width = useViewportWidth();
  const height = useViewportHeight();
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState("합성 QA · 실제 데이터/IPC/저장 없음");
  const { now } = useWidgetSession();
  const geometry = resolveDeskGeometry(createDefaultDashboardLayout(), width);
  const metrics = calculateDashboardGridMetrics(height, 10, geometry);
  return <DesktopPanelProvider notify={setAction} openBogunonTask={async () => setAction("합성 업무 이동")}
    openInbox={() => setAction("합성 받은 업무함")} openQuickAddEventForDate={(date) => setAction(`일정 추가 ${date}`)}
    openQuickAddFromMemo={() => setAction("합성 메모 일정")} openQuickMemoUrl={async () => setAction("합성 링크")}
    runDesktopAction={async (id) => setAction(`실행 ${id}`)} workFolderFavorites={[]} openWorkFolderFavorite={async () => setAction("합성 폴더")}>
    <div className={`app-shell workspace-shell bg-blue-gray card-default corner-soft ${editing ? "is-edit-mode" : "is-view-mode"}`}>
      <div className="workspace-view-actions"><span role="status">{action}</span><button className="toolbar-button" onClick={() => setEditing(!editing)}>화면 꾸미기</button></div>
      <main className="dashboard workspace-dashboard is-dense-desk" aria-label={`합성 업무판 ${now.toLocaleDateString()}`}>
        <DesktopWidgetLayout widgets={geometry.widgets} width={width - 36} compact={width < 900} editing={editing} selectedId={null} metrics={metrics} onLayoutChange={() => undefined} onHide={() => setAction("합성 숨김")} onSelect={() => undefined} />
      </main>
      <div className="dock-zone"><AppDock dockLayout={createDefaultDockLayout()} activeActionId="home" onAction={(id) => setAction(`실행 ${id}`)} /></div>
    </div>
  </DesktopPanelProvider>;
}
const root = document.getElementById("root");
if (root !== null) createRoot(root).render(<Preview />);
