import { invoke } from "@tauri-apps/api/core";

export type OfficialDocumentImportFormat = "pdf" | "hwpx" | "odt";

export type OfficialDocumentImportResult = {
  readonly sourceName: string;
  readonly format: OfficialDocumentImportFormat;
  readonly text: string;
};

type InvokeCommand = (command: string, args?: Readonly<Record<string, unknown>>) => Promise<unknown>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => (
  typeof value === "object" && value !== null
);

const normalizeImportResult = (value: unknown): OfficialDocumentImportResult | null => {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error("공문 파일 결과를 읽지 못했습니다.");
  const { sourceName, format, text } = value;
  const hasSafeBasename = typeof sourceName === "string"
    && sourceName.length > 0
    && !sourceName.includes("/")
    && !sourceName.includes("\\");
  if (
    !hasSafeBasename
    || (format !== "pdf" && format !== "hwpx" && format !== "odt")
    || typeof text !== "string"
    || text.trim().length === 0
  ) {
    throw new Error("공문 파일 결과를 읽지 못했습니다.");
  }
  return { sourceName, format, text };
};

export const pickAndExtractOfficialDocument = async (
  invokeCommand: InvokeCommand = invoke,
): Promise<OfficialDocumentImportResult | null> => normalizeImportResult(
  await invokeCommand("pick_and_extract_official_document"),
);

export const extractOfficialDocumentPath = async (path: string, invokeCommand: InvokeCommand = invoke): Promise<OfficialDocumentImportResult> => {
  const result = normalizeImportResult(await invokeCommand("extract_official_document_path", { path }));
  if (result === null) throw new Error("공문 파일 결과를 읽지 못했습니다.");
  return result;
};

export type OfficialDocumentImportWorkflowOptions = {
  readonly currentText: string;
  readonly confirmReplace: (message: string) => boolean;
  readonly pickDocument: () => Promise<OfficialDocumentImportResult | null>;
};

export const importOfficialDocumentSource = async ({
  currentText,
  confirmReplace,
  pickDocument,
}: OfficialDocumentImportWorkflowOptions): Promise<OfficialDocumentImportResult | null> => {
  if (
    currentText.trim().length > 0
    && !confirmReplace("현재 입력한 원문이 파일 내용으로 대체됩니다.\n계속할까요?")
  ) {
    return null;
  }
  return pickDocument();
};
