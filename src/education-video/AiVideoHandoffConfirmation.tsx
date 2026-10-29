import { useEffect, useRef } from 'react';
import { ClipboardCopy } from 'lucide-react';

type Props = {
 readonly query: string;
 readonly url: string;
 readonly openFailed: boolean;
 readonly returnFocus: HTMLButtonElement | null;
 readonly onCancel: () => void;
 readonly onOpen: () => void;
 readonly onCopy: () => void;
};

export function AiVideoHandoffConfirmation(p: Props) {
 const dialogRef = useRef<HTMLElement>(null);
 const cancelRef = useRef<HTMLButtonElement>(null);
 useEffect(() => {
  const isolated: { readonly element: Element; readonly inert: string | null }[] = [];
  let branch: Element | null = dialogRef.current;
  while (branch !== null && branch !== document.body) {
   const parent = branch.parentElement;
   if (parent === null) break;
   for (const sibling of Array.from(parent.children)) {
    if (sibling === branch) continue;
    isolated.push({ element: sibling, inert: sibling.getAttribute('inert') });
    sibling.setAttribute('inert', '');
   }
   branch = parent;
  }
  cancelRef.current?.focus();
  return () => {
   for (const { element, inert } of isolated) {
    if (inert === null) element.removeAttribute('inert');
    else element.setAttribute('inert', inert);
   }
   if (p.returnFocus?.isConnected) p.returnFocus.focus();
  };
 }, [p.returnFocus]);
 return <section ref={dialogRef} className="aiv-handoff" role="dialog" aria-modal="true" aria-label="YouTube 검색 확인" onKeyDown={event => {
  if (event.key === 'Escape') {
   event.preventDefault();
   event.stopPropagation();
   p.onCancel();
   return;
  }
  if (event.key !== 'Tab') return;
  const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
  const first = buttons.item(0);
  const last = buttons.item(buttons.length - 1);
  if (first === null || last === null) return;
  if (event.shiftKey && document.activeElement === first) {
   event.preventDefault();
   last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
   event.preventDefault();
   first.focus();
  }
 }}>
  <h2>YouTube 검색 페이지로 이동할까요?</h2>
  <p>아래 검색어가 외부 사이트 YouTube로 전달됩니다. 학생 이름·건강정보 등 개인정보가 포함되지 않았는지 확인해 주세요.</p>
  <p className="aiv-query"><strong>검색어</strong> {p.query}</p>
  <p className="aiv-handoff-url">{p.url}</p>
  {p.openFailed && <p className="aiv-warning">브라우저를 열지 못했습니다. 아래 버튼으로 검색 URL을 복사할 수 있습니다.</p>}
  <div>
   <button ref={cancelRef} type="button" onClick={p.onCancel}>취소</button>
   <button className="aiv-primary" type="button" onClick={p.onOpen}>검색 페이지 열기</button>
   {p.openFailed && <button type="button" onClick={p.onCopy}><ClipboardCopy size={16} />검색 URL 복사</button>}
  </div>
 </section>;
}
