# Desktop Surface Phase C-0 — Main boundary source integration

Base/local/remote checkpoint: `725c5665c96cdb6281a7f7f8969205dd027afc3e`; branch `feature/dashboard-mint-ivory-v2`; worktree `C:/Users/Public/Documents/BOGUNON-dashboard-v2`.

Implementation and authorized lightweight/static verification completed. Full Tauri integration, generated effective ACL and Windows runtime are NOT VERIFIED. This record does not authorize or certify a second WebView, Native QA, Explorer attachment or installation. No commit/push was performed.

## Scope and source reuse

Reference: preserved 9B worktree checkpoint `c67f5bf1338b3f41c48c17d58ea57d956b48a82a`. Reused resource-table Arc identity checks, lifetime generation state, Main-only window admission and public Channel framing/subscriptions. Removed the later Projection coupling; imported no Surface adapter/broker/renderer/Native Owner/Host/Driver implementation. Existing Native QA Proof, Claim, approvals and Evidence are not modified or reused.

Each existing application command now has a Main-only IPC adapter in `src-tauri/src/main_commands/`. Its original function remains a trusted backend implementation, with the original command attribute removed to prevent duplicate Tauri macro exports. Existing argument names, success values and existing serialized errors remain unchanged. New caller rejection is typed. Login state is not an admission prerequisite, so an authorized pre-login Main can restore secure-session state. OAuth/loopback/deep-link business implementations remain unchanged.

## Current command inventory

Production: 59 existing commands plus 2 transport commands = 61. Separate Finance QA: 11 Finance commands plus QA info = 12. The permission-generation manifest has 62 unique names across both entrypoints. No Surface command permission is granted.

| Module | Commands | Caller policy |
|---|---|---|
| my_finance_commands | `my_finance_load_snapshot`, `my_finance_list_income`, `my_finance_create_income`, `my_finance_update_income`, `my_finance_delete_income`, `my_finance_replace_phase2`, `my_finance_export_backup`, `my_finance_select_backup`, `my_finance_inspect_backup`, `my_finance_restore_backup`, `my_finance_cancel_backup` | Main resource identity + current local lifetime; QA info is registered only in QA |
| ai | `validate_ai_connection` | Main resource identity + current local lifetime; QA info is registered only in QA |
| ai_generation | `generate_ai_text` | Main resource identity + current local lifetime; QA info is registered only in QA |
| chatgpt::commands | `chatgpt_get_connection_state`, `chatgpt_start_sign_in`, `chatgpt_disconnect`, `chatgpt_list_models`, `chatgpt_generate_text` | Main resource identity + current local lifetime; QA info is registered only in QA |
| desktop | `execute_desktop_action`, `open_bogunon_search_result`, `get_autostart_enabled`, `set_autostart_enabled`, `set_close_to_tray` | Main resource identity + current local lifetime; QA info is registered only in QA |
| launcher | `open_quick_memo_url`, `get_launcher_settings`, `save_launcher_url`, `save_work_portal_url`, `save_work_portal_auto_open_delay`, `replace_account_launcher_links` | Main resource identity + current local lifetime; QA info is registered only in QA |
| purchase_helper | `pick_and_analyze_purchase_files`, `analyze_purchase_paths`, `apply_purchase_column_mapping`, `save_purchase_export`, `save_purchase_edufine_export`, `set_purchase_helper_active`, `invalidate_purchase_helper_analysis` | Main resource identity + current local lifetime; QA info is registered only in QA |
| purchase_settlement | `save_purchase_settlement_export` | Main resource identity + current local lifetime; QA info is registered only in QA |
| official_document_import | `pick_and_extract_official_document`, `extract_official_document_path` | Main resource identity + current local lifetime; QA info is registered only in QA |
| record_helper_import | `pick_and_extract_record_helper_reports`, `extract_record_helper_paths` | Main resource identity + current local lifetime; QA info is registered only in QA |
| desktop_surface | `get_desktop_surface_probe` | Main resource identity + current local lifetime; QA info is registered only in QA |
| notifications | `get_notification_settings`, `set_workspace_notifications_enabled`, `set_workspace_notification_reasons`, `mark_daily_summary_sent` | Main resource identity + current local lifetime; QA info is registered only in QA |
| auth | `open_auth_url`, `secure_session_get`, `secure_session_set`, `secure_session_remove`, `secure_session_clear` | Main resource identity + current local lifetime; QA info is registered only in QA |
| work_folders | `get_work_folder_favorites`, `pick_work_folder_favorite`, `rename_work_folder_favorite`, `delete_work_folder_favorite`, `reorder_work_folder_favorites`, `open_work_folder_favorite` | Main resource identity + current local lifetime; QA info is registered only in QA |
| meal | `fetch_bogunon_meal` | Main resource identity + current local lifetime; QA info is registered only in QA |
| weather | `fetch_bogunon_weather` | Main resource identity + current local lifetime; QA info is registered only in QA |
| my_finance_qa | `my_finance_qa_info` | Main resource identity + current local lifetime; QA info is registered only in QA |
| main_channel | `register_main_channel`, `unregister_main_channel` | Main guard; private Channel registration/epoch |

