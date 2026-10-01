import { FileUp } from "lucide-react";
import type { ChangeEventHandler } from "react";

type OfficialDocumentSourceFieldProps = {
  readonly id: string;
  readonly isImporting: boolean;
  readonly onChange: ChangeEventHandler<HTMLTextAreaElement>;
  readonly onImport: () => void;
  readonly placeholder: string;
  readonly rows: number;
  readonly sourceName: string | null;
  readonly value: string;
};

const formatLabel = (sourceName: string): string => (
  sourceName.toLocaleLowerCase().endsWith(".hwpx") ? "HWPX" : "PDF"
);

export function OfficialDocumentSourceField({
  id,
  isImporting,
  onChange,
  onImport,
  placeholder,
  rows,
  sourceName,
  value,
}: OfficialDocumentSourceFieldProps) {
  return (
    <div className="official-document-source-field">
      <div className="official-document-source-field__header">
        <label htmlFor={id}>공문 원문</label>
        <button type="button" disabled={isImporting} onClick={onImport}>
          <FileUp size={14} /> {isImporting ? "가져오는 중…" : "PDF/HWPX 가져오기"}
        </button>
      </div>
      {sourceName !== null && (
        <p className="official-document-source-field__source">
          <strong>{formatLabel(sourceName)}</strong><span aria-hidden="true">·</span><span title={sourceName}>{sourceName}</span>
        </p>
      )}
      <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={onChange} />
    </div>
  );
}
