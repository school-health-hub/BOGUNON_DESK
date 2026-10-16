import { createIncomeRecord, FinanceValidationError, summarizeIncome, type IncomeDeductionKind, type IncomeKind, type IncomeRecord, type TaxCategory } from "./domain";

export const incomeLabels: Record<IncomeKind, string> = { salary: "학교 급여", consulting: "자문", ebook: "전자책", lecture: "강의", other: "기타" };
export const taxLabels: Record<TaxCategory, string> = { unverified: "미확인", employment: "근로소득", business: "사업소득", other_income: "기타소득", royalty: "사용료·저작권료", non_taxable: "비과세", unknown: "분류 보류" };
export const deductionLabels: Record<IncomeDeductionKind, string> = { income_tax: "소득세", local_income_tax: "지방소득세", employment_insurance: "고용보험", platform_fee: "플랫폼 수수료", other: "기타 공제" };
export type IncomeFilter = IncomeKind | "all";
export const formatKrw = (value: number): string => `${new Intl.NumberFormat("ko-KR").format(value)}원`;
export const localToday = (): string => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function selectIncome(records: readonly IncomeRecord[], year: number, kind: IncomeFilter) {
  const filtered = records.filter((r) => r.earnedOn.startsWith(`${year}-`) && (kind === "all" || r.incomeKind === kind));
  let summary: ReturnType<typeof summarizeIncome> | null = null;
  try { summary = summarizeIncome(filtered, year); } catch { /* Keep records editable even when totals exceed safe range. */ }
  return { records: [...filtered].sort((a, b) => b.earnedOn.localeCompare(a.earnedOn) || a.id.localeCompare(b.id)), summary };
}

export type IncomeFormValue = {
  id: string; sourceName: string; incomeKind: IncomeKind; contractLabel: string;
  taxCategory: TaxCategory; taxCategoryVerified: boolean; earnedOn: string; paidOn: string;
  gross: string; deductions: { kind: IncomeDeductionKind; amount: string }[]; notes: string;
};
export function emptyIncomeForm(): IncomeFormValue {
  return { id: crypto.randomUUID(), sourceName: "", incomeKind: "salary", contractLabel: "", taxCategory: "unverified", taxCategoryVerified: false, earnedOn: localToday(), paidOn: "", gross: "", deductions: [], notes: "" };
}
export function editIncomeForm(entry: IncomeRecord): IncomeFormValue {
  return { ...entry, gross: String(entry.grossKrw), paidOn: entry.paidOn ?? "", deductions: entry.deductions.map((d) => ({ kind: d.kind, amount: String(d.amountKrw) })) };
}
export function parseKrw(text: string): number {
  const value = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(value)) throw new FinanceValidationError("금액은 쉼표 없이 0 이상의 정수로 입력해 주세요.");
  return value;
}
export function formToIncome(value: IncomeFormValue): IncomeRecord {
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  if (bytes(value.sourceName.trim()) > 200 || bytes(value.contractLabel) > 200 || bytes(value.notes) > 5000) {
    throw new FinanceValidationError("지급처·계약 명목 또는 메모가 너무 깁니다. 내용을 줄여 주세요.");
  }
  return createIncomeRecord({
    id: value.id, sourceName: value.sourceName, incomeKind: value.incomeKind,
    contractLabel: value.contractLabel, taxCategory: value.taxCategory,
    taxCategoryVerified: value.taxCategoryVerified, earnedOn: value.earnedOn,
    paidOn: value.paidOn || null, grossKrw: parseKrw(value.gross),
    deductions: value.deductions.map((d) => ({ kind: d.kind, amountKrw: parseKrw(d.amount) })), notes: value.notes,
  });
}

/** Native errors may contain sensitive context. Never render or forward them. */
export function isFinanceConflict(error: unknown): boolean {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  return message.includes("금융 데이터가 변경되었습니다");
}
