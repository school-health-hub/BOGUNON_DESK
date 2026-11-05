import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  createHealthSupportWorkLogImportPlan,
  parseHealthSupportWorkLogImport,
} from "./work-log-import.js";

const headers = ["📅 날짜", "요일", "시작시간", "종료시간", "⏰실근무시간", "비고", "주차", "표시여부", "이번달"];

function workbookBytes(rows: readonly (readonly unknown[])[], formulaCell?: { readonly row: number; readonly column: number }): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const sheetRows: unknown[][] = [Array.from(headers), ...rows.map((row) => Array.from(row))];
  const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
  if (formulaCell) sheet[XLSX.utils.encode_cell({ r: formulaCell.row, c: formulaCell.column })] = { t: "n", f: "1+1", v: 2 };
  XLSX.utils.book_append_sheet(workbook, sheet, "근무기록");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

describe("health support work-log import", () => {
  it("parses only source date, start, end, and note from valid rows", () => {
    // Given: a synthetic work-log workbook with derived columns containing misleading values
    const bytes = workbookBytes([["2026-08-18", "화요일", "09:30", "12:00", "=1/0", "교육 지원", "derived", "hidden", true]]);

    // When: the workbook is read into an import preview
    const result = parseHealthSupportWorkLogImport(bytes, { instructorId: "instructor-a", existingLogs: [] });

    // Then: the preview uses only user-entered source fields
    expect(result.rows).toEqual([expect.objectContaining({ sourceRow: 2, date: "2026-08-18", startTime: "09:30", endTime: "12:00", note: "교육 지원", status: "ready" })]);
  });

  it("reports a non-positive time span without making it selectable", () => {
    // Given: an end time that is not after its start time
    const bytes = workbookBytes([["2026-08-18", "화요일", "12:00", "12:00", 0, null]]);

    // When: the workbook is parsed
    const result = parseHealthSupportWorkLogImport(bytes, { instructorId: "instructor-a", existingLogs: [] });

    // Then: the exact invalid reason is visible and the row is excluded
    expect(result.rows[0]).toMatchObject({ status: "invalid", reason: "endTimeMustBeAfterStartTime", selected: false });
  });

  it("rejects a formula in a source input cell without evaluating it", () => {
    // Given: a formula placed in the date input cell of a synthetic workbook
    const bytes = workbookBytes([["2026-08-18", "화요일", "09:30", "12:00", 2.5, null]], { row: 1, column: 0 });

    // When: the workbook is parsed for preview
    const result = parseHealthSupportWorkLogImport(bytes, { instructorId: "instructor-a", existingLogs: [] });

    // Then: the row is non-selectable and reports the formula boundary reason
    expect(result.rows[0]).toMatchObject({ status: "invalid", reason: "formulaInInput", selected: false });
  });

  it.each([
    ["2026-02-30", "09:30", "12:00", "invalidDate"],
    ["2026-08-18x", "09:30", "12:00", "invalidDate"],
    ["2026-08-18", "9:30", "12:00", "invalidStartTime"],
    ["2026-08-18", "09:30", "24:00", "invalidEndTime"],
  ] as const)("reports %s input as %s", (date, startTime, endTime, reason) => {
    // Given: one malformed source input field
    const bytes = workbookBytes([[date, "화요일", startTime, endTime, 2.5, null]]);

    // When: the worksheet row enters the import boundary
    const result = parseHealthSupportWorkLogImport(bytes, { instructorId: "instructor-a", existingLogs: [] });

    // Then: the exact invalid reason is reported without a persistence candidate
    expect(result.rows[0]).toMatchObject({ status: "invalid", reason, selected: false });
  });

  it("rejects a worksheet whose expected work-log headers are absent", () => {
    // Given: a workbook with an unrelated worksheet header
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["날짜", "시작", "종료", "메모"]]), "근무기록");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

    // When: the workbook is parsed
    const result = parseHealthSupportWorkLogImport(bytes, { instructorId: "instructor-a", existingLogs: [] });

    // Then: it produces a deterministic header error instead of guessing columns
    expect(result).toEqual({ rows: [], error: "invalidHeaders" });
  });

  it("returns a non-persistent error preview for malformed workbook bytes", () => {
    // Given: bytes that are not a workbook
    const bytes = new TextEncoder().encode("not an xlsx workbook");

    // When: the bytes cross the workbook parsing boundary
    const result = parseHealthSupportWorkLogImport(bytes, { instructorId: "instructor-a", existingLogs: [] });

    // Then: parsing safely reports an unreadable preview instead of throwing or saving
    expect(result).toEqual({ rows: [], error: "unreadableWorkbook" });
  });

  it("classifies an identity already in storage as an existing duplicate", () => {
    // Given: a workbook row already present for the same instructor and schedule identity
    const bytes = workbookBytes([["2026-08-18", "화요일", "09:30", "12:00", 2.5, null]]);

    // When: existing logs are supplied to the preview
    const result = parseHealthSupportWorkLogImport(bytes, { instructorId: "instructor-a", existingLogs: [{ instructorId: "instructor-a", date: "2026-08-18", startTime: "09:30", endTime: "12:00" }] });

    // Then: the row is a non-selectable existing duplicate
    expect(result.rows[0]).toMatchObject({ status: "duplicateExisting", selected: false });
  });

  it("classifies a repeated upload row as an in-file duplicate", () => {
    // Given: two equivalent source rows in one upload
    const bytes = workbookBytes([
      ["2026-08-18", "화요일", "09:30", "12:00", 2.5, null],
      ["2026-08-18", "화요일", "09:30", "12:00", 2.5, "duplicate"],
    ]);

    // When: the workbook is parsed
    const result = parseHealthSupportWorkLogImport(bytes, { instructorId: "instructor-a", existingLogs: [] });

    // Then: only the first matching candidate remains selectable
    expect(result.rows.map((row) => row.status)).toEqual(["ready", "duplicateInFile"]);
  });

  it("plans no candidates when the user explicitly skips import", () => {
    // Given: a ready preview row
    const preview = parseHealthSupportWorkLogImport(workbookBytes([["2026-08-18", "화요일", "09:30", "12:00", 2.5, "교육 지원"]]), { instructorId: "instructor-a", existingLogs: [] });

    // When: the user chooses skip
    const plan = createHealthSupportWorkLogImportPlan(preview, "skip");

    // Then: the pure planner returns no persistence candidates
    expect(plan).toEqual({ choice: "skip", candidates: [] });
  });

  it("plans ready candidates only when the user explicitly chooses add", () => {
    // Given: a preview containing one ready row and one duplicate
    const preview = parseHealthSupportWorkLogImport(workbookBytes([
      ["2026-08-18", "화요일", "09:30", "12:00", 2.5, "교육 지원"],
      ["2026-08-18", "화요일", "09:30", "12:00", 2.5, "중복"],
    ]), { instructorId: "instructor-a", existingLogs: [] });

    // When: the user explicitly chooses add
    const plan = createHealthSupportWorkLogImportPlan(preview, "add");

    // Then: it returns only the safe candidate and performs no save
    expect(plan).toEqual({ choice: "add", candidates: [{ instructorId: "instructor-a", date: "2026-08-18", startTime: "09:30", endTime: "12:00", note: "교육 지원" }] });
  });

  it("drives the public parser with a synthetic workbook stream without exposing source data", () => {
    // Given: a generated stream containing a ready row, an invalid row, and an existing duplicate
    const preview = parseHealthSupportWorkLogImport(workbookBytes([
      ["2026-08-18", "화요일", "09:30", "12:00", 2.5, "safe"],
      ["2026-08-19", "수요일", "12:00", "09:30", -3, "invalid"],
      ["2026-08-20", "목요일", "09:30", "12:00", 2.5, "duplicate"],
    ]), { instructorId: "instructor-a", existingLogs: [{ instructorId: "instructor-a", date: "2026-08-20", startTime: "09:30", endTime: "12:00" }] });

    // When: the public parser is driven directly with the generated stream
    const summary = preview.rows.reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.reason ?? row.status]: (counts[row.reason ?? row.status] ?? 0) + 1 }), {});
    console.info(JSON.stringify({ rowCount: preview.rows.length, statuses: summary }));

    // Then: its visible surface is counts and status reasons only
    expect(summary).toEqual({ ready: 1, endTimeMustBeAfterStartTime: 1, duplicateExisting: 1 });
  });
});
