// Type-only extraction from MY FINANCE phase2@1b6a1383. Original UI/domain/repository remain unchanged.
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
export type CurrencyCode = string;
export type InvestmentAccount = Readonly<{ id: string; name: string; market: "kr" | "us" | "other"; currency: CurrencyCode }>;
export type InvestmentInstrument = Readonly<{ id: string; accountId: string; symbol: string; name: string; kind: "stock" | "etf"; currency: CurrencyCode; marketPriceMinor: number; valuationExchangeRateMicros: number; valuedOn: string }>;
export type InvestmentTrade = Readonly<{ id: string; instrumentId: string; kind: "buy" | "sell"; tradedOn: string; quantityMicros: number; unitPriceMinor: number; exchangeRateMicros: number; feesKrw: number; taxesKrw: number }>;
export type DividendEntry = Readonly<{ id: string; instrumentId: string; paidOn: string; grossMinor: number; currency: CurrencyCode; exchangeRateMicros: number; withholdingKrw: number }>;
export type AssetBalance = Readonly<{ id: string; label: string; kind: "cash" | "deposit" | "savings"; currency: CurrencyCode; amountMinor: number; exchangeRateMicros: number; asOf: string }>;
export type LiabilityBalance = Readonly<{ id: string; label: string; currency: CurrencyCode; amountMinor: number; exchangeRateMicros: number; asOf: string }>;
export type Phase2Data = Readonly<{ investmentAccounts: readonly InvestmentAccount[]; instruments: readonly InvestmentInstrument[]; trades: readonly InvestmentTrade[]; dividends: readonly DividendEntry[]; assetBalances: readonly AssetBalance[]; liabilities: readonly LiabilityBalance[] }>;
export type FinanceSnapshot = Readonly<{
  identity: Readonly<{
    schemaVersion: 2;
    datasetId: string;
    revision: number;
    history: readonly string[];
  }>;
  income: readonly IncomeRecord[];
  phase2?: Phase2Data;
}>;
export type FinanceIdentity = FinanceSnapshot["identity"];
export type RestorePreview = Readonly<{
  token: string; eligible: boolean; reason: string;
  requiresDatasetConfirmation: boolean; currentDatasetId: string; backupDatasetId: string;
  currentRevision: number; backupRevision: number; recordCount: number;
}>;
import type {IpcResult} from './protocol.js';
export type FinanceAvailability=Readonly<{available:boolean;reason:string}>;
export type FinanceBridge=Readonly<{
 status():Promise<IpcResult<FinanceAvailability>>;
 load():Promise<IpcResult<FinanceSnapshot>>;
 createIncome(input:Readonly<{expected:FinanceIdentity;entry:IncomeRecord}>):Promise<IpcResult<FinanceSnapshot>>;
 updateIncome(input:Readonly<{expected:FinanceIdentity;entry:IncomeRecord}>):Promise<IpcResult<FinanceSnapshot>>;
 deleteIncome(input:Readonly<{expected:FinanceIdentity;id:string}>):Promise<IpcResult<FinanceSnapshot>>;
 replacePhase2(input:Readonly<{expected:FinanceIdentity;phase2:Phase2Data}>):Promise<IpcResult<FinanceSnapshot>>;
 exportBackup(input:Readonly<{expected:FinanceIdentity;password:string}>):Promise<IpcResult<boolean>>;
 selectBackup():Promise<IpcResult<string|null>>;
 inspectBackup(input:Readonly<{token:string;password:string}>):Promise<IpcResult<RestorePreview>>;
 restoreBackup(input:Readonly<{token:string;confirmDatasetChange:boolean}>):Promise<IpcResult<FinanceSnapshot>>;
 cancelBackup(input:Readonly<{token:string}>):Promise<IpcResult<null>>;
 close():Promise<IpcResult<null>>;
}>;
