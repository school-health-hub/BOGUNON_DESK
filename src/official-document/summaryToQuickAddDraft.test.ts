import { describe, expect, it } from "vitest";
import type { OfficialDocumentLocalSummary } from "./summaryExtractor";
import {
  createOfficialDocumentQuickAddDraft,
  parseExplicitOfficialDocumentDate,
} from "./summaryToQuickAddDraft";

const field = (value: string | null, evidence: string | null = value) => ({ value, evidence });

const createSummary = (
  action: string | null,
  deadline: string | null = null,
): OfficialDocumentLocalSummary => ({
  actions: action === null ? [] : [field(action, `근거 ${action}`)],
  target: field("관내 학교", "대상 근거"),
  deadline: field(deadline, deadline === null ? null : `기한 근거 ${deadline}`),
  submissionMethod: field("업무관리시스템", "방법 근거"),
  materials: [field("참석자 명단", "자료 근거")],
  attachments: [field("붙임 1", "붙임 근거")],
  contact: field("담당 부서 02-000-0000", "연락처 근거"),
});

describe("parseExplicitOfficialDocumentDate", () => {
  it.each([
    ["2026. 9. 23.", "2026-09-23"],
    ["2026. 9. 23.(수)", "2026-09-23"],
    ["2026-09-23", "2026-09-23"],
    ["2026년 9월 23일", "2026-09-23"],
    ["2024. 2. 29.", "2024-02-29"],
  ])("parses an explicit full date %s", (source, expected) => {
    expect(parseExplicitOfficialDocumentDate(source)).toBe(expected);
  });

  it.each([
    "9. 23.",
    "9월 23일",
    "2026. 9. 23. ~ 9. 30.",
    "2026-09-23 ~ 2026-09-30",
    "2026. 2. 29.",
    "2026. 13. 1.",
    "2026. 4. 31.",
  ])("rejects an ambiguous or invalid date %s", (source) => {
    expect(parseExplicitOfficialDocumentDate(source)).toBeNull();
  });
});

describe("createOfficialDocumentQuickAddDraft", () => {
  it("turns the first clear action into a conservative task title", () => {
    expect(createOfficialDocumentQuickAddDraft(
      createSummary("참석자 명단을 제출하여 주시기 바랍니다.", "2026. 9. 23.(수)"),
    )).toEqual({
      title: "참석자 명단 제출",
      dueDate: "2026-09-23",
      area: "healthWork",
      category: "officialDocument",
      priority: "normal",
    });
  });

  it.each([
    ["자료를 제출해 주시기 바랍니다", "자료 제출"],
    ["공문을 확인 바랍니다.", "공문 확인"],
  ])("removes only a formal request ending from %s", (source, expected) => {
    expect(createOfficialDocumentQuickAddDraft(createSummary(source)).title).toBe(expected);
  });

  it("uses a safe fallback when no action was extracted", () => {
    expect(createOfficialDocumentQuickAddDraft(createSummary(null)).title).toBe("공문 확인 및 처리");
  });

  it("limits the generated title to 120 characters", () => {
    const title = createOfficialDocumentQuickAddDraft(
      createSummary(`${"가".repeat(130)} 제출 바랍니다`),
    ).title;
    expect(title).toHaveLength(120);
  });

  it("keeps an ambiguous deadline blank", () => {
    expect(createOfficialDocumentQuickAddDraft(createSummary("내용 확인 바랍니다", "9월 23일")).dueDate).toBeNull();
  });

  it("does not include document body, evidence, contact, or source metadata", () => {
    expect(Object.keys(createOfficialDocumentQuickAddDraft(createSummary("공문 확인 바랍니다"))).sort()).toEqual([
      "area",
      "category",
      "dueDate",
      "priority",
      "title",
    ]);
  });
});
