import { describe, expect, it, vi } from "vitest";
import { saveOfficialDocumentOdt } from "./officialDocumentExportService";
import type { OfficialDocumentDraft } from "./types";

const createDraft = (overrides: Partial<OfficialDocumentDraft> = {}): OfficialDocumentDraft => ({
  title: "합성 보건교육 운영 계획",
  body: "1. 합성 보건교육을 운영하고자 합니다.\n\n끝.",
  attachments: "붙임  합성 운영계획서 1부.  끝.",
  messenger: "합성 안내입니다.",
  checklist: "합성 확인 항목",
  ...overrides,
});

describe("official document ODT export contract", () => {
  it("uses the existing draft contract without ODT-specific fields", () => {
    // Given
    const draft: OfficialDocumentDraft = {
      title: "합성 보건교육 운영 계획",
      body: "1. 합성 보건교육을 운영하고자 합니다.\n\n끝.",
      attachments: "붙임  합성 운영계획서 1부.  끝.",
      messenger: "합성 안내입니다.",
      checklist: "합성 확인 항목",
    };

    // When
    const draftKeys = Object.keys(draft).sort();

    // Then
    expect(draftKeys).toEqual([
      "attachments",
      "body",
      "checklist",
      "messenger",
      "title",
    ]);
  });

  it("returns the saved result when the native command succeeds", async () => {
    // Given
    const invokeCommand = vi.fn().mockResolvedValue({ status: "saved", fileName: "합성 보건교육 운영 계획.odt" });

    // When
    const result = await saveOfficialDocumentOdt(createDraft(), invokeCommand);

    // Then
    expect(result).toEqual({ status: "saved", fileName: "합성 보건교육 운영 계획.odt" });
    expect(invokeCommand).toHaveBeenCalledOnce();
    expect(invokeCommand).toHaveBeenCalledWith("save_official_document_odt", {
      request: {
        title: "합성 보건교육 운영 계획",
        body: "1. 합성 보건교육을 운영하고자 합니다.\n\n끝.",
        attachments: "붙임  합성 운영계획서 1부.  끝.",
        hasTableText: false,
      },
    });
  });

  it("returns cancellation without converting it to an error", async () => {
    // Given
    const invokeCommand = vi.fn().mockResolvedValue({ status: "cancelled" });

    // When
    const result = await saveOfficialDocumentOdt(createDraft(), invokeCommand);

    // Then
    expect(result).toEqual({ status: "cancelled" });
  });

  it.each([
    null,
    {},
    { status: "saved" },
    { status: "saved", fileName: "" },
    { status: "saved", fileName: "C:\\private\\document.odt" },
    { status: "cancelled", fileName: "unexpected.odt" },
    { status: "unknown" },
  ])("rejects malformed native result %#", async (nativeResult) => {
    // Given
    const invokeCommand = vi.fn().mockResolvedValue(nativeResult);

    // When / Then
    await expect(saveOfficialDocumentOdt(createDraft(), invokeCommand)).rejects.toThrow(
      "ODT 저장 결과를 읽지 못했습니다.",
    );
  });

  it("preserves a native command error", async () => {
    // Given
    const nativeError = new Error("native save failed");
    const invokeCommand = vi.fn().mockRejectedValue(nativeError);

    // When / Then
    await expect(saveOfficialDocumentOdt(createDraft(), invokeCommand)).rejects.toBe(nativeError);
  });

  it.each([
    ["title", createDraft({ title: "   " }), "공문 제목을 입력해 주세요."],
    ["body", createDraft({ body: "\n\t" }), "공문 본문을 입력해 주세요."],
  ])("rejects an empty %s before invoking the native command", async (_field, draft, message) => {
    // Given
    const invokeCommand = vi.fn();

    // When / Then
    await expect(saveOfficialDocumentOdt(draft, invokeCommand)).rejects.toThrow(message);
    expect(invokeCommand).not.toHaveBeenCalled();
  });

  it("rejects table text before invoking the native command", async () => {
    // Given
    const invokeCommand = vi.fn();
    const draft = createDraft({ tableText: "| 항목 | 내용 |" });

    // When / Then
    await expect(saveOfficialDocumentOdt(draft, invokeCommand)).rejects.toThrow(
      "표가 포함된 공문은 현재 ODT로 저장할 수 없습니다.",
    );
    expect(invokeCommand).not.toHaveBeenCalled();
  });
});
