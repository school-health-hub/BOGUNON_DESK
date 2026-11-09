import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type DragEvent as ReactDragEvent } from "react";
import type { EventCallback, Layout } from "react-grid-layout";

type GestureKind = "drag" | "resize";
type Gesture = {
  readonly kind: GestureKind;
  readonly element: HTMLElement;
  readonly widget: string;
  readonly startedAt: number;
};

const editControl = ".widget-frame__drag, .react-resizable-handle";
const escapeOwner = "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='dialog']";

/** RGL owns live geometry. Only an accepted stop can publish it to the dashboard. */
export function useDashboardGridGesture(enabled: boolean, commit: (layout: Layout) => void) {
  const [generation, setGeneration] = useState(0);
  const currentGeneration = useRef(0);
  const listening = useRef(false);
  const gesture = useRef<Gesture | null>(null);
  const pointer = useRef<number | null>(null);
  const completedEvents = useRef(new WeakSet<Event>());

  const cancel = useCallback(() => {
    if (!gesture.current && pointer.current === null) return;
    gesture.current = null;
    pointer.current = null;
    // Remount RGL to discard its placeholder and remove its document listeners.
    setGeneration(++currentGeneration.current);
  }, []);

  useLayoutEffect(() => {
    if (!enabled) {
      cancel();
      return;
    }
    listening.current = true;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      if (!gesture.current && pointer.current === null) return;
      if (event.target instanceof Element && event.target.closest(escapeOwner)) return;
      if (document.activeElement?.closest(escapeOwner) || document.querySelector("[role='dialog'][aria-modal='true']")) return;
      event.preventDefault();
      cancel();
    };
    const pointerCancel = (event: PointerEvent) => {
      if (pointer.current === null || pointer.current === event.pointerId) cancel();
    };
    const pointerUp = (event: PointerEvent) => {
      if (!gesture.current && pointer.current === event.pointerId) pointer.current = null;
    };
    const touchCancel = () => { if (pointer.current === null) cancel(); };
    window.addEventListener("keydown", escape);
    window.addEventListener("pointercancel", pointerCancel, true);
    window.addEventListener("pointerup", pointerUp, true);
    window.addEventListener("touchcancel", touchCancel, true);
    window.addEventListener("blur", cancel);
    return () => {
      listening.current = false;
      window.removeEventListener("keydown", escape);
      window.removeEventListener("pointercancel", pointerCancel, true);
      window.removeEventListener("pointerup", pointerUp, true);
      window.removeEventListener("touchcancel", touchCancel, true);
      window.removeEventListener("blur", cancel);
    };
  }, [enabled, cancel]);

  const isCurrent = () => listening.current && generation === currentGeneration.current;
  const onPointerDownCapture = (event: ReactPointerEvent) => {
    if (isCurrent() && event.isPrimary && event.button === 0 && !gesture.current &&
        event.target instanceof Element && event.target.closest(editControl)) {
      pointer.current = event.pointerId;
    }
  };
  const onDragStartCapture = (event: ReactDragEvent) => {
    if (isCurrent() && event.target instanceof Element && event.target.closest(editControl)) event.preventDefault();
  };
  const start = (kind: GestureKind): EventCallback => (_layout, oldItem, _item, _placeholder, event, element) => {
    if (!isCurrent() || gesture.current || !oldItem || !element) return;
    gesture.current = { kind, element, widget: oldItem.i, startedAt: event.timeStamp };
  };
  const stop = (kind: GestureKind): EventCallback => (layout, oldItem, _item, _placeholder, event, element) => {
    const active = gesture.current;
    if (!isCurrent() || !active || active.kind !== kind || active.element !== element || active.widget !== oldItem?.i) return;
    if (event.timeStamp < active.startedAt || completedEvents.current.has(event)) return;
    if ("pointerId" in event && pointer.current !== null && event.pointerId !== pointer.current) return;
    const released = event.type === "mouseup" || event.type === "touchend" || event.type === "pointerup";
    if (!released || ("button" in event && event.button !== 0)) {
      cancel();
      return;
    }
    gesture.current = null;
    pointer.current = null;
    completedEvents.current.add(event);
    commit(layout);
  };

  return { generation, onPointerDownCapture, onDragStartCapture, onDragStart: start("drag"), onDragStop: stop("drag"), onResizeStart: start("resize"), onResizeStop: stop("resize") };
}
