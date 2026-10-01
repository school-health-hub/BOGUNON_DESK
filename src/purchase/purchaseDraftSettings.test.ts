import { describe, expect, it } from "vitest";
import { normalizePurchaseDraftTemplates } from "./purchaseDraftSettings";

describe("purchase draft templates", () => {
  it("normalizes safe reusable format metadata without document values", () => {
    expect(normalizePurchaseDraftTemplates([{ id: " t1 ", name: " 기본 양식 ", titlePattern: "[학교] {{title}}", introPattern: "다음과 같이 {{purpose}}", detailFieldOrder: ["vendor", "amount", "unknown"], attachmentPhrase: " 붙임  내역 1부.  끝. ", includeAttachment: false }])).toEqual([{ id: "t1", name: "기본 양식", titlePattern: "[학교] {{title}}", introPattern: "다음과 같이 {{purpose}}", detailFieldOrder: ["vendor", "amount", "summary", "budgetItem"], attachmentPhrase: "붙임  내역 1부.  끝.", includeAttachment: false }]);
    expect(normalizePurchaseDraftTemplates([{ id: "t2", name: "안전", titlePattern: "실제 제목", introPattern: "실제 목적" }])[0]).toMatchObject({ titlePattern: "{{title}}", introPattern: "{{purpose}}" });
  });

  it("keeps at most ten unique valid templates", () => {
    const values = Array.from({ length: 12 }, (_, index) => ({ id: `template-${index}`, name: `템플릿 ${index}`, detailFieldOrder: [], attachmentPhrase: "붙임", includeAttachment: true }));
    expect(normalizePurchaseDraftTemplates([...values, values[0]] )).toHaveLength(10);
    expect(normalizePurchaseDraftTemplates(undefined)).toEqual([]);
  });
});
