import { StickyNote, X } from "lucide-react";
import { useEffect } from "react";
import { useWidgetSession } from "../../dashboard/WidgetSessionContext";
import { useDesktopPanels } from "./DesktopPanelContext";
import { QuickMemoEditor } from "./QuickMemoEditor";

export function QuickMemoPanel({ onClose }: { readonly onClose: () => void }) {
  const { memo, setMemo } = useWidgetSession();
  const { notify, openQuickAddFromMemo, openQuickMemoUrl } = useDesktopPanels();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="quick-memo-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="quick-memo-panel" role="dialog" aria-modal="true" aria-label="빠른 메모">
        <header>
          <div className="quick-memo-panel__title-icon"><StickyNote size={18} /></div>
          <div><strong>빠른 메모</strong><span>지금 필요한 내용을 잠깐 적어 둡니다.</span></div>
          <button type="button" aria-label="빠른 메모 닫기" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="quick-memo-panel__body">
          <QuickMemoEditor
            id="panel-quick-memo"
            memo={memo}
            mode="panel"
            onChange={setMemo}
            onCreateTask={openQuickAddFromMemo}
            onNotice={notify}
            onOpenUrl={openQuickMemoUrl}
          />
        </div>
        <footer>앱을 종료하면 메모가 사라집니다. 개인정보가 필요한 기록은 BOGUNON에서 관리하세요.</footer>
      </section>
    </div>
  );
}
