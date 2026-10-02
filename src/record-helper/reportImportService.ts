import { invoke } from "@tauri-apps/api/core";

export type RecordHelperReportFormat = "pdf" | "hwpx" | "docx" | "hwp";

export type RecordHelperImportedReport = {
  readonly sourceName: string;
  readonly format: RecordHelperReportFormat;
  readonly text: string;
};

export type RecordHelperImportFailure = {
  readonly sourceName: string;
  readonly message: string;
};

export type RecordHelperImportBatch = {
  readonly reports: readonly RecordHelperImportedReport[];
  readonly failures: readonly RecordHelperImportFailure[];
};

type InvokeCommand = (command: string) => Promise<unknown>;

const MAX_ITEMS = 50;
const MAX_REPORT_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_BATCH_TEXT_BYTES = 20 * 1024 * 1024;
const MAX_FAILURE_MESSAGE_LENGTH = 300;
const malformedPayloadMessage = "활동보고서 파일 결과를 읽지 못했습니다.";
const textEncoder = new TextEncoder();

class RecordHelperImportPayloadError extends Error {
  readonly name = "RecordHelperImportPayloadError";

  constructor() {
    super(malformedPayloadMessage);
  }
}

const failPayload = (): never => {
  throw new RecordHelperImportPayloadError();
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const hasExactKeys = (value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean => {
  const actualKeys = Reflect.ownKeys(value);
  return actualKeys.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
};

const byteLength = (value: string): number => textEncoder.encode(value).byteLength;

const parseSourceName = (value: unknown): string => {
  if (
    typeof value !== "string"
    || value.length === 0
    || value === "."
    || value === ".."
    || value.includes("/")
    || value.includes("\\")
    || value.includes(":")
  ) {
    return failPayload();
  }
  return value;
};

const parseFormat = (value: unknown): RecordHelperReportFormat => {
  switch (value) {
    case "pdf":
    case "hwpx":
    case "docx":
    case "hwp":
      return value;
    default:
      return failPayload();
  }
};

const parseText = (value: unknown): string => {
  if (typeof value !== "string" || value.trim().length === 0 || byteLength(value) > MAX_REPORT_TEXT_BYTES) {
    return failPayload();
  }
  return value;
};

const isSafeFailureMessage = (value: string): boolean => (
  value.trim().length > 0
  && value.length <= MAX_FAILURE_MESSAGE_LENGTH
  && !value.includes("/")
  && !value.includes("\\")
  && !value.includes(":")
);

const parseFailureMessage = (value: unknown): string => {
  if (typeof value !== "string" || !isSafeFailureMessage(value)) {
    return failPayload();
  }
  return value;
};

const parseReport = (value: unknown): RecordHelperImportedReport => {
  if (!isRecord(value) || !hasExactKeys(value, ["sourceName", "format", "text"])) {
    return failPayload();
  }
  return {
    sourceName: parseSourceName(value.sourceName),
    format: parseFormat(value.format),
    text: parseText(value.text),
  };
};

const parseFailure = (value: unknown): RecordHelperImportFailure => {
  if (!isRecord(value) || !hasExactKeys(value, ["sourceName", "message"])) {
    return failPayload();
  }
  return {
    sourceName: parseSourceName(value.sourceName),
    message: parseFailureMessage(value.message),
  };
};

const parseArray = <T>(value: unknown, parseItem: (item: unknown) => T): readonly T[] => {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) {
    return failPayload();
  }
  const parsed: T[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      return failPayload();
    }
    parsed.push(parseItem(value[index]));
  }
  return parsed;
};

const normalizeImportBatch = (value: unknown): RecordHelperImportBatch | null => {
  if (!isRecord(value) || !hasExactKeys(value, ["reports", "failures"])) {
    return failPayload();
  }
  const reports = parseArray(value.reports, parseReport);
  const failures = parseArray(value.failures, parseFailure);
  if (reports.length + failures.length > MAX_ITEMS) {
    return failPayload();
  }
  if (reports.length === 0 && failures.length === 0) {
    return null;
  }
  const totalTextBytes = reports.reduce((total, report) => total + byteLength(report.text), 0);
  if (totalTextBytes > MAX_BATCH_TEXT_BYTES) {
    return failPayload();
  }
  return { reports, failures };
};

export const pickAndExtractRecordHelperReports = async (
  invokeCommand: InvokeCommand = invoke,
): Promise<RecordHelperImportBatch | null> => normalizeImportBatch(
  await invokeCommand("pick_and_extract_record_helper_reports"),
);

export const importRecordHelperReports = pickAndExtractRecordHelperReports;
