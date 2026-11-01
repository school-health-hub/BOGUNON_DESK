import { useEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";

type Props<T> = {
  readonly ariaLabel: string;
  readonly value: T;
  readonly format: (value: T) => string;
  readonly parse: (draft: string) => T;
  readonly onCommit: (value: T) => void;
  readonly inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
};

export function PurchaseEditableInput<T>({ ariaLabel, value, format, parse, onCommit, inputMode }: Props<T>) {
  const [draft, setDraft] = useState(() => format(value));
  const editingRef = useRef(false);
  const composingRef = useRef(false);
  const initialDraftRef = useRef(draft);
  const skipNextBlurRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setDraft(format(value));
  }, [format, value]);

  const commit = () => {
    editingRef.current = false;
    skipNextBlurRef.current = false;
    onCommit(parse(draft));
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (composingRef.current || event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setDraft(initialDraftRef.current);
      editingRef.current = false;
      skipNextBlurRef.current = true;
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Tab") commit();
  };

  return <input
    aria-label={ariaLabel}
    inputMode={inputMode}
    value={draft}
    onBlur={() => {
      if (skipNextBlurRef.current) {
        skipNextBlurRef.current = false;
        return;
      }
      if (editingRef.current) commit();
    }}
    onChange={(event) => setDraft(event.target.value)}
    onCompositionEnd={() => { composingRef.current = false; }}
    onCompositionStart={() => { composingRef.current = true; }}
    onFocus={() => {
      const current = format(value);
      editingRef.current = true;
      initialDraftRef.current = current;
      skipNextBlurRef.current = false;
      setDraft(current);
    }}
    onKeyDown={handleKeyDown}
  />;
}
