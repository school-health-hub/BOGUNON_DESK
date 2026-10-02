import { X } from "lucide-react";

export function OfficialDocumentAiConfirmation({
  confirmation,
  onCancel,
  onConfirm,
}: {
  readonly confirmation: { readonly prompt: string; readonly providerLabel: string };
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <div className="official-document-ai-confirm-backdrop">
      <section className="official-document-ai-confirm" role="dialog" aria-modal="true" aria-labelledby="official-document-ai-confirm-title">
        <header>
          <div>
            <h3 id="official-document-ai-confirm-title">AI 전송 내용 확인</h3>
            <p>{confirmation.providerLabel} 서비스로 다음 내용이 전송됩니다.</p>
          </div>
          <button type="button" aria-label="AI 전송 취소" onClick={onCancel}><X size={17} /></button>
        </header>
        <p className="official-document-ai-confirm__warning">자동 검사는 보조 기능이며 모든 개인정보를 탐지하지 못할 수 있습니다. 내용을 직접 확인한 뒤 전송해 주세요.</p>
        <pre tabIndex={0} aria-label="AI 서비스로 전송될 내용">{confirmation.prompt}</pre>
        <footer>
          <button type="button" onClick={onCancel}>취소</button>
          <button className="is-primary" type="button" onClick={onConfirm}>확인 후 전송</button>
        </footer>
      </section>
    </div>
  );
}
