import type { RecordHelperReportFormat } from "../../../record-helper/recordHelperWorkspace";

const assertNever = (value: never): never => {
  throw new TypeError(`지원하지 않는 생기부 파일 형식: ${String(value)}`);
};

export const getRecordHelperFormatLabel = (format: RecordHelperReportFormat): string => {
  switch (format) {
    case "pdf":
      return "PDF";
    case "hwpx":
      return "HWPX";
    case "docx":
      return "DOCX";
    case "hwp":
      return "HWP";
    default:
      return assertNever(format);
  }
};

export function RecordHelperFormatBadge({ format }: { readonly format: RecordHelperReportFormat }) {
  return <span className="record-helper-format-badge">{getRecordHelperFormatLabel(format)}</span>;
}
