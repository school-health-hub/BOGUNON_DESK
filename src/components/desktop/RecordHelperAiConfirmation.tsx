import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export type RecordHelperAiConfirmationData = {
  readonly prompt: string;
  readonly providerLabel: string;
};

export function RecordHelperAiConfirmation({
  confirmation,
  onCancel,
  onConfirm,
}: {
  readonly confirmation: RecordHelperAiConfirmationData;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButtonRef.current?.focus();
    return () => previousFocusRef.current?.focus();
  }, []);

  return (
    <div className="official-document-ai-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section
        className="official-document-ai-confirm record-helper-ai-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-helper-ai-confirm-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
            'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
          );
          const first = focusable.item(0);
          const last = focusable.item(focusable.length - 1);
          if (first === null || last === null) return;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <header>
          <div>
            <h3 id="record-helper-ai-confirm-title">AI 전송 내용 확인</h3>
            <p>{confirmation.providerLabel}</p>
          </div>
          <button ref={cancelButtonRef} type="button" aria-label="AI 전송 취소" onClick={onCancel}><X size={17} /></button>
        </header>
        <p className="record-helper-ai-confirm__intro">다음 내용이 ChatGPT 요금제를 사용해 전송됩니다.</p>
        <p className="official-document-ai-confirm__warning">자동 개인정보 검사는 보조 기능이며 모든 정보를 탐지하지 못할 수 있습니다. 내용을 직접 검토한 뒤 전송해 주세요.</p>
        <pre tabIndex={0} aria-label="ChatGPT 요금제로 전송될 전체 내용">{confirmation.prompt}</pre>
        <footer>
          <button type="button" onClick={onCancel}>취소</button>
          <button className="is-primary" type="button" onClick={onConfirm}>확인 후 전송</button>
        </footer>
      </section>
    </div>
  );
}
