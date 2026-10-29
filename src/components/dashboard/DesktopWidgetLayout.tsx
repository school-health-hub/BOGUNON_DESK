import { GridLayout, type Layout } from "react-grid-layout";
import { useMemo } from "react";
import { toGridLayout } from "../../dashboard/layoutTransforms";
import type { WidgetLayout } from "../../dashboard/types";
import { useWorkspaceData } from "../../workspace-data/WorkspaceDataContext";
import { CompactWorkspaceNotices } from "../../workspace-data/WorkspaceDataNotice";
import { WidgetFrame } from "./WidgetFrame";

type Props = {
  readonly widgets: readonly WidgetLayout[];
  readonly width: number;
  readonly compact: boolean;
  readonly editing: boolean;
  readonly selectedId: string | null;
  readonly metrics: { readonly contentHeight: number; readonly rowHeight: number; readonly margin: number };
  readonly onLayoutChange: (layout: Layout) => void;
  readonly onHide: (id: string) => void;
  readonly onSelect: (id: string) => void;
};

/** Composition boundary: existing widgets retain their data/providers and actions. */
export function DesktopWidgetLayout({ widgets, width, compact, editing, selectedId, metrics, onLayoutChange, onHide, onSelect }: Props) {
  const { state } = useWorkspaceData();
  const layout = useMemo(() => toGridLayout(widgets, editing && !compact), [widgets, editing, compact]);
  const widgetElements = widgets.filter((widget) => widget.visible).sort((a, b) => a.y - b.y || a.x - b.x).map((widget) => (
    <div key={widget.id} className={compact ? "react-grid-item" : undefined} data-widget-type={widget.type} data-grid-height={widget.h} data-grid-width={widget.w} tabIndex={-1}>
      <WidgetFrame isEditing={editing} isSelected={selectedId === widget.id} widget={widget}
        onHide={() => onHide(widget.id)} onSelect={() => onSelect(widget.id)} />
    </div>
  ));
  return (
    <section className="desktop-workspace-layout" aria-label="데스크톱 위젯 작업 공간">
      {state.status === "signedOut" && <p className="desktop-connection-notice" role="status">
        <strong>BOGUNON 연결 대기</strong>
        <span>설정에서 Google 계정을 연결하면 업무와 일정을 볼 수 있습니다.</span>
      </p>}
      <CompactWorkspaceNotices>
        {compact ? <div className="desktop-widget-grid desktop-widget-stack">{widgetElements}</div> : <GridLayout
          autoSize={false}
          className={`workspace-grid desktop-widget-grid${editing ? " is-editing" : ""}`}
          dragConfig={{ enabled: editing && !compact, handle: ".widget-frame__drag", cancel: ".react-resizable-handle, button, textarea, input, select, a" }}
          gridConfig={{ cols: 12, rowHeight: metrics.rowHeight, margin: [metrics.margin, metrics.margin], containerPadding: null, maxRows: 40 }}
          layout={layout}
          resizeConfig={{ enabled: editing && !compact, handles: ["se"] }}
          style={{ height: metrics.contentHeight }}
          width={width}
          onLayoutChange={onLayoutChange}
        >
          {widgetElements}
        </GridLayout>}
      </CompactWorkspaceNotices>
    </section>
  );
}
