import { describe, expect, it } from "vitest";
import { createOfficialDocumentSession, reduceOfficialDocumentSession } from "./officialDocumentSession";

describe("official document reference session", () => {
  it("initializes and applies reference state without losing manual field provenance", () => {
    const initial = createOfficialDocumentSession();
    const edited = reduceOfficialDocumentSession(initial, {
      type: "updateCreate",
      field: "schoolName",
      value: "합성 늘봄학교",
    });
    const reference = {
      id: "reference-1",
      sourceNo: "1",
      enabled: true,
      purposeLabel: "안내",
      workAreaLabel: "보건",
      title: "합성 참고문서",
      description: "합성 설명",
      templateBody: "합성 본문",
      attachmentExample: "붙임 1",
      messengerExample: "합성 알림",
      checklist: "합성 점검",
      sourceUrl: "https://example.test/reference",
      documentId: "document-1",
      fileType: "hwpx",
      dataKind: "synthetic",
      tableCopyText: "합성 표",
      tableCopyGuide: "합성 표 안내",
      visibility: "private",
      deidentified: true,
      state: "active",
      priority: "normal",
    };
    const selected = reduceOfficialDocumentSession(edited, { type: "selectReference", reference });
    const appliedInput = { ...selected.createInput, mainContent: reference.templateBody };
    const applied = reduceOfficialDocumentSession(selected, { type: "applyReference", reference, input: appliedInput });

    expect(initial.touchedCreateFields).toEqual([]);
    expect(edited.touchedCreateFields).toEqual(["schoolName"]);
    expect(selected.selectedReference).toEqual(reference);
    expect(applied.createInput).toEqual(appliedInput);
    expect(applied.appliedReference).toEqual(reference);
    expect(applied.touchedCreateFields).toEqual(["schoolName"]);
  });
});
