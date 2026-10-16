import { describe, expect, it } from "vitest";
import { createIncomeRecord, type IncomeDraft } from "./domain";
import { editIncomeForm, formToIncome, parseKrw, selectIncome } from "./presentation";
const draft: IncomeDraft = { id: "synthetic-1", sourceName: "합성 지급처", incomeKind: "lecture", contractLabel: "합성 명목", taxCategory: "unverified", taxCategoryVerified: false, earnedOn: "2026-12-31", paidOn: "2027-01-01", grossKrw: 100_000, deductions: [{ kind: "income_tax", amountKrw: 3_000 }], notes: "합성 메모" };
describe("finance presentation", () => {
  it("aggregates by earned year and selected type, with unpaid count independent of payment year", () => {
    const first = createIncomeRecord(draft);
    const unpaid = createIncomeRecord({ ...draft, id: "synthetic-2", paidOn: null, earnedOn: "2026-01-01" });
    const previous = createIncomeRecord({ ...draft, id: "synthetic-3", earnedOn: "2025-12-31" });
    const other = createIncomeRecord({ ...draft, id: "synthetic-4", incomeKind: "ebook", paidOn: null });
    const list = [first, unpaid, previous, other];
    expect(selectIncome(list, 2026, "lecture").summary).toMatchObject({ grossKrw: 200_000, deductionsKrw: 6_000, netKrw: 194_000, unpaidCount: 1, recordCount: 2 });
    expect(selectIncome(list, 2026, "all").summary?.unpaidCount).toBe(2);
    expect(selectIncome(list, 2025, "all").records).toEqual([previous]);
    expect(selectIncome(list, 2026, "lecture").records).toEqual([first, unpaid]);
    expect(list[0]).toBe(first);
  });
  it("round trips every editable field without inferring tax from deductions", () => {
    const record = createIncomeRecord(draft);
    expect(formToIncome(editIncomeForm(record))).toEqual(record);
    expect(formToIncome(editIncomeForm(record)).taxCategory).toBe("unverified");
  });
  it.each(["", "-1", "1.5", "1e3", "1,000", "9007199254740992"])("rejects invalid KRW input %s", (value) => expect(() => parseKrw(value)).toThrow());
  it("enforces native UTF-8 limits before sending local IPC", () => {
    const form = editIncomeForm(createIncomeRecord(draft));
    expect(() => formToIncome({ ...form, sourceName: "가".repeat(67) })).toThrow("너무 깁니다");
  });
  it("does not hide records or show rounded totals on annual sum overflow", () => {
    const first = createIncomeRecord({ ...draft, grossKrw: Number.MAX_SAFE_INTEGER, deductions: [] });
    const second = { ...first, id: "synthetic-2" };
    const selected = selectIncome([first, second], 2026, "all");
    expect(selected.summary).toBeNull();
    expect(selected.records).toHaveLength(2);
  });
});
