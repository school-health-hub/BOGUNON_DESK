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
  if (!isTauri()) throw new Error("암호화 금융 저장소는 Windows 앱에서만 사용할 수 있습니다.");
  return invoke<FinanceSnapshot>("my_finance_load_snapshot");
}