Finance DB/schema/store/SQLCipher/DPAPI/backup format and authentication storage implementations are untouched. Finance backup paths continue to come from the existing native dialogs, not a new Surface path input.

## ACL and plugin inventory

`build.rs` retains Finance QA feature/config/source-stamp checks and now passes the complete explicit application command manifest to tauri-build AppManifest. `permissions/main-commands.toml` defines production and Finance-QA sets separately. Production capability is limited to `webviews: ["main"]`, without a `windows` wildcard/OR match that could admit another child Webview. QA inline capability uses only its Finance-QA set.

Actual permission generation and final merged ACL have NOT been run locally. Source coverage and configuration contracts are tested; this is not a claim of runtime ACL enforcement.

| Plugin | Existing frontend grant / backend use | Lifetime limit |
|---|---|---|
| deep-link | Main `deep-link:default`; existing callback flow preserved | Static Main-Webview ACL, not a resource-generation guard |
| notification | Main `notification:default` preserved | Static Main-Webview ACL |
| updater | Main check and download-and-install grants preserved | Static Main-Webview ACL; no updater operation executed |
| opener, store, dialog, autostart | Backend plugins retained; no new frontend grants | Trusted backend calls unchanged |
| single-instance | Existing backend callback retained | Production reveal uses pinned current Main, no recreation |
| core event/window/resource APIs | Existing core grants retained, scoped to Main Webview | Static ACL; not all core/plugin calls pass the application guard |
| main-navigation | New Main navigation hook, no IPC command | Lifetime retirement and Channel invalidation |

Important remaining boundary: Tauri routes plugin IPC separately from application commands. This implementation does NOT dynamically revoke plugin/core ACL grants after Main retirement. Full per-generation plugin IPC revocation requires a separately verified policy before any second operational WebView. No claim of complete all-IPC revocation is made.

## Lifetime, window and event contract

- Main is registered once at setup, using private Arc tokens in both actual Window and Webview resource tables. A matching label or reused numeric resource ID is insufficient. Rebinding/recreation is not implemented.
- Local origin is matched against effective dev origin or configured Windows app scheme. Foreign navigation is rejected and retires admission. Requested navigation closes admission; trusted Started advances/admits the new document generation; incompatible/overlapping lifecycle and overflow fail closed.
- New custom commands are rejected after retirement. Async wrappers capture a generation before constructing the business future and recheck generation/caller at completion, withholding stale responses. Already admitted file/network/state effects are NOT cancelled or rolled back. Checking admission does not atomically cancel subsequent IPC/eval transport; stale queued requests/responses and navigation TOCTOU remain Windows integration verification items.
- Main close-to-tray remains attached to the pinned Main window. NonMain close/drop/focus causes no Main hide, exit, logout, Purchase analysis or state action. Destroyed only retires matching Main admission; it is not WebView2 cleanup proof.
- Six business payloads retain names and shapes: desktop:navigate, desktop:notice, desktop:file-drop, purchase:analysis-start, purchase:analysis, purchase:analysis-error. All senders use the Main public Channel; no broadcast fallback.
- Channel registration requires the injected Main caller. Epoch replacement, unmount/pagehide cleanup, reload/navigation and Main retirement invalidate old delivery leases. Purchase completion checks both its existing analysis generation/cancel state and the captured Main lease.
- Sender retains 16MiB/8192-frame bounds, UTF-8 chunks <=2048 bytes and each serialized frame <8192 bytes. This preserves the audited Tauri 2.11.5 direct-send path rather than its shared large-message fetch queue. Send success is not frontend processing acknowledgement. Already scheduled eval cannot be recalled.
- Dashboard v2 layout, Finance suspension, menus and business payload handling are preserved; only the receiver transport is migrated. No second window or Surface listener is registered.

