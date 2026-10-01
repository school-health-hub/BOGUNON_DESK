import { Download } from "lucide-react";
import { useEffect, useRef } from "react";

type DesktopUpdateConfirmationDialogProps = {
  readonly version: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
};

export function DesktopUpdateConfirmationDialog(props: DesktopUpdateConfirmationDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(props.onCancel);
  onCancelRef.current = props.onCancel;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButtonRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancelRef.current();
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
    <div className="desktop-update-confirm-backdrop">
      <section ref={dialogRef} className="desktop-update-confirm" role="dialog" aria-modal="true" aria-labelledby="desktop-update-confirm-title" onKeyDown={handleKeyDown}>
        <Download size={22} />
        <div>
          <h2 id="desktop-update-confirm-title">BOGUNON DESK {props.version} 업데이트</h2>
          <p>업데이트를 설치하면 BOGUNON DESK가 종료됩니다.</p>
          <p>빠른 메모와 현재 공문·품의 작업, 입력 중인 AI API Key는 저장되지 않을 수 있습니다. 필요한 내용을 먼저 저장한 뒤 계속해 주세요.</p>
        </div>
        <footer>
          <button ref={cancelButtonRef} className="is-secondary" type="button" onClick={props.onCancel}>취소</button>
          <button type="button" onClick={props.onConfirm}>업데이트 계속</button>
        </footer>
      </section>
    </div>
  );
}
