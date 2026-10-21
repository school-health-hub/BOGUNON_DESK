import {
  calculateInvestmentPositions,
  summarizeIncome,
  summarizeNetWorth,
  type IncomeRecord,
  type Phase2Data,
} from "./domain";

export type FinanceHomeSummary = Readonly<{
  totalAssetsKrw: number;
  netWorthKrw: number;
  annualIncomeKrw: number;
  annualDividendKrw: number;
  investmentKrw: number;
  realizedKrw: number;
  unrealizedKrw: number;
  liabilitiesKrw: number;
  monthlyIncomeKrw: readonly number[];
  unpaidCount: number;
  unverifiedCount: number;
}>;

const toKrw = (minor: number, rateMicros: number): number =>
  Number((BigInt(minor) * BigInt(rateMicros) + 50_000_000n) / 100_000_000n);

export function buildFinanceHomeSummary(
  income: readonly IncomeRecord[],
  phase2: Phase2Data,
  year: number,
  asOf: string,
): FinanceHomeSummary {
  const annual = summarizeIncome(income, year);
  const dividends = phase2.dividends.filter((entry) => entry.paidOn.startsWith(`${year}-`));
  const annualDividendKrw = dividends.reduce(
    (sum, entry) => sum + toKrw(entry.grossMinor, entry.exchangeRateMicros),
    0,
  );
  const positions = calculateInvestmentPositions(phase2);
  const worth = summarizeNetWorth(phase2, asOf);
  const monthlyIncomeKrw = Array.from({ length: 12 }, (_, month) =>
    income
      .filter((entry) => entry.earnedOn.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
      .reduce((sum, entry) => sum + entry.grossKrw, 0),
  );

  return {
    totalAssetsKrw: worth.totalAssetsKrw,
    netWorthKrw: worth.netWorthKrw,
    annualIncomeKrw: annual.grossKrw + annualDividendKrw,
    annualDividendKrw,
    investmentKrw: worth.investmentKrw,
    realizedKrw: positions.reduce((sum, position) => sum + position.realizedKrw, 0),
    unrealizedKrw: positions.reduce((sum, position) => sum + position.unrealizedKrw, 0),
    liabilitiesKrw: worth.liabilitiesKrw,
    monthlyIncomeKrw,
    unpaidCount: annual.unpaidCount,
    unverifiedCount: income.filter(
      (entry) => entry.earnedOn.startsWith(`${year}-`) && !entry.taxCategoryVerified,
    ).length,
  };
}
