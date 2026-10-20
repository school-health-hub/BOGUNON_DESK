import { describe, expect, it } from "vitest";
import { createIncomeRecord, FinanceValidationError, summarizeIncome, type IncomeDraft } from "./domain";

const draft: IncomeDraft = {
  id: "income-1",
  sourceName: "  테스트 기관  ",
  incomeKind: "consulting",
  contractLabel: "저작권 사용료",
  taxCategory: "unverified",
  taxCategoryVerified: false,
  earnedOn: "2026-10-01",
  paidOn: "2026-10-15",
  grossKrw: 400_000,
  deductions: [{ kind: "employment_insurance", amountKrw: 3_600 }],
  notes: "",
};

describe("MY FINANCE domain", () => {
  it("calculates net income without guessing a tax category", () => {
    const record = createIncomeRecord(draft);
    expect(record.netKrw).toBe(396_400);
    expect(record.taxCategory).toBe("unverified");
    expect(record.sourceName).toBe("테스트 기관");
  });

  it("rejects impossible amounts and dates", () => {
    expect(() => createIncomeRecord({ ...draft, grossKrw: -1 })).toThrow(FinanceValidationError);
    expect(() => createIncomeRecord({ ...draft, earnedOn: "2026-02-30" })).toThrow(FinanceValidationError);
    expect(() => createIncomeRecord({
      ...draft, deductions: [{ kind: "other", amountKrw: 400_001 }],
    })).toThrow(FinanceValidationError);
  });

  it("requires evidence before marking a tax category as verified", () => {
    expect(() => createIncomeRecord({ ...draft, taxCategoryVerified: true })).toThrow(FinanceValidationError);
  });

  it("summarizes by earned year and counts unpaid records", () => {
    const paid = createIncomeRecord(draft);
    const unpaid = createIncomeRecord({ ...draft, id: "income-2", paidOn: null, grossKrw: 100_000, deductions: [] });
    const previous = createIncomeRecord({ ...draft, id: "income-3", earnedOn: "2025-12-31" });
    expect(summarizeIncome([paid, unpaid, previous], 2026)).toEqual({
      year: 2026, recordCount: 2, grossKrw: 500_000, deductionsKrw: 3_600, netKrw: 496_400, unpaidCount: 1,
    });
  });
});
