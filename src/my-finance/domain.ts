/**
 * MY FINANCE domain model. This module is pure and contains no persistence,
 * networking, logging, or account-sync integration.
 * Monetary values are integer KRW; tax classifications are evidence-based.
 */
export type IncomeKind = "salary" | "consulting" | "ebook" | "lecture" | "other";
export type TaxCategory =
  | "unverified"
  | "employment"
  | "business"
  | "other_income"
  | "royalty"
  | "non_taxable"
  | "unknown";

export type IncomeDeductionKind =
  | "income_tax"
  | "local_income_tax"
  | "employment_insurance"
  | "platform_fee"
  | "other";

export type IncomeDeduction = Readonly<{
  kind: IncomeDeductionKind;
  amountKrw: number;
}>;

export type IncomeRecord = Readonly<{
  id: string;
  sourceName: string;
  incomeKind: IncomeKind;
  contractLabel: string;
  taxCategory: TaxCategory;
  taxCategoryVerified: boolean;
  earnedOn: string;
  paidOn: string | null;
  grossKrw: number;
  deductions: readonly IncomeDeduction[];
  netKrw: number;
  notes: string;
}>;

export type IncomeDraft = Omit<IncomeRecord, "netKrw">;

export class FinanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceValidationError";
  }
}

const validDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const validKrw = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

export function createIncomeRecord(draft: IncomeDraft): IncomeRecord {
  if (!draft.id.trim() || draft.id.length > 128) throw new FinanceValidationError("거래 ID를 확인해 주세요.");
  if (!draft.sourceName.trim() || draft.sourceName.length > 200) {
    throw new FinanceValidationError("수입 기관명을 확인해 주세요.");
  }
  if (!validDate(draft.earnedOn) || (draft.paidOn !== null && !validDate(draft.paidOn))) {
    throw new FinanceValidationError("수입 발생일 또는 입금일이 올바르지 않습니다.");
  }
  if (!validKrw(draft.grossKrw) || !draft.deductions.every((item) => validKrw(item.amountKrw))) {
    throw new FinanceValidationError("금액은 0원 이상의 정수로 입력해 주세요.");
  }
  if (draft.notes.length > 5000 || draft.contractLabel.length > 200) {
    throw new FinanceValidationError("메모 또는 계약상 명목이 너무 깁니다.");
  }
  const totalDeductions = draft.deductions.reduce((sum, item) => sum + item.amountKrw, 0);
  if (!Number.isSafeInteger(totalDeductions) || totalDeductions > draft.grossKrw) {
    throw new FinanceValidationError("공제 합계는 총수입을 초과할 수 없습니다.");
  }
  if (draft.taxCategoryVerified && (draft.taxCategory === "unverified" || draft.taxCategory === "unknown")) {
    throw new FinanceValidationError("확인되지 않은 세무 분류를 확정할 수 없습니다.");
  }
  return {
    ...draft,
    sourceName: draft.sourceName.trim(),
    deductions: draft.deductions.map((item) => ({ ...item })),
    netKrw: draft.grossKrw - totalDeductions,
  };
}

export type AnnualIncomeSummary = Readonly<{
  year: number;
  recordCount: number;
  grossKrw: number;
  deductionsKrw: number;
  netKrw: number;
  unpaidCount: number;
}>;

export function summarizeIncome(records: readonly IncomeRecord[], year: number): AnnualIncomeSummary {
  if (!Number.isSafeInteger(year) || year < 1900 || year > 9999) {
    throw new FinanceValidationError("정산 연도를 확인해 주세요.");
  }
  const selected = records.filter((record) => Number(record.earnedOn.slice(0, 4)) === year);
  const grossKrw = selected.reduce((sum, record) => sum + record.grossKrw, 0);
  const deductionsKrw = selected.reduce((sum, record) =>
    sum + record.deductions.reduce((part, item) => part + item.amountKrw, 0), 0);
  const netKrw = selected.reduce((sum, record) => sum + record.netKrw, 0);
  if (![grossKrw, deductionsKrw, netKrw].every(Number.isSafeInteger)) {
    throw new FinanceValidationError("합계 금액이 안전한 범위를 초과했습니다.");
  }
  return {
    year, recordCount: selected.length, grossKrw, deductionsKrw, netKrw,
    unpaidCount: selected.filter((record) => record.paidOn === null).length,
  };
}
