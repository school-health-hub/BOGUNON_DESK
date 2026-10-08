import { describe, expect, it } from "vitest";
import {
  createRecordHelperReportId,
  createRecordHelperWorkspace,
  getRecordHelperReportNavigation,
  hasRecordHelperUserWork,
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
        aiStatus: "idle",
        aiDraft: "",
        aiError: null,
        activeAiRequestId: null,
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
        aiStatus: "idle",
        aiDraft: "",
        aiError: null,
        activeAiRequestId: null,
      },
    ]);
  });

  it("derives bounded previous and next report navigation from selection", () => {
    const imported = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 30 }),
      {
        type: "resolveImport",
        requestId: 30,
        reports: [
          importedReport("memory-a", "a.pdf", "A"),
          importedReport("memory-b", "b.pdf", "B"),
          importedReport("memory-c", "c.pdf", "C"),
        ],
        failures: [],
      },
    );
    const firstId = createRecordHelperReportId("memory-a");
    const secondId = createRecordHelperReportId("memory-b");
    const thirdId = createRecordHelperReportId("memory-c");

    expect(getRecordHelperReportNavigation(imported.reports, firstId)).toEqual({
      currentIndex: 0,
      totalCount: 3,
      previousReportId: null,
      nextReportId: secondId,
    });
    expect(getRecordHelperReportNavigation(imported.reports, secondId)).toEqual({
      currentIndex: 1,
      totalCount: 3,
      previousReportId: firstId,
      nextReportId: thirdId,
    });
    expect(getRecordHelperReportNavigation(imported.reports, thirdId)).toEqual({
      currentIndex: 2,
      totalCount: 3,
      previousReportId: secondId,
      nextReportId: null,
    });
  });

  it("requires removal confirmation only after user or AI work exists", () => {
    const imported = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 31 }),
      {
        type: "resolveImport",
        requestId: 31,
        reports: [importedReport("memory-a", "a.pdf", "A")],
        failures: [],
      },
    );
    const untouched = imported.reports[0];
    if (untouched === undefined) throw new Error("expected imported report");
    const withMetadata = { ...untouched, studentLabel: "가상 학생" };
    const withMemo = { ...untouched, teacherMemo: "합성 관찰 메모" };
    const withDraft = { ...untouched, aiStatus: "success" as const, aiDraft: "비식별 AI 초안" };

    expect(hasRecordHelperUserWork(untouched)).toBe(false);
    expect(hasRecordHelperUserWork(withMetadata)).toBe(true);
    expect(hasRecordHelperUserWork(withMemo)).toBe(true);
    expect(hasRecordHelperUserWork(withDraft)).toBe(true);
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

  it("attaches AI results by report and ignores stale or removed responses", () => {
    const reportId = createRecordHelperReportId("memory-ai");
    const imported = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 20 }),
      { type: "resolveImport", requestId: 20, reports: [importedReport("memory-ai", "a.pdf", "본문")], failures: [] },
    );
    const generating = reduceRecordHelperWorkspace(imported, { type: "beginAiRequest", reportId, requestId: 31 });
    expect(reduceRecordHelperWorkspace(generating, { type: "resolveAiRequest", reportId, requestId: 30, response: "stale" })).toBe(generating);
    const success = reduceRecordHelperWorkspace(generating, { type: "resolveAiRequest", reportId, requestId: 31, response: "초안" });
    expect(success.reports[0]).toMatchObject({ aiStatus: "success", aiDraft: "초안", activeAiRequestId: null });
    const metadata = reduceRecordHelperWorkspace(success, { type: "updateReportMetadata", reportId, metadata: { studentLabel: "가상 학생", classLabel: "1반", activityLabel: "활동" } });
    expect(metadata.reports[0]?.aiDraft).toBe("");
    const memo = reduceRecordHelperWorkspace(metadata, { type: "updateTeacherMemo", reportId, teacherMemo: "수정" });
    expect(memo.reports[0]).toMatchObject({ aiStatus: "idle", aiDraft: "", activeAiRequestId: null });
    const removed = reduceRecordHelperWorkspace(generating, { type: "removeReport", reportId });
    expect(reduceRecordHelperWorkspace(removed, { type: "resolveAiRequest", reportId, requestId: 31, response: "late" })).toBe(removed);
    expect(reduceRecordHelperWorkspace(removed, { type: "failAiRequest", reportId, requestId: 31, error: "late" })).toBe(removed);
  });

  it("invalidates AI work only when an AI-relevant input actually changes", () => {
    const reportId = createRecordHelperReportId("memory-invalidation");
    const imported = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 40 }),
      { type: "resolveImport", requestId: 40, reports: [importedReport("memory-invalidation", "input.pdf", "본문")], failures: [] },
    );
    const withMetadata = reduceRecordHelperWorkspace(imported, {
      type: "updateReportMetadata",
      reportId,
      metadata: { studentLabel: "가상 학생", classLabel: "가상 학급", activityLabel: "토론" },
    });
    const generated = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(withMetadata, { type: "beginAiRequest", reportId, requestId: 41 }),
      { type: "resolveAiRequest", reportId, requestId: 41, response: "기존 초안" },
    );

    expect(reduceRecordHelperWorkspace(generated, {
      type: "updateReportMetadata",
      reportId,
      metadata: { studentLabel: "가상 학생", classLabel: "가상 학급", activityLabel: "토론" },
    })).toBe(generated);
    expect(reduceRecordHelperWorkspace(generated, {
      type: "updateTeacherMemo",
      reportId,
      teacherMemo: "",
    })).toBe(generated);

    const activityOnly = reduceRecordHelperWorkspace(generated, {
      type: "updateReportMetadata",
      reportId,
      metadata: { studentLabel: "가상 학생", classLabel: "가상 학급", activityLabel: "발표" },
    });
    expect(activityOnly.reports[0]).toMatchObject({ aiStatus: "success", aiDraft: "기존 초안" });

    const identityChanged = reduceRecordHelperWorkspace(generated, {
      type: "updateReportMetadata",
      reportId,
      metadata: { studentLabel: "다른 가상 학생", classLabel: "가상 학급", activityLabel: "토론" },
    });
    expect(identityChanged.reports[0]).toMatchObject({ aiStatus: "idle", aiDraft: "", aiError: null, activeAiRequestId: null });
  });

  it("ignores late AI success and failure after relevant input invalidation", () => {
    const reportId = createRecordHelperReportId("memory-late-input");
    const imported = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 50 }),
      { type: "resolveImport", requestId: 50, reports: [importedReport("memory-late-input", "late.pdf", "본문")], failures: [] },
    );
    const generating = reduceRecordHelperWorkspace(imported, { type: "beginAiRequest", reportId, requestId: 51 });
    const edited = reduceRecordHelperWorkspace(generating, {
      type: "updateReportMetadata",
      reportId,
      metadata: { studentLabel: "가상 학생", classLabel: "", activityLabel: "" },
    });

    expect(reduceRecordHelperWorkspace(edited, { type: "resolveAiRequest", reportId, requestId: 51, response: "늦은 초안" })).toBe(edited);
    expect(reduceRecordHelperWorkspace(edited, { type: "failAiRequest", reportId, requestId: 51, error: "늦은 오류" })).toBe(edited);
  });

  it("preserves a previous successful draft through regeneration failure and retry", () => {
    const reportId = createRecordHelperReportId("memory-regenerate");
    const imported = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 60 }),
      { type: "resolveImport", requestId: 60, reports: [importedReport("memory-regenerate", "regenerate.pdf", "본문")], failures: [] },
    );
    const firstSuccess = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(imported, { type: "beginAiRequest", reportId, requestId: 61 }),
      { type: "resolveAiRequest", reportId, requestId: 61, response: "기존 정상 초안" },
    );
    const regenerating = reduceRecordHelperWorkspace(firstSuccess, { type: "beginAiRequest", reportId, requestId: 62 });
    expect(regenerating.reports[0]).toMatchObject({ aiStatus: "generating", aiDraft: "기존 정상 초안", activeAiRequestId: 62 });

    const failed = reduceRecordHelperWorkspace(regenerating, { type: "failAiRequest", reportId, requestId: 62, error: "일시적인 오류" });
    expect(failed.reports[0]).toMatchObject({ aiStatus: "error", aiDraft: "기존 정상 초안", aiError: "일시적인 오류", activeAiRequestId: null });

    const retrying = reduceRecordHelperWorkspace(failed, { type: "beginAiRequest", reportId, requestId: 63 });
    expect(reduceRecordHelperWorkspace(retrying, { type: "failAiRequest", reportId, requestId: 62, error: "오래된 오류" })).toBe(retrying);
    const retried = reduceRecordHelperWorkspace(retrying, { type: "resolveAiRequest", reportId, requestId: 63, response: "새 정상 초안" });
    expect(retried.reports[0]).toMatchObject({ aiStatus: "success", aiDraft: "새 정상 초안", aiError: null, activeAiRequestId: null });
  });

  it("keeps an initial failure draft empty", () => {
    const reportId = createRecordHelperReportId("memory-first-failure");
    const imported = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 70 }),
      { type: "resolveImport", requestId: 70, reports: [importedReport("memory-first-failure", "failure.pdf", "본문")], failures: [] },
    );
    const failed = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(imported, { type: "beginAiRequest", reportId, requestId: 71 }),
      { type: "failAiRequest", reportId, requestId: 71, error: "첫 생성 실패" },
    );

    expect(failed.reports[0]).toMatchObject({ aiStatus: "error", aiDraft: "", aiError: "첫 생성 실패", activeAiRequestId: null });
  });

  it("cancels only the active frontend request and ignores its late result", () => {
    const reportId = createRecordHelperReportId("memory-cancel");
    const imported = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 80 }),
      { type: "resolveImport", requestId: 80, reports: [importedReport("memory-cancel", "cancel.pdf", "본문")], failures: [] },
    );
    const generating = reduceRecordHelperWorkspace(imported, { type: "beginAiRequest", reportId, requestId: 81 });
    const cancelled = reduceRecordHelperWorkspace(generating, { type: "cancelAiRequest", reportId, requestId: 81 });

    expect(cancelled.reports[0]).toMatchObject({ aiStatus: "idle", aiDraft: "", aiError: null, activeAiRequestId: null });
    expect(reduceRecordHelperWorkspace(cancelled, { type: "resolveAiRequest", reportId, requestId: 81, response: "늦은 초안" })).toBe(cancelled);
    expect(reduceRecordHelperWorkspace(cancelled, { type: "failAiRequest", reportId, requestId: 81, error: "늦은 오류" })).toBe(cancelled);
  });

  it("returns to the preserved draft after cancelling regeneration", () => {
    const reportId = createRecordHelperReportId("memory-cancel-regenerate");
    const imported = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 90 }),
      { type: "resolveImport", requestId: 90, reports: [importedReport("memory-cancel-regenerate", "cancel-regenerate.pdf", "본문")], failures: [] },
    );
    const success = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(imported, { type: "beginAiRequest", reportId, requestId: 91 }),
      { type: "resolveAiRequest", reportId, requestId: 91, response: "보존할 초안" },
    );
    const regenerating = reduceRecordHelperWorkspace(success, { type: "beginAiRequest", reportId, requestId: 92 });
    const cancelled = reduceRecordHelperWorkspace(regenerating, { type: "cancelAiRequest", reportId, requestId: 92 });

    expect(cancelled.reports[0]).toMatchObject({ aiStatus: "success", aiDraft: "보존할 초안", aiError: null, activeAiRequestId: null });
  });

  it("ignores late AI success and failure after clearing the workspace", () => {
    const reportId = createRecordHelperReportId("memory-clear-active");
    const imported = reduceRecordHelperWorkspace(
      reduceRecordHelperWorkspace(createRecordHelperWorkspace(), { type: "beginImport", requestId: 100 }),
      { type: "resolveImport", requestId: 100, reports: [importedReport("memory-clear-active", "clear.pdf", "본문")], failures: [] },
    );
    const generating = reduceRecordHelperWorkspace(imported, { type: "beginAiRequest", reportId, requestId: 101 });
    const cleared = reduceRecordHelperWorkspace(generating, { type: "clearAll" });

    expect(reduceRecordHelperWorkspace(cleared, { type: "resolveAiRequest", reportId, requestId: 101, response: "늦은 초안" })).toBe(cleared);
    expect(reduceRecordHelperWorkspace(cleared, { type: "failAiRequest", reportId, requestId: 101, error: "늦은 오류" })).toBe(cleared);
  });
});
