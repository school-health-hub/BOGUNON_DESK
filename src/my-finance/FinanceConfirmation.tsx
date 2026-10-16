import { useEffect, useId, useRef } from "react";

export function FinanceConfirmation({ title, message, confirmLabel, busy, destructive, onCancel, onConfirm, returnFocus }: { returnFocus?: HTMLElement | null; title: string; message: string; confirmLabel: string; busy: boolean; destructive?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = returnFocus ?? document.activeElement;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <div className="finance-modal-backdrop"><div className="finance-confirmation" ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} aria-busy={busy} tabIndex={-1} onKeyDown={(e) => {
    if (e.key === "Escape" && !busy) { e.preventDefault(); onCancel(); }
    if (e.key === "Tab") { const buttons = [...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement); e.preventDefault(); (buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length] ?? dialog.current)?.focus(); }
  }}><span className="finance-eyebrow">MY FINANCE</span><h2 id={`${id}-title`}>{title}</h2><p id={`${id}-message`}>{message}</p><div><button type="button" disabled={busy} onClick={onCancel}>취소</button><button type="button" className={destructive ? "finance-danger" : "finance-primary"} disabled={busy} onClick={onConfirm}>{busy ? "처리 중…" : confirmLabel}</button></div></div></div>;
}
