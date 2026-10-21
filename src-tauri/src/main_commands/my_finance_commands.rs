//! Main-only IPC adapters. Business functions remain trusted backend paths.
use super::*;
#[tauri::command]
pub(crate) async fn my_finance_load_snapshot(
    caller: tauri::Webview,
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
) -> Result<FinanceSnapshot, crate::main_caller::CommandError<&'static str>> {
    crate::main_caller::run_async(&caller, || async {
        super::my_finance_load_snapshot(app, state).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_list_income(
    caller: tauri::Webview,
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
) -> Result<FinanceSnapshot, crate::main_caller::CommandError<&'static str>> {
    crate::main_caller::run_async(&caller, || async {
        super::my_finance_list_income(app, state).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_create_income(
    caller: tauri::Webview,
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    expected: SnapshotIdentity,
    entry: IncomeEntry,
) -> Result<FinanceSnapshot, crate::main_caller::CommandError<&'static str>> {
    crate::main_caller::run_async(&caller, || async {
        super::my_finance_create_income(app, state, expected, entry).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_update_income(
    caller: tauri::Webview,
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    expected: SnapshotIdentity,
    entry: IncomeEntry,
) -> Result<FinanceSnapshot, crate::main_caller::CommandError<&'static str>> {
    crate::main_caller::run_async(&caller, || async {
        super::my_finance_update_income(app, state, expected, entry).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_delete_income(
    caller: tauri::Webview,
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    expected: SnapshotIdentity,
    id: Uuid,
) -> Result<FinanceSnapshot, crate::main_caller::CommandError<&'static str>> {
    crate::main_caller::run_async(&caller, || async {
        super::my_finance_delete_income(app, state, expected, id).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_replace_phase2(
    caller: tauri::Webview,
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    expected: SnapshotIdentity,
    phase2: Phase2Data,
) -> Result<FinanceSnapshot, crate::main_caller::CommandError<&'static str>> {
    crate::main_caller::run_async(&caller, || async {
        super::my_finance_replace_phase2(app, state, expected, phase2).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_export_backup(
    caller: tauri::Webview,
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    expected: SnapshotIdentity,
    password: String,
) -> Result<bool, crate::main_caller::CommandError<&'static str>> {
    crate::main_caller::run_async(&caller, || async {
        super::my_finance_export_backup(app, state, expected, password).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_select_backup(
    caller: tauri::Webview,
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
) -> Result<Option<Uuid>, crate::main_caller::CommandError<&'static str>> {
    crate::main_caller::run_async(&caller, || async {
        super::my_finance_select_backup(app, state).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_inspect_backup(
    caller: tauri::Webview,
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    token: Uuid,
    password: String,
) -> Result<
    crate::my_finance_transfer::RestorePreview,
    crate::main_caller::CommandError<&'static str>,
> {
    crate::main_caller::run_async(&caller, || async {
        super::my_finance_inspect_backup(app, state, token, password).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_restore_backup(
    caller: tauri::Webview,
    app: tauri::AppHandle,
    state: tauri::State<'_, FinanceState>,
    token: Uuid,
    confirm_dataset_change: Option<bool>,
) -> Result<FinanceSnapshot, crate::main_caller::CommandError<&'static str>> {
    crate::main_caller::run_async(&caller, || async {
        super::my_finance_restore_backup(app, state, token, confirm_dataset_change).await
    })
    .await
}

#[tauri::command]
pub(crate) async fn my_finance_cancel_backup(
    caller: tauri::Webview,
    state: tauri::State<'_, FinanceState>,
    token: Uuid,
) -> Result<(), crate::main_caller::CommandError<&'static str>> {
    crate::main_caller::run_async(&caller, || async {
        super::my_finance_cancel_backup(state, token).await
    })
    .await
}
