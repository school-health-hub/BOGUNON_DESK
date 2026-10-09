import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateOfficialDocumentOutbound,
  OFFICIAL_DOCUMENT_AI_OUTBOUND_BYTE_LIMIT,
} from "../../official-document/officialDocumentAiService";

export type OfficialDocumentAiConfirmationData = {
  readonly outboundText: string;
  readonly providerLabel: string;
};

export type OfficialDocumentAiConfirmationResult = {
  readonly outboundText: string;
};

export function OfficialDocumentAiConfirmation({
  confirmation,
  onCancel,
  onConfirm,
}: {
  readonly confirmation: OfficialDocumentAiConfirmationData;
  readonly onCancel: () => void;
  readonly onConfirm: (result: OfficialDocumentAiConfirmationResult) => void;
}) {
  const [outboundText, setOutboundText] = useState(confirmation.outboundText);
  const sentRef = useRef(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const evaluation = useMemo(() => evaluateOfficialDocumentOutbound(outboundText), [outboundText]);
  const isEmpty = outboundText.trim() === "";
  const validationMessageIds = [
    isEmpty ? "official-document-ai-confirm-empty" : null,
    evaluation.findings.length > 0 ? "official-document-ai-confirm-privacy" : null,
    !evaluation.isWithinSizeLimit ? "official-document-ai-confirm-size" : null,
  ].filter((id): id is string => id !== null);
  const confirm = (): void => {
    if (sentRef.current || !evaluation.canConfirm) return;
    sentRef.current = true;
    onConfirm({ outboundText });
  };
  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => cancelButtonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      previousFocusRef.current?.focus();
    };
  }, []);
  return (
    <div className="official-document-ai-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="official-document-ai-confirm" role="dialog" aria-modal="true" aria-labelledby="official-document-ai-confirm-title" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); return; }
        if (event.key !== "Tab") return;
        const focusable = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])');
        const first = focusable.item(0);
        const last = focusable.item(focusable.length - 1);
        if (first === null || last === null) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
        <header>
          <div>
            <h3 id="official-document-ai-confirm-title">AI 전송 내용 확인</h3>
            <p>{confirmation.providerLabel} 서비스로 다음 내용이 전송됩니다.</p>
          </div>
          <button ref={cancelButtonRef} type="button" aria-label="AI 전송 취소" onClick={onCancel}><X size={17} /></button>
        </header>
        <p className="official-document-ai-confirm__warning">자동 검사는 보조 기능이며 모든 개인정보를 탐지하지 못할 수 있습니다. 내용을 직접 확인한 뒤 전송해 주세요.</p>
        <label className="official-document-ai-confirm__editor">
          <span>AI 서비스로 전송될 내용</span>
          <textarea
            aria-describedby={validationMessageIds.length > 0 ? validationMessageIds.join(" ") : undefined}
            aria-invalid={!evaluation.canConfirm}
            value={outboundText}
            onChange={(event) => setOutboundText(event.currentTarget.value)}
          />
        </label>
        {isEmpty && <p id="official-document-ai-confirm-empty" className="official-document-ai-confirm__blocker" role="alert">AI로 보낼 내용을 입력해 주세요.</p>}
        {evaluation.findings.length > 0 && <p id="official-document-ai-confirm-privacy" className="official-document-ai-confirm__blocker" role="alert">민감한 개인정보 가능성이 있습니다: {evaluation.findings.join(", ")}. 전송본에서 삭제해 주세요.</p>}
        {!evaluation.isWithinSizeLimit && <p id="official-document-ai-confirm-size" className="official-document-ai-confirm__blocker" role="alert">전송 내용을 줄여 주세요. {evaluation.bytes.toLocaleString()} / {OFFICIAL_DOCUMENT_AI_OUTBOUND_BYTE_LIMIT.toLocaleString()} bytes</p>}
        <footer>
          <button type="button" onClick={onCancel}>취소</button>
          <button className="is-primary" type="button" disabled={!evaluation.canConfirm} onClick={confirm}>확인 후 전송</button>
        </footer>
      </section>
    </div>
  );
}
