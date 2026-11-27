import { GripVertical, X } from "lucide-react";
import { useState } from "react";
import { dockRegistry } from "./dockRegistry";
import "./dock-editor.css";
import { DOCK_LAYOUT_VERSION, type DockItemId, type DockLayout } from "./types";

type DockEditorProps = {
  readonly dockLayout: DockLayout;
  readonly onClose: () => void;
  readonly onUpdate: (layout: DockLayout) => void;
  readonly managedVisibilityIds?: readonly DockItemId[];
};

const moveItem = (layout: DockLayout, sourceId: DockItemId, targetId: DockItemId): DockLayout => {
  const sourceIndex = layout.items.findIndex((item) => item.id === sourceId);
  const targetIndex = layout.items.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return layout;
  const items = [...layout.items];
  const [source] = items.splice(sourceIndex, 1);
  if (source === undefined) return layout;
  items.splice(targetIndex, 0, source);
  return { version: DOCK_LAYOUT_VERSION, items };
};

export function DockEditor({ dockLayout, onClose, onUpdate, managedVisibilityIds = [] }: DockEditorProps) {
  const [draggingId, setDraggingId] = useState<DockItemId | null>(null);
  const visibleItems = dockLayout.items.filter((item) => item.visible);

  const reorder = (source: DockItemId, target: DockItemId) => {
    const next = moveItem(dockLayout, source, target);
    if (next !== dockLayout) onUpdate(next);
  };

  return (
    <aside className="workspace-editor-panel dock-editor" id="workspace-dock-panel" aria-label="Dock 편집">
      <header>
        <div><strong>Dock에 표시할 아이콘과 순서를 설정합니다.</strong></div>
        <button type="button" aria-label="Dock 편집 닫기" onClick={onClose}><X size={16} /></button>
      </header>
      <p className="workspace-editor-panel__intro">드래그하여 순서를 바꾸거나, 오른쪽 스위치로 표시 여부를 변경할 수 있습니다.</p>
      <section className="dock-editor__preview" aria-label="Dock 미리보기">
        <h3>미리보기</h3>
        {visibleItems.length > 0 ? (
          <div className="dock-editor__preview-scroll" tabIndex={0} role="region" aria-label="표시 중인 Dock 아이콘">
            <ul className="dock dock-editor__preview-list">
              {visibleItems.map(({ id }) => {
                const { icon: Icon, label } = dockRegistry[id];
                return <li key={id} data-dock-item={id} title={label}>
                  <span className="dock__icon"><Icon size={23} strokeWidth={1.75} aria-hidden="true" /></span>
                  <span className="dock-editor__sr-only">{label}</span>
                </li>;
              })}
            </ul>
          </div>
        ) : <p>표시 중인 아이콘이 없습니다.</p>}
      </section>
      <div className="workspace-editor-panel__body dock-editor__list">
        {dockLayout.items.map((item, index) => {
          const { icon: Icon, label } = dockRegistry[item.id];
          return (
            <article key={item.id} data-visible={item.visible} data-dock-editor-item={item.id}
              onDragOver={(event) => {
                if (draggingId === null) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                if (draggingId === null) return;
                event.preventDefault();
                reorder(draggingId, item.id);
                setDraggingId(null);
              }}
            >
              <button
                className="dock-editor__drag"
                type="button"
                draggable
                aria-label={`${label} 순서 변경`}
                aria-keyshortcuts="ArrowUp ArrowDown"
                title="드래그하거나 위·아래 방향키로 이동"
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", item.id);
                  event.dataTransfer.effectAllowed = "move";
                  setDraggingId(item.id);
                }}
                onDragEnd={() => setDraggingId(null)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                  event.preventDefault();
                  const target = dockLayout.items[index + (event.key === "ArrowUp" ? -1 : 1)];
                  if (target) reorder(item.id, target.id);
                }}
              >
                <GripVertical size={15} aria-hidden="true" />
              </button>
              <Icon size={18} aria-hidden="true" />
              <span className="dock-editor__name">{label}</span>
              <label className="dock-editor__visibility">
                <span aria-hidden="true">{item.visible ? "표시" : "숨김"}</span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={`${label} Dock에 표시`}
                  checked={item.visible}
                  disabled={managedVisibilityIds.includes(item.id)}
                  onChange={(event) => {
                    const visible = event.currentTarget.checked;
                    const items = dockLayout.items.map((candidate) =>
                      candidate.id === item.id ? { ...candidate, visible } : candidate,
                    );
                    onUpdate({ version: DOCK_LAYOUT_VERSION, items });
                  }}
                />
              </label>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
