import { describe, expect, it } from "vitest";
import { createEmptyOfficialDocumentInput, generateOfficialDocumentDraft } from "./documentGenerator";
import { buildCreatePrompt } from "./promptBuilder";
import { applyOfficialDocumentReference, createReferenceDraftSeed } from "./referenceMapper";
import { syntheticOfficialDocumentReferences } from "./referenceRepository";

describe("official document reference composition", () => {
  it("keeps user-confirmed facts and applies only reusable reference content", () => {
    const reference = syntheticOfficialDocumentReferences[0];
    if (reference === undefined) throw new Error("synthetic reference expected");
    const current = {
      ...createEmptyOfficialDocumentInput(),
      schoolYear: "2027학년도",
      schoolName: "사용자 입력 학교",
      relatedDocument: "사용자 확인 공문-1",
      target: "사용자 확인 대상",
      dateTime: "2027. 4. 1.",
    };

    const applied = applyOfficialDocumentReference(current, reference, ["purpose", "workArea", "schoolYear", "schoolName", "relatedDocument", "target", "dateTime"]);

    expect(applied.input).toMatchObject({
      schoolYear: "2027학년도",
      schoolName: "사용자 입력 학교",
      relatedDocument: "사용자 확인 공문-1",
      target: "사용자 확인 대상",
      dateTime: "2027. 4. 1.",
    });
    expect(applied.input.mainContent).toBe("");
    expect(applied.input.purpose).toBe(current.purpose);
    expect(applied.input.workArea).toBe(current.workArea);
    expect(applied.changedFields).not.toContain("mainContent");
    const draft = generateOfficialDocumentDraft(applied.input, createReferenceDraftSeed(reference));
    expect(draft.body).toContain("1. 관련: 사용자 확인 공문-1");
    expect(draft.body).toContain("가. 대상: 사용자 확인 대상");
    expect(draft.body).toContain("나. 일시: 2027. 4. 1.");
    expect(draft.body).not.toContain("[참고자료 형식]");
    expect(draft.messenger).toContain(`${applied.input.workName} 관련 안내드립니다.`);
    expect(draft.messenger).not.toContain("[업무명]");
  });

  it("replaces previous reference defaults while preserving later user edits", () => {
    const first = syntheticOfficialDocumentReferences[0];
    const second = syntheticOfficialDocumentReferences[1];
    if (first === undefined || second === undefined) throw new Error("synthetic references expected");
    const firstApplied = applyOfficialDocumentReference(createEmptyOfficialDocumentInput(), first);
    const secondApplied = applyOfficialDocumentReference(firstApplied.input, second);
    expect(secondApplied.input.workName).toBe(second.title);
    expect(secondApplied.input.attachments).toBe(second.attachmentExample);

    const userEdited = { ...firstApplied.input, workName: "사용자 확정 업무" };
    expect(applyOfficialDocumentReference(userEdited, second, ["workName"]).input.workName).toBe("사용자 확정 업무");
  });

  it("preserves the legacy generator when no reference is supplied", () => {
    const input = { ...createEmptyOfficialDocumentInput(), workName: "합성 업무" };
    expect(generateOfficialDocumentDraft(input)).toEqual(generateOfficialDocumentDraft(input, null));
  });

  it("uses reference attachments, messenger, checklist, and table text without changing the draft contract", () => {
    const reference = syntheticOfficialDocumentReferences.find((candidate) => candidate.dataKind === "표포함");
    if (reference === undefined) throw new Error("table reference expected");
    const input = applyOfficialDocumentReference(createEmptyOfficialDocumentInput(), reference).input;
    const draft = generateOfficialDocumentDraft(input, createReferenceDraftSeed(reference));

    expect(draft.attachments).toContain("합성 결과 집계표");
    expect(draft.messenger).toContain("[입력 필요]");
    expect(draft.checklist).toContain("개인정보 포함 여부 확인");
    expect(draft.tableText).toContain("구분\t인원");
  });

  it("separates reference examples from user-confirmed information in the AI prompt", () => {
    const reference = syntheticOfficialDocumentReferences[0];
    if (reference === undefined) throw new Error("synthetic reference expected");
    const prompt = buildCreatePrompt(
      { ...createEmptyOfficialDocumentInput(), workName: "사용자 확정 업무" },
      reference,
    );

    expect(prompt).toContain("[참고자료 - 형식 예시]");
    expect(prompt).toContain("[사용자 확정 정보]");
    expect(prompt).toContain("과거 행정정보를 새 문서의 사실로 확정하지 말 것");
    expect(prompt).toContain("사용자 확정 업무");
  });
});
