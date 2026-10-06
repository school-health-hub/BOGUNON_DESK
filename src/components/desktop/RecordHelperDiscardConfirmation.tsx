import { AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";

export type RecordHelperDiscardRequest =
  | { readonly kind: "close" }
  | { readonly kind: "clear" }
  | { readonly kind: "remove"; readonly reportId: string; readonly sourceName: string };

type RecordHelperDiscardCopy = {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
};

type RecordHelperDiscardConfirmationProps = {
  readonly request: RecordHelperDiscardRequest;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
};

const assertNever = (value: never): never => {
  throw new TypeError(`지원하지 않는 생기부 도우미 폐기 요청: ${String(value)}`);
};

const discardCopy = (request: RecordHelperDiscardRequest): RecordHelperDiscardCopy => {
  switch (request.kind) {
    case "close":
      return {
        title: "생기부 도우미 닫기",
        message: "생기부 도우미를 닫으면 원문, 입력한 메모와 AI 초안이 모두 사라집니다. 닫을까요?",
        confirmLabel: "닫고 비우기",
      };
    case "clear":
      return {
        title: "작업실 전체 비우기",
        message: "가져온 원문, 입력한 메모와 AI 초안이 모두 사라집니다. 전체 비울까요?",
        confirmLabel: "전체 비우기",
      };
    case "remove":
      return {
        title: "보고서 제거",
        message: `'${request.sourceName}' 보고서의 분류 정보, 교사 메모와 AI 초안이 모두 사라집니다. 제거할까요?`,
        confirmLabel: "보고서 제거",
      };
    default:
      return assertNever(request);
  }
};

export function RecordHelperDiscardConfirmation({
  request,
  onCancel,
  onConfirm,
}: RecordHelperDiscardConfirmationProps) {
  const copy = discardCopy(request);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButtonRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)");
    if (focusable === undefined || focusable.length === 0) return;
    const first = focusable.item(0);
    const last = focusable.item(focusable.length - 1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="desktop-update-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section
        ref={dialogRef}
        className="desktop-update-confirm record-helper-discard-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-helper-discard-title"
        onKeyDown={handleKeyDown}
      >
        <AlertTriangle size={22} aria-hidden="true" />
        <div>
          <h2 id="record-helper-discard-title">{copy.title}</h2>
          <p>{copy.message}</p>
        </div>
        <footer>
          <button ref={cancelButtonRef} className="is-secondary" type="button" onClick={onCancel}>취소</button>
          <button className="is-danger" type="button" onClick={onConfirm}>{copy.confirmLabel}</button>
        </footer>
      </section>
    </div>
  );
}
