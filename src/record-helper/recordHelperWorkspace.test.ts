import { describe, expect, it } from "vitest";
import {
  createRecordHelperReportId,
  createRecordHelperWorkspace,
  recordHelperReportFormats,
  reduceRecordHelperWorkspace,
  type RecordHelperImportedReport,
} from "./recordHelperWorkspace";

const importedReport = (
  idValue: string,
  sourceName: string,
  extractedText: string,
): RecordHelperImportedReport => ({
  id: createRecordHelperReportId(idValue),
  sourceName,
  format: "pdf",
  extractedText,
});

describe("record helper report workspace", () => {
  it("starts with memory-only empty report state", () => {
    expect(createRecordHelperWorkspace()).toEqual({
      reports: [],
      selectedReportId: null,
      importStatus: "idle",
      importError: null,
      activeImportRequestId: null,
      latestBatchFailures: [],
    });
  });

  it("limits report formats to supported document imports", () => {
    expect(recordHelperReportFormats).toEqual(["pdf", "hwpx", "docx", "hwp"]);
  });

  it("appends successful import batches with distinct duplicate source names and selects the first new report", () => {
    const firstId = createRecordHelperReportId("memory-a");
    const secondId = createRecordHelperReportId("memory-b");
    const thirdId = createRecordHelperReportId("memory-c");
    const started = reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 1 });
    const firstBatch = reduceRecordHelperWorkspace(started, {
      type: "resolveImport",
      requestId: 1,
      reports: [
        { ...importedReport("memory-a", "same-name.pdf", "첫 번째 관찰") },
        { ...importedReport("memory-b", "same-name.pdf", "두 번째 관찰") },
      ],
      failures: [{ sourceName: "broken.pdf", error: "읽을 수 없음" }],
    });
    const secondBatch = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(firstBatch, { type: "beginImport", requestId: 2 }),
      {
        type: "resolveImport",
        requestId: 2,
        reports: [{ ...importedReport("memory-c", "later.pdf", "세 번째 관찰") }],
        failures: [],
      },
    );

    expect(firstBatch.reports.map((report) => report.id)).toEqual([firstId, secondId]);
    expect(firstBatch.reports.map((report) => report.sourceName)).toEqual(["same-name.pdf", "same-name.pdf"]);
    expect(firstBatch.selectedReportId).toBe(firstId);
    expect(firstBatch.latestBatchFailures).toEqual([{ sourceName: "broken.pdf", error: "읽을 수 없음" }]);
    expect(secondBatch.reports.map((report) => report.id)).toEqual([firstId, secondId, thirdId]);
    expect(secondBatch.selectedReportId).toBe(thirdId);
  });

  it("keeps each report metadata and memo while switching selection", () => {
    const firstId = createRecordHelperReportId("memory-a");
    const secondId = createRecordHelperReportId("memory-b");
    const imported = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 3 }),
      {
        type: "resolveImport",
        requestId: 3,
        reports: [
          importedReport("memory-a", "a.pdf", "A 관찰"),
          importedReport("memory-b", "b.pdf", "B 관찰"),
        ],
        failures: [],
      },
    );
    const editedFirst = reduceRecordHelperWorkspace(imported, {
      type: "updateReportMetadata",
      reportId: firstId,
      metadata: { studentLabel: "학생 A", classLabel: "1-1", activityLabel: "토론" },
    });
    const selectedSecond = reduceRecordHelperWorkspace(editedFirst, { type: "selectReport", reportId: secondId });
    const editedSecond = reduceRecordHelperWorkspace(selectedSecond, {
      type: "updateTeacherMemo",
      reportId: secondId,
      teacherMemo: "근거를 보강",
    });
    const switchedBack = reduceRecordHelperWorkspace(editedSecond, { type: "selectReport", reportId: firstId });

    expect(switchedBack.selectedReportId).toBe(firstId);
    expect(switchedBack.reports).toEqual([
      {
        id: firstId,
        sourceName: "a.pdf",
        format: "pdf",
        extractedText: "A 관찰",
        studentLabel: "학생 A",
        classLabel: "1-1",
        activityLabel: "토론",
        teacherMemo: "",
      },
      {
        id: secondId,
        sourceName: "b.pdf",
        format: "pdf",
        extractedText: "B 관찰",
        studentLabel: "",
        classLabel: "",
        activityLabel: "",
        teacherMemo: "근거를 보강",
      },
    ]);
  });

  it("removes the selected report by choosing the next report before the previous report", () => {
    const firstId = createRecordHelperReportId("memory-a");
    const secondId = createRecordHelperReportId("memory-b");
    const thirdId = createRecordHelperReportId("memory-c");
    const imported = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 4 }),
      {
        type: "resolveImport",
        requestId: 4,
        reports: [
          importedReport("memory-a", "a.pdf", "A"),
          importedReport("memory-b", "b.pdf", "B"),
          importedReport("memory-c", "c.pdf", "C"),
        ],
        failures: [],
      },
    );
    const selectedMiddle = reduceRecordHelperWorkspace(imported, { type: "selectReport", reportId: secondId });
    const removedMiddle = reduceRecordHelperWorkspace(selectedMiddle, { type: "removeReport", reportId: secondId });
    const removedLast = reduceRecordHelperWorkspace(removedMiddle, { type: "removeReport", reportId: thirdId });
    const removedFirst = reduceRecordHelperWorkspace(removedLast, { type: "removeReport", reportId: firstId });

    expect(removedMiddle.selectedReportId).toBe(thirdId);
    expect(removedMiddle.reports.map((report) => report.id)).toEqual([firstId, thirdId]);
    expect(removedLast.selectedReportId).toBe(firstId);
    expect(removedFirst.reports).toEqual([]);
    expect(removedFirst.selectedReportId).toBeNull();
  });

  it("ignores stale import completion after a later request or clear", () => {
    const firstStarted = reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 5 });
    const secondStarted = reduceRecordHelperWorkspace(firstStarted, { type: "beginImport", requestId: 6 });
    const staleResult = reduceRecordHelperWorkspace(secondStarted, {
      type: "resolveImport",
      requestId: 5,
      reports: [importedReport("memory-stale", "stale.pdf", "오래된 관찰")],
      failures: [],
    });
    const cleared = reduceRecordHelperWorkspace(secondStarted, { type: "clearAll" });
    const resultAfterClear = reduceRecordHelperWorkspace(cleared, {
      type: "resolveImport",
      requestId: 6,
      reports: [importedReport("memory-after-clear", "after-clear.pdf", "초기화 후 관찰")],
      failures: [],
    });

    expect(staleResult).toEqual(secondStarted);
    expect(resultAfterClear).toEqual(createRecordHelperWorkspace());
  });

  it("records current import failures and ignores stale errors", () => {
    const started = reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 7 });
    const laterStarted = reduceRecordHelperWorkspace(started, { type: "beginImport", requestId: 8 });
    const staleError = reduceRecordHelperWorkspace(laterStarted, {
      type: "failImport",
      requestId: 7,
      error: "오래된 오류",
      failures: [{ sourceName: "old.pdf", error: "오래된 실패" }],
    });
    const failed = reduceRecordHelperWorkspace(laterStarted, {
      type: "failImport",
      requestId: 8,
      error: "가져오지 못했습니다.",
      failures: [{ sourceName: "locked.pdf", error: "암호화된 파일" }],
    });

    expect(staleError).toEqual(laterStarted);
    expect(failed).toMatchObject({
      importStatus: "error",
      importError: "가져오지 못했습니다.",
      activeImportRequestId: null,
      latestBatchFailures: [{ sourceName: "locked.pdf", error: "암호화된 파일" }],
    });
  });
});
