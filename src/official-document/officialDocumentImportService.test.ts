import { describe, expect, it, vi } from "vitest";
import {
  importOfficialDocumentSource,
  pickAndExtractOfficialDocument,
  type OfficialDocumentImportResult,
} from "./officialDocumentImportService";

const imported: OfficialDocumentImportResult = {
  sourceName: "교육청 안내.hwpx",
  format: "hwpx",
  text: "공문 원문",
};

describe("official document import service", () => {
  it("invokes the native picker and accepts basename-only results", async () => {
    const invokeCommand = vi.fn(async () => imported);
    await expect(pickAndExtractOfficialDocument(invokeCommand)).resolves.toEqual(imported);
    expect(invokeCommand).toHaveBeenCalledWith("pick_and_extract_official_document");
  });

  it("preserves a file-picker cancellation", async () => {
    await expect(pickAndExtractOfficialDocument(vi.fn(async () => null))).resolves.toBeNull();
  });

  it.each(["C:\\private\\notice.pdf", "/private/notice.pdf"])(
    "rejects a native result that exposes a path: %s",
    async (sourceName) => {
      await expect(pickAndExtractOfficialDocument(vi.fn(async () => ({
        ...imported,
        sourceName,
      })))).rejects.toThrow("공문 파일 결과를 읽지 못했습니다.");
    },
  );

  it("asks before replacing existing text and keeps it when cancelled", async () => {
    const confirmReplace = vi.fn(() => false);
    const pickDocument = vi.fn(async () => imported);
    await expect(importOfficialDocumentSource({
      currentText: "기존 원문",
      confirmReplace,
      pickDocument,
    })).resolves.toBeNull();
    expect(confirmReplace).toHaveBeenCalledWith("현재 입력한 원문이 파일 내용으로 대체됩니다.\n계속할까요?");
    expect(pickDocument).not.toHaveBeenCalled();
  });

  it("opens the picker after overwrite confirmation", async () => {
    await expect(importOfficialDocumentSource({
      currentText: "기존 원문",
      confirmReplace: vi.fn(() => true),
      pickDocument: vi.fn(async () => imported),
    })).resolves.toEqual(imported);
  });

  it("does not ask for confirmation when the source is empty", async () => {
    const confirmReplace = vi.fn(() => false);
    await expect(importOfficialDocumentSource({
      currentText: "",
      confirmReplace,
      pickDocument: vi.fn(async () => null),
    })).resolves.toBeNull();
    expect(confirmReplace).not.toHaveBeenCalled();
  });

  it("propagates parsing failures without producing replacement data", async () => {
    await expect(importOfficialDocumentSource({
      currentText: "기존 원문",
      confirmReplace: vi.fn(() => true),
      pickDocument: vi.fn(async () => { throw new Error("PDF 파일을 읽지 못했습니다."); }),
    })).rejects.toThrow("PDF 파일을 읽지 못했습니다.");
  });
});
