import * as XLSX from "xlsx";

import { healthSupportImportIdentity, parseHealthSupportWorkLog } from "../domain.js";

const workLogSheetName = "근무기록";
const expectedHeaders = ["날짜", "요일", "시작시간", "종료시간", "실근무시간", "비고", "주차", "표시여부", "이번달"] as const;
const inputColumnIndexes = [0, 2, 3, 5] as const;

export type HealthSupportImportExistingLog = {
  readonly instructorId: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
};

export type HealthSupportWorkLogImportRow = {
  readonly sourceRow: number;
  readonly instructorId: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly note: string | null;
  readonly status: "ready" | "invalid" | "duplicateExisting" | "duplicateInFile";
  readonly selected: boolean;
  readonly reason?: "invalidDate" | "invalidStartTime" | "invalidEndTime" | "endTimeMustBeAfterStartTime" | "noteTooLong" | "formulaInInput";
};

export type HealthSupportWorkLogImportPreview = {
  readonly rows: readonly HealthSupportWorkLogImportRow[];
  readonly error?: "invalidHeaders" | "workLogSheetNotFound" | "unreadableWorkbook";
};

export type HealthSupportWorkLogImportInput = {
  readonly instructorId: string;
  readonly existingLogs: readonly HealthSupportImportExistingLog[];
};

export type HealthSupportWorkLogImportChoice = "skip" | "add";

export type HealthSupportWorkLogImportPlan = {
  readonly choice: HealthSupportWorkLogImportChoice;
  readonly candidates: readonly {
    readonly instructorId: string;
    readonly date: string;
    readonly startTime: string;
    readonly endTime: string;
    readonly note: string | null;
  }[];
};

function normalizeHeader(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\s📅⏰]/gu, "") : "";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function isCalendarDate(value: string): boolean {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateText(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const source = text(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source);
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  return isCalendarDate(date) ? date : null;
}

function timeText(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1) {
    const totalMinutes = Math.round(value * 1_440);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }
  const source = text(value);
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(source) ? source : null;
}

function hasFormulaInInput(sheet: XLSX.WorkSheet, sourceRow: number): boolean {
  return inputColumnIndexes.some((column) => {
    const cell = sheet["!data"]?.[sourceRow]?.[column] ?? sheet[XLSX.utils.encode_cell({ r: sourceRow, c: column })];
    return cell?.f !== undefined;
  });
}

function invalidRow(sourceRow: number, input: HealthSupportWorkLogImportInput, reason: NonNullable<HealthSupportWorkLogImportRow["reason"]>): HealthSupportWorkLogImportRow {
  return { sourceRow, instructorId: input.instructorId, date: "", startTime: "", endTime: "", note: null, status: "invalid", selected: false, reason };
}

function parsedRow(row: readonly unknown[], sourceRow: number, input: HealthSupportWorkLogImportInput, hasFormula: boolean): HealthSupportWorkLogImportRow {
  if (hasFormula) return invalidRow(sourceRow, input, "formulaInInput");
  const date = dateText(row[0]);
  if (!date) return invalidRow(sourceRow, input, "invalidDate");
  const startTime = timeText(row[2]);
  if (!startTime) return invalidRow(sourceRow, input, "invalidStartTime");
  const endTime = timeText(row[3]);
  if (!endTime) return invalidRow(sourceRow, input, "invalidEndTime");
  const noteText = text(row[5]);
  if (noteText.length > 2_000) return invalidRow(sourceRow, input, "noteTooLong");
  const parsed = parseHealthSupportWorkLog({ instructorId: input.instructorId, date, startTime, endTime });
  if (!parsed.success) return invalidRow(sourceRow, input, "endTimeMustBeAfterStartTime");
  return { sourceRow, instructorId: input.instructorId, date, startTime, endTime, note: noteText || null, status: "ready", selected: true };
}

function expectedHeaderRow(row: readonly unknown[] | undefined): boolean {
  return expectedHeaders.every((header, index) => normalizeHeader(row?.[index]) === header);
}

function isZipWorkbook(bytes: ArrayBuffer | Uint8Array): boolean {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return source[0] === 0x50 && source[1] === 0x4b;
}

export function parseHealthSupportWorkLogImport(bytes: ArrayBuffer | Uint8Array, input: HealthSupportWorkLogImportInput): HealthSupportWorkLogImportPreview {
  try {
    if (!isZipWorkbook(bytes)) return { rows: [], error: "unreadableWorkbook" };
    const workbook = XLSX.read(bytes, { type: "array", cellDates: true, dense: true, raw: true, sheetRows: 5_001 });
    if (workbook.SheetNames.length === 0) return { rows: [], error: "unreadableWorkbook" };
    const sheet = workbook.Sheets[workLogSheetName];
    if (!sheet) return { rows: [], error: "workLogSheetNotFound" };
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
    if (!expectedHeaderRow(rows[0])) return { rows: [], error: "invalidHeaders" };
    const existing = new Set(input.existingLogs.map((log) => healthSupportImportIdentity(log)));
    const seen = new Set(existing);
    return {
      rows: rows.slice(1).flatMap((row, index) => {
        if (row.every((value) => value === null || text(value) === "")) return [];
        const sourceRow = index + 2;
        const candidate = parsedRow(row, sourceRow, input, hasFormulaInInput(sheet, sourceRow - 1));
        if (candidate.status !== "ready") return [candidate];
        const identity = healthSupportImportIdentity(candidate);
        if (existing.has(identity)) return [{ ...candidate, status: "duplicateExisting", selected: false }];
        if (seen.has(identity)) return [{ ...candidate, status: "duplicateInFile", selected: false }];
        seen.add(identity);
        return [candidate];
      }),
    };
  } catch {
    return { rows: [], error: "unreadableWorkbook" };
  }
}

export function createHealthSupportWorkLogImportPlan(preview: HealthSupportWorkLogImportPreview, choice: HealthSupportWorkLogImportChoice): HealthSupportWorkLogImportPlan {
  if (choice === "skip") return { choice, candidates: [] };
  return {
    choice,
    candidates: preview.rows.filter((row) => row.status === "ready" && row.selected).map((row) => ({
      instructorId: row.instructorId,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      note: row.note,
    })),
  };
}