## Verification performed

| Check | Result | Scope |
|---|---|---|
| Rust lightweight offline harness | 102 passed | Directly imports production caller identity, lifetime/origin, event identity and Channel state modules; 62 command cases inspect adapter source then exercise pure allow/deny dispatch with synthetic side-effect counters |
| Existing frontend full regression | 185 files / 1222 tests passed; exit 0 | `vitest run --no-cache --maxWorkers=2` |
| Focused Channel/receiver tests | 4 files / 22 tests passed | Subset included above; Tauri Channel/invoke mocked |
| Finance QA config/isolation regression after adapter cleanup | 2 files / 8 tests passed | Existing QA identity/config contracts |
| Node security source contracts | 5 passed | Command routing, ACL coverage, no broadcast, unique command macros, QA scope |
| TypeScript | exit 0 | `node node_modules/typescript/bin/tsc --noEmit` |
| Scoped rustfmt and git diff --check | exit 0 | New Rust files and build.rs; no broad business-code reformat |
| Independent reviews | Scoped PASS across goal, quality, security, QA and context | Static/lightweight scope only; macro duplicate discovered and fixed before final review |
| Full Rust Library / all-target Cargo / generated ACL | NOT RUN | No reusable current app target; large Tauri/SQLCipher rebuild deferred with C: ~7.88GiB free. Small harness used ~106MiB |
| Actual Windows Main/WebView2/IPC/navigation | NOT VERIFIED | App and Native QA not run |

Local logs: `.omo/evidence/c0/` (ignored, synthetic only). Rust invocation: `cargo test --offline --locked --manifest-path .omo/evidence/c0/rust-harness/Cargo.toml --jobs 2`. This harness is a local verification artifact, not the application Library test target. The copied Tauri ResourceTable/Channel integration tests are present but NOT executed by the pure harness.

Runtime audit hypotheses: (1) forged matching labels/resource substitution could execute effects — pure guard cases reject them before synthetic credential/file/network/state counters or future construction; (2) reload/retirement could admit stale work — generation tests and new completion tests reject old values while explicitly retaining admitted effects; (3) Channel replacement/cleanup/framing could leak or reorder payloads — Channel state and frontend framing/subscription tests pass. These are Synthetic observations, not native observations.

## Remaining blockers before Surface/native activation

1. Compile the complete production and QA Tauri targets and verify generated/merged ACL with adequate disk or separately approved CI; check real bootstrap/session restore callback ordering.
2. Resolve/verify plugin/core lifetime policy and queued invoke/eval/navigation races. No complete per-document authority guarantee is inferred from a resource label or this model.
3. Effective UDF/profile/override/canonical-path isolation remains unproven. No UDF or Main data-directory change was made.
4. Partial-create ownership, missing-returned-handle cleanup and backend registration release remain separate adapter work. Nothing in C-0 claims Tauri HWND ownership.
5. Destroyed/resource absence cannot prove complete OS/WebView2 cleanup. Keep CleanupUnknown and replacement blocked until independently observed. Native A+B cannot substitute for Tauri cleanup.

## Git and protection

Local and remote branch remain at the requested checkpoint. Changes are unstaged/uncommitted. No commit/push/merge/Release/Actions, actual app/Native QA, second WebView, Explorer query or user-data access occurred. Reference 9B worktree is clean. Original OneDrive worktree retains its pre-existing Cargo.toml modified marker with empty content diff. This branch changes neither Cargo.toml/Cargo.lock nor package manifests/lockfile, Finance storage/codec/snapshot/transfer, operating identifier, installed 0.2.2 or historical QA Evidence.

