import { describe, expect, it, vi } from "vitest";
import {
  importRecordHelperReports,
  pickAndExtractRecordHelperReports,
  type RecordHelperImportBatch,
} from "./reportImportService";

const importedBatch: RecordHelperImportBatch = {
  reports: [
    {
      sourceName: "활동보고서.pdf",
      format: "pdf",
      text: "동아리 활동 관찰 내용",
    },
    {
      sourceName: "프로젝트.hwpx",
      format: "hwpx",
      text: "탐구 보고서 본문",
    },
  ],
  failures: [
    {
      sourceName: "빈문서.docx",
      message: "문서에서 읽을 수 있는 본문을 찾지 못했습니다.",
    },
  ],
};

describe("record helper report import service", () => {
  it("invokes the native batch picker and accepts mixed success and failure results", async () => {
    const invokeCommand = vi.fn(async () => importedBatch);

    await expect(pickAndExtractRecordHelperReports(invokeCommand)).resolves.toEqual(importedBatch);
    expect(invokeCommand).toHaveBeenCalledWith("pick_and_extract_record_helper_reports");
  });

  it("exports the report workspace import entrypoint used by the panel", async () => {
    const invokeCommand = vi.fn(async () => importedBatch);

    await expect(importRecordHelperReports(invokeCommand)).resolves.toEqual(importedBatch);
    expect(invokeCommand).toHaveBeenCalledWith("pick_and_extract_record_helper_reports");
  });

  it("treats an empty native batch as file-picker cancellation", async () => {
    const invokeCommand = vi.fn(async () => ({ reports: [], failures: [] }));

    await expect(pickAndExtractRecordHelperReports(invokeCommand)).resolves.toBeNull();
  });

  it("keeps repeated invocations independent when a later picker run is cancelled", async () => {
    const invokeCommand = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(importedBatch)
      .mockResolvedValueOnce({ reports: [], failures: [] });

    await expect(pickAndExtractRecordHelperReports(invokeCommand)).resolves.toEqual(importedBatch);
    await expect(pickAndExtractRecordHelperReports(invokeCommand)).resolves.toBeNull();
    expect(invokeCommand).toHaveBeenCalledTimes(2);
  });

  it.each(["C:\\private\\activity.pdf", "/private/activity.pdf"])(
    "rejects a native report sourceName that exposes a path: %s",
    async (sourceName) => {
      await expect(pickAndExtractRecordHelperReports(vi.fn(async () => ({
        reports: [{ sourceName, format: "pdf", text: "본문" }],
        failures: [],
      })))).rejects.toThrow("활동보고서 파일 결과를 읽지 못했습니다.");
    },
  );

  it("rejects native failure payloads that expose paths or path-like messages", async () => {
    await expect(pickAndExtractRecordHelperReports(vi.fn(async () => ({
      reports: [],
      failures: [{ sourceName: "C:\\private\\빈문서.docx", message: "문서에서 읽을 수 있는 본문을 찾지 못했습니다." }],
    })))).rejects.toThrow("활동보고서 파일 결과를 읽지 못했습니다.");

    await expect(pickAndExtractRecordHelperReports(vi.fn(async () => ({
      reports: [],
      failures: [{ sourceName: "빈문서.docx", message: "C:\\private\\빈문서.docx 파일을 읽지 못했습니다." }],
    })))).rejects.toThrow("활동보고서 파일 결과를 읽지 못했습니다.");
  });

  it("rejects unknown fields so native-only metadata cannot cross the boundary", async () => {
    await expect(pickAndExtractRecordHelperReports(vi.fn(async () => ({
      reports: [{ sourceName: "활동보고서.pdf", format: "pdf", text: "본문", sourceIndex: 0 }],
      failures: [],
    })))).rejects.toThrow("활동보고서 파일 결과를 읽지 못했습니다.");
  });

  it("rejects sparse report and failure arrays with missing indexes", async () => {
    const sparseReports: unknown[] = [];
    sparseReports[1] = { sourceName: "활동보고서.pdf", format: "pdf", text: "본문" };
    await expect(pickAndExtractRecordHelperReports(vi.fn(async () => ({
      reports: sparseReports,
      failures: [],
    })))).rejects.toThrow("활동보고서 파일 결과를 읽지 못했습니다.");

    const sparseFailures: unknown[] = [];
    sparseFailures[1] = { sourceName: "빈문서.docx", message: "문서에서 읽을 수 있는 본문을 찾지 못했습니다." };
    await expect(pickAndExtractRecordHelperReports(vi.fn(async () => ({
      reports: [],
      failures: sparseFailures,
    })))).rejects.toThrow("활동보고서 파일 결과를 읽지 못했습니다.");
  });

  it("rejects unsupported formats and blank extracted text", async () => {
    await expect(pickAndExtractRecordHelperReports(vi.fn(async () => ({
      reports: [{ sourceName: "활동보고서.txt", format: "txt", text: "본문" }],
      failures: [],
    })))).rejects.toThrow("활동보고서 파일 결과를 읽지 못했습니다.");

    await expect(pickAndExtractRecordHelperReports(vi.fn(async () => ({
      reports: [{ sourceName: "활동보고서.hwp", format: "hwp", text: "   " }],
      failures: [],
    })))).rejects.toThrow("활동보고서 파일 결과를 읽지 못했습니다.");
  });

  it("rejects oversized arrays and extracted text payloads", async () => {
    const tooManyReports = Array.from({ length: 51 }, (_, index) => ({
      sourceName: `활동보고서-${index}.pdf`,
      format: "pdf",
      text: "본문",
    }));
    await expect(pickAndExtractRecordHelperReports(vi.fn(async () => ({
      reports: tooManyReports,
      failures: [],
    })))).rejects.toThrow("활동보고서 파일 결과를 읽지 못했습니다.");

    await expect(pickAndExtractRecordHelperReports(vi.fn(async () => ({
      reports: [{ sourceName: "활동보고서.pdf", format: "pdf", text: "a".repeat((2 * 1024 * 1024) + 1) }],
      failures: [],
    })))).rejects.toThrow("활동보고서 파일 결과를 읽지 못했습니다.");

    const aggregateTooLargeReports = Array.from({ length: 21 }, (_, index) => ({
      sourceName: `활동보고서-${index}.pdf`,
      format: "pdf",
      text: "a".repeat(1024 * 1024),
    }));
    await expect(pickAndExtractRecordHelperReports(vi.fn(async () => ({
      reports: aggregateTooLargeReports,
      failures: [],
    })))).rejects.toThrow("활동보고서 파일 결과를 읽지 못했습니다.");
  });
});
