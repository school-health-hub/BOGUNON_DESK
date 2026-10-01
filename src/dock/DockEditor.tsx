import { GripVertical, X } from "lucide-react";
import { useState } from "react";
import { dockRegistry } from "./dockRegistry";
import { DOCK_LAYOUT_VERSION, type DockItemId, type DockLayout } from "./types";

type DockEditorProps = {
  readonly dockLayout: DockLayout;
  readonly onClose: () => void;
  readonly onUpdate: (layout: DockLayout) => void;
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

export function DockEditor({ dockLayout, onClose, onUpdate }: DockEditorProps) {
  const [draggingId, setDraggingId] = useState<DockItemId | null>(null);

  return (
    <aside className="workspace-editor-panel dock-editor" id="workspace-dock-panel" aria-label="Dock 편집">
      <header>
        <div>
          <strong>Dock</strong>
        </div>
        <button type="button" aria-label="Dock 편집 닫기" onClick={onClose}><X size={16} /></button>
      </header>
      <p className="workspace-editor-panel__intro">아이콘의 순서와 표시 여부를 정하세요.</p>
      <div className="workspace-editor-panel__body dock-editor__list">
        {dockLayout.items.map((item) => {
          const definition = dockRegistry[item.id];
          const Icon = definition.icon;
          return (
            <article
              draggable
              key={item.id}
              onDragStart={() => setDraggingId(item.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingId !== null) onUpdate(moveItem(dockLayout, draggingId, item.id));
                setDraggingId(null);
              }}
            >
              <button className="dock-editor__drag" type="button" aria-label={`${definition.label} 순서 변경`}>
                <GripVertical size={15} />
              </button>
              <Icon size={17} />
              <span>{definition.label}</span>
              <label>
                <input
                  type="checkbox"
                  checked={item.visible}
                  onChange={(event) => {
                    const items = dockLayout.items.map((candidate) =>
                      candidate.id === item.id ? { ...candidate, visible: event.currentTarget.checked } : candidate,
                    );
                    onUpdate({ version: DOCK_LAYOUT_VERSION, items });
                  }}
                />
                표시
              </label>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
