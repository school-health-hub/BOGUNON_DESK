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

export type CurrencyCode = string;
export type InvestmentAccount = Readonly<{ id: string; name: string; market: "kr" | "us" | "other"; currency: CurrencyCode }>;
export type InvestmentInstrument = Readonly<{ id: string; accountId: string; symbol: string; name: string; kind: "stock" | "etf"; currency: CurrencyCode; marketPriceMinor: number; valuationExchangeRateMicros: number; valuedOn: string }>;
export type InvestmentTrade = Readonly<{ id: string; instrumentId: string; kind: "buy" | "sell"; tradedOn: string; quantityMicros: number; unitPriceMinor: number; exchangeRateMicros: number; feesKrw: number; taxesKrw: number }>;
export type DividendEntry = Readonly<{ id: string; instrumentId: string; paidOn: string; grossMinor: number; currency: CurrencyCode; exchangeRateMicros: number; withholdingKrw: number }>;
export type AssetBalance = Readonly<{ id: string; label: string; kind: "cash" | "deposit" | "savings"; currency: CurrencyCode; amountMinor: number; exchangeRateMicros: number; asOf: string }>;
export type LiabilityBalance = Readonly<{ id: string; label: string; currency: CurrencyCode; amountMinor: number; exchangeRateMicros: number; asOf: string }>;
export type Phase2Data = Readonly<{ investmentAccounts: readonly InvestmentAccount[]; instruments: readonly InvestmentInstrument[]; trades: readonly InvestmentTrade[]; dividends: readonly DividendEntry[]; assetBalances: readonly AssetBalance[]; liabilities: readonly LiabilityBalance[] }>;
export const emptyPhase2Data = (): Phase2Data => ({ investmentAccounts: [], instruments: [], trades: [], dividends: [], assetBalances: [], liabilities: [] });

export function parseScaledDecimal(value: string, scale: number): number {
  if (!Number.isSafeInteger(scale) || scale <= 0 || !/^\d+(?:\.\d+)?$/.test(value)) throw new FinanceValidationError("금액·수량·환율을 숫자로 입력해 주세요.");
  const [whole, fraction = ""] = value.split(".");
  const digits = String(scale).length - 1;
  if (fraction.length > digits) throw new FinanceValidationError(`소수점은 최대 ${digits}자리까지 입력할 수 있습니다.`);
  const result = Number(whole) * scale + Number(fraction.padEnd(digits, "0"));
  if (!Number.isSafeInteger(result)) throw new FinanceValidationError("입력값이 안전한 범위를 초과했습니다.");
  return result;
}

const scaledKrw = (minor: number, rateMicros: number): number => {
  if (![minor, rateMicros].every(Number.isSafeInteger) || minor < 0 || rateMicros <= 0) throw new FinanceValidationError("통화 금액 또는 환율을 확인해 주세요.");
  const value = (BigInt(minor) * BigInt(rateMicros) + 50_000_000n) / 100_000_000n;
  const converted = Number(value);
  if (!Number.isSafeInteger(converted)) throw new FinanceValidationError("환산 금액이 안전한 범위를 초과했습니다.");
  return converted;
};

export type InvestmentPosition = Readonly<{ instrumentId: string; quantityMicros: number; averageCostKrw: number; marketValueKrw: number; realizedKrw: number; unrealizedKrw: number }>;
export function calculateInvestmentPositions(data: Phase2Data): readonly InvestmentPosition[] {
  return data.instruments.map((instrument) => {
    const trades = data.trades.filter((trade) => trade.instrumentId === instrument.id).sort((a, b) => a.tradedOn.localeCompare(b.tradedOn) || a.id.localeCompare(b.id));
    let quantity = 0n; let cost = 0n; let realized = 0n;
    for (const trade of trades) {
      const q = BigInt(trade.quantityMicros);
      const gross = BigInt(scaledKrw(trade.unitPriceMinor, trade.exchangeRateMicros)) * q / 1_000_000n;
      if (trade.kind === "buy") { quantity += q; cost += gross + BigInt(trade.feesKrw + trade.taxesKrw); continue; }
      if (q > quantity) throw new FinanceValidationError(`${instrument.name}의 매도 수량이 보유 수량을 초과합니다.`);
      const released = quantity === 0n ? 0n : cost * q / quantity;
      realized += gross - BigInt(trade.feesKrw + trade.taxesKrw) - released;
      quantity -= q; cost -= released;
    }
    const market = BigInt(scaledKrw(instrument.marketPriceMinor, instrument.valuationExchangeRateMicros)) * quantity / 1_000_000n;
    return { instrumentId: instrument.id, quantityMicros: Number(quantity), averageCostKrw: quantity === 0n ? 0 : Number(cost * 1_000_000n / quantity), marketValueKrw: Number(market), realizedKrw: Number(realized), unrealizedKrw: Number(market - cost) };
  });
}

export function summarizeTax(records: readonly IncomeRecord[], dividends: readonly DividendEntry[], year: number) {
  const income = records.filter((item) => item.earnedOn.startsWith(`${year}-`));
  const selectedDividends = dividends.filter((item) => item.paidOn.startsWith(`${year}-`));
  const dividendGrossKrw = selectedDividends.reduce((sum, item) => sum + scaledKrw(item.grossMinor, item.exchangeRateMicros), 0);
  const grossKrw = income.reduce((sum, item) => sum + item.grossKrw, 0) + dividendGrossKrw;
  const withholdingKrw = income.reduce((sum, item) => sum + item.deductions.filter((d) => d.kind === "income_tax" || d.kind === "local_income_tax").reduce((part, d) => part + d.amountKrw, 0), 0)
    + selectedDividends.reduce((sum, item) => sum + item.withholdingKrw, 0);
  const netKrw = income.reduce((sum, item) => sum + item.netKrw, 0) + dividendGrossKrw - selectedDividends.reduce((sum, item) => sum + item.withholdingKrw, 0);
  return { grossKrw, withholdingKrw, netKrw, incomeCount: income.length, dividendCount: selectedDividends.length, unverifiedCount: income.filter((item) => !item.taxCategoryVerified).length };
}

export function summarizeNetWorth(data: Phase2Data, asOf: string) {
  const positions = calculateInvestmentPositions(data);
  const latestAssets = new Map<string, AssetBalance>();
  for (const item of data.assetBalances.filter((entry) => entry.asOf <= asOf)) { const key = `${item.kind}:${item.currency}:${item.label}`; const previous = latestAssets.get(key); if (!previous || previous.asOf < item.asOf) latestAssets.set(key, item); }
  const latestLiabilities = new Map<string, LiabilityBalance>();
  for (const item of data.liabilities.filter((entry) => entry.asOf <= asOf)) { const key = `${item.currency}:${item.label}`; const previous = latestLiabilities.get(key); if (!previous || previous.asOf < item.asOf) latestLiabilities.set(key, item); }
  const manualAssetsKrw = [...latestAssets.values()].reduce((sum, item) => sum + scaledKrw(item.amountMinor, item.exchangeRateMicros), 0);
  const investmentKrw = positions.reduce((sum, item) => sum + item.marketValueKrw, 0);
  const liabilitiesKrw = [...latestLiabilities.values()].reduce((sum, item) => sum + scaledKrw(item.amountMinor, item.exchangeRateMicros), 0);
  return { manualAssetsKrw, investmentKrw, totalAssetsKrw: manualAssetsKrw + investmentKrw, liabilitiesKrw, netWorthKrw: manualAssetsKrw + investmentKrw - liabilitiesKrw };
}
