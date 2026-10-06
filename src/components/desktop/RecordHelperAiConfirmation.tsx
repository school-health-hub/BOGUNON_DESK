import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateRecordHelperOutbound,
  RECORD_HELPER_AI_OUTBOUND_BYTE_LIMIT,
  RECORD_HELPER_IDENTITY_BLOCKER,
  RECORD_HELPER_SENSITIVE_BLOCKER,
} from "../../record-helper/recordHelperAiService";

export type RecordHelperAiConfirmationData = {
  readonly providerLabel: string;
  readonly reportText: string;
  readonly teacherMemo: string;
  readonly redactionCount: number;
  readonly identityHints: readonly string[];
};

export function RecordHelperAiConfirmation({ confirmation, onCancel, onConfirm }: {
  readonly confirmation: RecordHelperAiConfirmationData;
  readonly onCancel: () => void;
  readonly onConfirm: (prompt: string) => void;
}) {
  const [reportText, setReportText] = useState(confirmation.reportText);
  const [teacherMemo, setTeacherMemo] = useState(confirmation.teacherMemo);
  const sentRef = useRef(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const evaluation = useMemo(
    () => evaluateRecordHelperOutbound(reportText, teacherMemo, confirmation.identityHints),
    [confirmation.identityHints, reportText, teacherMemo],
  );
  const confirm = (): void => {
    if (sentRef.current || !evaluation.canConfirm) return;
    sentRef.current = true;
    onConfirm(evaluation.prompt);
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
      <section className="official-document-ai-confirm record-helper-ai-confirm" role="dialog" aria-modal="true" aria-labelledby="record-helper-ai-title" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); return; }
        if (event.key !== "Tab") return;
        const focusable = event.currentTarget.querySelectorAll<HTMLElement>('button, textarea, [tabindex]:not([tabindex="-1"])');
        const first = focusable.item(0); const last = focusable.item(focusable.length - 1);
        if (first === null || last === null) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
        <header><div><strong id="record-helper-ai-title">AI 전송 내용 확인</strong><span>{confirmation.providerLabel}</span></div><button ref={cancelButtonRef} type="button" aria-label="취소" onClick={onCancel}><X size={16} aria-hidden="true" /></button></header>
        <p>자동 제거된 정보 {confirmation.redactionCount}건 · 자동 탐지는 보조 기능입니다. 실제 전송본을 직접 확인해 주세요.</p>
        <label><span>비식별 활동보고서</span><textarea value={reportText} onChange={(event) => setReportText(event.currentTarget.value)} /></label>
        <label><span>비식별 교사 메모</span><textarea value={teacherMemo} onChange={(event) => setTeacherMemo(event.currentTarget.value)} /></label>
        {evaluation.identityFindings.length > 0 && <p className="record-helper-ai-confirm__blocker" role="alert">{RECORD_HELPER_IDENTITY_BLOCKER} ({evaluation.identityFindings.join(", ")})</p>}
        {evaluation.blockers.length > 0 && <p className="record-helper-ai-confirm__blocker" role="alert">{RECORD_HELPER_SENSITIVE_BLOCKER} ({evaluation.blockers.join(", ")})</p>}
        {!evaluation.isWithinSizeLimit && <p className="record-helper-ai-confirm__blocker" role="alert">전송용 편집본을 줄여 주세요. {evaluation.bytes.toLocaleString()} / {RECORD_HELPER_AI_OUTBOUND_BYTE_LIMIT.toLocaleString()} bytes</p>}
        <label><span>실제 전송될 전체 내용</span><textarea readOnly value={evaluation.prompt} /></label>
        <footer><button type="button" onClick={onCancel}>취소</button><button type="button" disabled={!evaluation.canConfirm} onClick={confirm}>확인 후 전송</button></footer>
      </section>
    </div>
  );
}
