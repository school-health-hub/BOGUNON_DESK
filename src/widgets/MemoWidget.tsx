import { StickyNote } from "lucide-react";
import { Panel } from "../components/Panel";
import { QuickMemoEditor } from "../components/desktop/QuickMemoEditor";
import { useDesktopPanels } from "../components/desktop/DesktopPanelContext";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";

export function MemoWidget() {
  const { memo, setMemo } = useWidgetSession();
  const { notify, openQuickAddFromMemo, openQuickMemoUrl } = useDesktopPanels();

  return (
    <Panel title="빠른 메모" icon={StickyNote} className="memo-panel">
      <QuickMemoEditor
        id="widget-quick-memo"
        memo={memo}
        mode="widget"
        onChange={setMemo}
        onCreateTask={openQuickAddFromMemo}
        onNotice={notify}
        onOpenUrl={openQuickMemoUrl}
      />
      <p>현재 실행 중에만 유지됩니다.</p>
    </Panel>
  );
}
