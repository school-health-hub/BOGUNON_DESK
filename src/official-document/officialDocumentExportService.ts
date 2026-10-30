import { invoke } from "@tauri-apps/api/core";
import type { OfficialDocumentDraft } from "./types";

export type OfficialDocumentExportResult =
  | { readonly status: "saved"; readonly fileName: string }
  | { readonly status: "cancelled" };

type InvokeCommand = (command: string, args?: Readonly<Record<string, unknown>>) => Promise<unknown>;

type OfficialDocumentExportErrorCode = "empty-title" | "empty-body" | "table-unsupported" | "invalid-result";

export class OfficialDocumentExportError extends Error {
  readonly code: OfficialDocumentExportErrorCode;

  constructor(code: OfficialDocumentExportErrorCode, message: string) {
    super(message);
    this.name = "OfficialDocumentExportError";
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const hasExactKeys = (value: Readonly<Record<string, unknown>>, expectedKeys: readonly string[]): boolean => {
  const keys = Object.keys(value).sort();
  return keys.length === expectedKeys.length && keys.every((key, index) => key === expectedKeys[index]);
};

const invalidResult = (): OfficialDocumentExportError => new OfficialDocumentExportError(
  "invalid-result",
  "ODT 저장 결과를 읽지 못했습니다.",
);

const parseExportResult = (value: unknown): OfficialDocumentExportResult => {
  if (!isRecord(value) || typeof value.status !== "string") throw invalidResult();

  switch (value.status) {
    case "saved": {
      const { fileName } = value;
      const hasSafeFileName = typeof fileName === "string"
        && fileName.trim().length > 0
        && !fileName.includes("/")
        && !fileName.includes("\\");
      if (!hasExactKeys(value, ["fileName", "status"]) || !hasSafeFileName) throw invalidResult();
      return { status: "saved", fileName };
    }
    case "cancelled":
      if (!hasExactKeys(value, ["status"])) throw invalidResult();
      return { status: "cancelled" };
    default:
      throw invalidResult();
  }
};

export const saveOfficialDocumentOdt = async (
  draft: OfficialDocumentDraft,
  invokeCommand: InvokeCommand = invoke,
): Promise<OfficialDocumentExportResult> => {
  if (draft.title.trim().length === 0) {
    throw new OfficialDocumentExportError("empty-title", "공문 제목을 입력해 주세요.");
  }
  if (draft.body.trim().length === 0) {
    throw new OfficialDocumentExportError("empty-body", "공문 본문을 입력해 주세요.");
  }
  if (draft.tableText?.trim()) {
    throw new OfficialDocumentExportError("table-unsupported", "표가 포함된 공문은 현재 ODT로 저장할 수 없습니다.");
  }

  return parseExportResult(await invokeCommand("save_official_document_odt", {
    request: {
      title: draft.title,
      body: draft.body,
      attachments: draft.attachments,
      hasTableText: false,
    },
  }));
};
