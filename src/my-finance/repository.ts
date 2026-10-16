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

export type RestorePreview = Readonly<{
  token: string; eligible: boolean; reason: string;
  requiresDatasetConfirmation: boolean; currentDatasetId: string; backupDatasetId: string;
  currentRevision: number; backupRevision: number; recordCount: number;
}>;
export async function exportFinanceBackup(expected: FinanceIdentity, password: string): Promise<boolean> {
  requireNative();
  return invoke<boolean>("my_finance_export_backup", { expected, password });
}
export async function selectFinanceBackup(): Promise<string | null> {
  requireNative();
  return invoke<string | null>("my_finance_select_backup");
}
export async function inspectFinanceBackup(token: string, password: string): Promise<RestorePreview> {
  requireNative();
  return invoke<RestorePreview>("my_finance_inspect_backup", { token, password });
}
export async function restoreFinanceBackup(token: string, confirmDatasetChange = false): Promise<FinanceSnapshot> {
  requireNative();
  return invoke<FinanceSnapshot>("my_finance_restore_backup", { token, confirmDatasetChange });
}
export async function cancelFinanceBackup(token: string): Promise<void> {
  requireNative();
  return invoke<void>("my_finance_cancel_backup", { token });
}
