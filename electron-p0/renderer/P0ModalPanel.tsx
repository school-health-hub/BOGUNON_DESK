import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type P0ModalPanelProps = {
  readonly children: ReactNode;
  readonly label: string;
  readonly onClose: () => void;
  readonly shouldRestoreFocus?: () => boolean;
};

export function P0ModalPanel({ children, label, onClose, shouldRestoreFocus = () => true }: P0ModalPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const invokerRef = useRef<HTMLElement | null>(null);
  const shouldRestoreFocusRef = useRef(shouldRestoreFocus);
  shouldRestoreFocusRef.current = shouldRestoreFocus;

  useLayoutEffect(() => {
    invokerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
  }, []);

  useEffect(() => () => {
    if (shouldRestoreFocusRef.current() && invokerRef.current?.isConnected) invokerRef.current.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return <div className="desktop-panel-backdrop"><section ref={panelRef} className="desktop-panel p0-panel" role="dialog" aria-label={label} aria-modal="true" tabIndex={-1} onKeyDown={handleKeyDown}>{children}</section></div>;
}

export function P0LegacyPanel({ children, label }: Pick<P0ModalPanelProps, 'children' | 'label'>) {
  return <div className="desktop-panel-backdrop"><section className="desktop-panel p0-panel" role="dialog" aria-label={label}>{children}</section></div>;
}