## Changed file inventory

- `docs/DESKTOP_SURFACE_C0_VERIFICATION.md`
- `docs/DESKTOP_SURFACE_V2_INTEGRATION.md`
- `scripts/main-boundary.contract.mjs`
- `src-tauri/build.rs`
- `src-tauri/capabilities/default.json`
- `src-tauri/main_command_manifest.rs`
- `src-tauri/permissions/main-commands.toml`
- `src-tauri/src/ai.rs`
- `src-tauri/src/ai_generation.rs`
- `src-tauri/src/auth.rs`
- `src-tauri/src/chatgpt/commands.rs`
- `src-tauri/src/desktop_surface/mod.rs`
- `src-tauri/src/launcher.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/main_caller.rs`
- `src-tauri/src/main_caller_command_tests.rs`
- `src-tauri/src/main_caller_identity.rs`
- `src-tauri/src/main_caller_identity_tests.rs`
- `src-tauri/src/main_caller_tests.rs`
- `src-tauri/src/main_channel.rs`
- `src-tauri/src/main_channel_state.rs`
- `src-tauri/src/main_channel_state_tests.rs`
- `src-tauri/src/main_channel_tests.rs`
- `src-tauri/src/main_channel_transport.rs`
- `src-tauri/src/main_commands/ai.rs`
- `src-tauri/src/main_commands/ai_generation.rs`
- `src-tauri/src/main_commands/auth.rs`
- `src-tauri/src/main_commands/chatgpt_commands.rs`
- `src-tauri/src/main_commands/desktop_surface.rs`
- `src-tauri/src/main_commands/launcher.rs`
- `src-tauri/src/main_commands/lib.rs`
- `src-tauri/src/main_commands/meal.rs`
- `src-tauri/src/main_commands/my_finance_commands.rs`
- `src-tauri/src/main_commands/my_finance_qa.rs`
- `src-tauri/src/main_commands/notifications.rs`
- `src-tauri/src/main_commands/official_document_import.rs`
- `src-tauri/src/main_commands/purchase_helper.rs`
- `src-tauri/src/main_commands/purchase_settlement.rs`
- `src-tauri/src/main_commands/record_helper_import.rs`
- `src-tauri/src/main_commands/weather.rs`
- `src-tauri/src/main_commands/work_folders.rs`
- `src-tauri/src/main_events.rs`
- `src-tauri/src/main_events_channel.rs`
- `src-tauri/src/main_events_identity.rs`
- `src-tauri/src/main_events_identity_tests.rs`
- `src-tauri/src/main_events_lease.rs`
- `src-tauri/src/main_lifetime.rs`
- `src-tauri/src/main_lifetime_origin.rs`
- `src-tauri/src/main_lifetime_state.rs`
- `src-tauri/src/main_lifetime_tests.rs`
- `src-tauri/src/main_security.rs`
- `src-tauri/src/main_window_events.rs`
- `src-tauri/src/meal.rs`
- `src-tauri/src/my_finance_commands.rs`
- `src-tauri/src/my_finance_qa.rs`
- `src-tauri/src/notifications.rs`
- `src-tauri/src/official_document_import.rs`
- `src-tauri/src/purchase_helper.rs`
- `src-tauri/src/purchase_settlement.rs`
- `src-tauri/src/record_helper_import/mod.rs`
- `src-tauri/src/weather.rs`
- `src-tauri/src/work_folders.rs`
- `src-tauri/tauri.my-finance-qa.conf.json`
- `src/components/dashboard/DashboardCanvas.tsx`
- `src/components/desktop/PurchaseHelperPanel.tsx`
- `src/desktop/mainChannelSubscription.test.ts`
- `src/desktop/mainChannelSubscription.ts`
- `src/desktop/mainChannelSubscriptionFrames.test.ts`
- `src/desktop/mainChannelSubscriptionFrames.ts`
