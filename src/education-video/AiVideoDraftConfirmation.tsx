import { useEffect, useRef } from 'react';
export function AiVideoDraftConfirmation({ onCancel, onConfirm }: { readonly onCancel: () => void; readonly onConfirm: () => void }) {
 const cancel = useRef<HTMLButtonElement>(null);
 useEffect(() => {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  cancel.current?.focus();
  return () => { previous?.focus(); };
 }, []);
 return <div className="official-document-ai-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}><section className="aiv-confirm" role="dialog" aria-modal="true" aria-labelledby="aiv-replace-title" onKeyDown={event => {
  if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
  if (event.key !== 'Tab') return;
  const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
  const first = controls.item(0); const last = controls.item(controls.length - 1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
 }}><h2 id="aiv-replace-title">기존 기안 초안을 바꿀까요?</h2><p>공문 작업실의 새 공문 입력과 초안을 선택한 교육영상으로 바꿉니다. 기존 새 공문 내용은 되돌릴 수 없습니다.</p><button ref={cancel} type="button" onClick={onCancel}>기존 초안 유지</button><button type="button" onClick={onConfirm}>영상으로 새 초안 작성</button></section></div>;
}
