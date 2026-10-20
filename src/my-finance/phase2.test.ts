import { describe, expect, it } from "vitest";
import { calculateInvestmentPositions, emptyPhase2Data, summarizeNetWorth, summarizeTax, type IncomeRecord, type Phase2Data } from "./domain";

const account = { id: "10000000-0000-4000-8000-000000000001", name: "합성 증권", market: "us" as const, currency: "USD" };
const instrument = { id: "10000000-0000-4000-8000-000000000002", accountId: account.id, symbol: "SYN", name: "합성 ETF", kind: "etf" as const, currency: "USD", marketPriceMinor: 12_000, valuationExchangeRateMicros: 1_400_000_000, valuedOn: "2026-10-20" };
const phase2: Phase2Data = { ...emptyPhase2Data(), investmentAccounts: [account], instruments: [instrument], trades: [
  { id: "10000000-0000-4000-8000-000000000003", instrumentId: instrument.id, kind: "buy", tradedOn: "2026-01-02", quantityMicros: 2_000_000, unitPriceMinor: 10_000, exchangeRateMicros: 1_300_000_000, feesKrw: 1_000, taxesKrw: 0 },
  { id: "10000000-0000-4000-8000-000000000004", instrumentId: instrument.id, kind: "sell", tradedOn: "2026-02-02", quantityMicros: 1_000_000, unitPriceMinor: 11_000, exchangeRateMicros: 1_350_000_000, feesKrw: 1_000, taxesKrw: 2_000 },
], assetBalances: [{ id: "10000000-0000-4000-8000-000000000005", label: "합성 예금", kind: "deposit", currency: "KRW", amountMinor: 10_000_000, exchangeRateMicros: 1_000_000, asOf: "2026-10-20" }], liabilities: [{ id: "10000000-0000-4000-8000-000000000006", label: "합성 대출", currency: "KRW", amountMinor: 3_000_000, exchangeRateMicros: 1_000_000, asOf: "2026-10-20" }] };

describe("MY FINANCE Phase 2 calculations", () => {
  it("separates realized and unrealized investment profit", () => {
    const position = calculateInvestmentPositions(phase2)[0];
    expect(position.quantityMicros).toBe(1_000_000);
    expect(position.realizedKrw).toBe(15_000);
    expect(position.unrealizedKrw).toBe(37_500);
  });
  it("derives tax withholding from Phase 1 deductions without duplicating income", () => {
    const income: IncomeRecord = { id: "i", sourceName: "합성", incomeKind: "lecture", contractLabel: "", taxCategory: "business", taxCategoryVerified: true, earnedOn: "2026-01-01", paidOn: "2026-01-02", grossKrw: 200_000, deductions: [{ kind: "income_tax", amountKrw: 6_000 }, { kind: "local_income_tax", amountKrw: 600 }], netKrw: 193_400, notes: "" };
    expect(summarizeTax([income], [], 2026)).toEqual({ grossKrw: 200_000, withholdingKrw: 6_600, netKrw: 193_400, incomeCount: 1, dividendCount: 0, unverifiedCount: 0 });
  });
  it("counts brokerage valuation only from positions in net worth", () => {
    const worth = summarizeNetWorth(phase2, "2026-10-20");
    expect(worth.manualAssetsKrw).toBe(100_000);
    expect(worth.investmentKrw).toBe(168_000);
    expect(worth.liabilitiesKrw).toBe(30_000);
    expect(worth.netWorthKrw).toBe(238_000);
  });
});
