import { describe, expect, it } from "vitest";
import { emptyPhase2Data, type IncomeRecord, type Phase2Data } from "./domain";
import { buildFinanceHomeSummary } from "./financeHomeModel";

const income: IncomeRecord = {
  id: "income-1", sourceName: "합성 강의", incomeKind: "lecture", contractLabel: "",
  taxCategory: "unverified", taxCategoryVerified: false, earnedOn: "2026-03-04", paidOn: null,
  grossKrw: 200_000, deductions: [{ kind: "income_tax", amountKrw: 6_000 }],
  netKrw: 194_000, notes: "",
};

describe("finance home summary", () => {
  it("combines annual income and dividends without double-counting investments", () => {
    const phase2: Phase2Data = {
      ...emptyPhase2Data(),
      investmentAccounts: [{ id: "account", name: "합성 계좌", market: "kr", currency: "KRW" }],
      instruments: [{ id: "stock", accountId: "account", symbol: "QA", name: "합성 종목", kind: "stock", currency: "KRW", marketPriceMinor: 55_000_00, valuationExchangeRateMicros: 1_000_000, valuedOn: "2026-03-05" }],
      trades: [{ id: "trade", instrumentId: "stock", kind: "buy", tradedOn: "2026-03-01", quantityMicros: 2_000_000, unitPriceMinor: 50_000_00, exchangeRateMicros: 1_000_000, feesKrw: 100, taxesKrw: 0 }],
      dividends: [{ id: "dividend", instrumentId: "stock", paidOn: "2026-03-05", grossMinor: 3_000_00, currency: "KRW", exchangeRateMicros: 1_000_000, withholdingKrw: 462 }],
      assetBalances: [{ id: "cash", label: "예금", kind: "deposit", currency: "KRW", amountMinor: 1_000_000_00, exchangeRateMicros: 1_000_000, asOf: "2026-03-05" }],
    };

    const result = buildFinanceHomeSummary([income], phase2, 2026, "2026-03-05");
    expect(result.annualIncomeKrw).toBe(203_000);
    expect(result.annualDividendKrw).toBe(3_000);
    expect(result.totalAssetsKrw).toBe(1_110_000);
    expect(result.investmentKrw).toBe(110_000);
    expect(result.unrealizedKrw).toBe(9_900);
    expect(result.monthlyIncomeKrw[2]).toBe(200_000);
    expect(result.unpaidCount).toBe(1);
    expect(result.unverifiedCount).toBe(1);
  });
});
