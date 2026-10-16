/** Explicit local IPC only; never persist finance data in browser/account stores. */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { IncomeRecord } from "./domain";

export type FinanceSnapshot = Readonly<{
  identity: Readonly<{
    schemaVersion: 2;
    datasetId: string;
    revision: number;
    history: readonly string[];
  }>;
  income: readonly IncomeRecord[];
}>;

/** Initialises the encrypted store on first explicit access in the Windows app. */
export async function loadFinanceSnapshot(): Promise<FinanceSnapshot> {
  requireNative();
  return invoke<FinanceSnapshot>("my_finance_load_snapshot");
}

export type FinanceIdentity = FinanceSnapshot["identity"];

function requireNative(): void {
  if (!isTauri()) throw new Error("암호화 금융 저장소는 Windows 앱에서만 사용할 수 있습니다.");
}

/** Includes the identity token required by every mutation; no client cache. */
export async function listFinanceIncome(): Promise<FinanceSnapshot> {
  requireNative();
  return invoke<FinanceSnapshot>("my_finance_list_income");
}

export async function createFinanceIncome(expected: FinanceIdentity, entry: IncomeRecord): Promise<FinanceSnapshot> {
  requireNative();
  return invoke<FinanceSnapshot>("my_finance_create_income", { expected, entry });
}

export async function updateFinanceIncome(expected: FinanceIdentity, entry: IncomeRecord): Promise<FinanceSnapshot> {
  requireNative();
  return invoke<FinanceSnapshot>("my_finance_update_income", { expected, entry });
}

export async function deleteFinanceIncome(expected: FinanceIdentity, id: string): Promise<FinanceSnapshot> {
  requireNative();
  return invoke<FinanceSnapshot>("my_finance_delete_income", { expected, id });
}
