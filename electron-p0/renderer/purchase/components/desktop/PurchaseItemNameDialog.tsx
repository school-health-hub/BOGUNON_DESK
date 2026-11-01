import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

type Props = {
  readonly itemName: string;
  readonly rowNumber: number;
  readonly onCancel: () => void;
  readonly onSave: (name: string) => void;
};

export function PurchaseItemNameDialog({ itemName, rowNumber, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState(itemName);
  const composingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const save = () => onSave(draft);
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (composingRef.current || event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      save();
      return;
    }
    if (event.key !== "Tab") return;
    if (event.shiftKey && event.target === textareaRef.current) {
      event.preventDefault();
      saveRef.current?.focus();
    } else if (!event.shiftKey && event.target === saveRef.current) {
      event.preventDefault();
      textareaRef.current?.focus();
    }
  };

  return <div className="purchase-name-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onCancel(); }}>
    <section className="purchase-name-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-name-dialog-title" onKeyDown={handleKeyDown}>
      <header>
        <div><h3 id="purchase-name-dialog-title">품목명 전체 보기 및 수정</h3><p>{rowNumber}행 품목의 전체 이름을 확인하고 수정합니다.</p></div>
        <button type="button" aria-label="품목명 편집 취소" onClick={onCancel}><X size={17} /></button>
      </header>
      <label htmlFor="purchase-name-dialog-input">전체 품목명</label>
      <textarea
        id="purchase-name-dialog-input"
        ref={textareaRef}
        aria-label={`${rowNumber}행 전체 품목명`}
        rows={6}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onCompositionEnd={() => { composingRef.current = false; }}
        onCompositionStart={() => { composingRef.current = true; }}
      />
      <small>일반 Enter는 줄바꿈, Ctrl+Enter는 저장입니다.</small>
      <footer><button type="button" onClick={onCancel}>취소</button><button ref={saveRef} type="button" onClick={save}>품목명 저장</button></footer>
    </section>
  </div>;
}
