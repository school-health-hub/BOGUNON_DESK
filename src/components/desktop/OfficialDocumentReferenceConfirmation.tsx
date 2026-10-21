import { useEffect, useRef } from "react";
import type { OfficialDocumentReference } from "../../official-document/referenceTypes";
import type { OfficialDocumentCreateField } from "../../official-document/types";

const fieldLabels: Readonly<Record<OfficialDocumentCreateField, string>> = {
  purpose: "문서 목적",
  workArea: "업무 분야",
  schoolYear: "학년도",
  schoolName: "학교명",
  relatedDocument: "관련 근거",
  workName: "업무명",
  target: "대상",
  dateTime: "날짜 및 시간",
  place: "장소",
  method: "방법",
  organization: "기관",
  peopleCount: "인원",
  budget: "예산",
  mainContent: "주요 내용",
  attachments: "붙임",
  notes: "특이사항",
};

export function OfficialDocumentReferenceConfirmation({
  reference,
  changedFields,
  onCancel,
  onConfirm,
}: {
  readonly reference: OfficialDocumentReference;
  readonly changedFields: readonly OfficialDocumentCreateField[];
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => cancelButtonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      previousFocusRef.current?.focus();
    };
  }, []);

  return (
    <div className="official-reference-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section
        className="official-reference-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="official-reference-confirm-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex]:not([tabindex="-1"])');
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
        <h3 id="official-reference-confirm-title">참고자료를 초안에 적용할까요?</h3>
        <p><strong>{reference.title}</strong>의 일반 문장과 형식을 사용자가 직접 편집하지 않은 항목에 반영합니다.</p>
        <div>
          <span>변경 예정 항목</span>
          <strong>{changedFields.length > 0 ? changedFields.map((field) => fieldLabels[field]).join(", ") : "변경되는 입력 항목 없음"}</strong>
        </div>
        <p>현재 직접 입력한 값은 유지됩니다. 입력 항목이 바뀌지 않아도 확인하면 이 자료의 본문 형식이 로컬 초안에 적용되며, AI 요청은 발생하지 않습니다.</p>
        <footer>
          <button ref={cancelButtonRef} type="button" onClick={onCancel}>취소</button>
          <button className="is-primary" type="button" onClick={onConfirm}>확인 후 적용</button>
        </footer>
      </section>
    </div>
  );
}
