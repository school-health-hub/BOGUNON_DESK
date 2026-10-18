# Remaining custom-command boundary verification

Baseline: branch `codex/desktop-surface-core-9b2a`, HEAD `20f165aa720569e04400686fe858ada385575c4d`, clean. Scope: 38 remaining registered custom-command wrappers, direct Synthetic tests and inventory/event-audit documentation. No Surface permission added. All 48 custom commands are now Main-only; the prior 10 auth/ChatGPT implementations are unchanged.

## Implementation and compatibility

Each new entrypoint receives Tauri-injected `caller: tauri::Webview`, then immediately calls existing `main_caller::run` or `run_async`. No JS caller label/token is trusted. The unchanged guard compares setup-pinned private Arc identities in BOTH Webview and hosting Window resource tables with caller and current registered Main. Labels are roles, not lifetime identity. Main rebinding/recreation remains unsupported.

Original operations remain inside the admitted closure; async futures are constructed only after admission. Existing frontend argument names, values, error strings and DTO serialization remain unchanged. Previously raw void/u64/probe returns use Result with the same serialized success value. Existing typed `CommandError::Existing` is untagged; rejection is the non-sensitive typed caller_guard error. No login requirement was added, preserving initialization and pre-login restoration. Trusted tray/startup/native callbacks keep their original Rust helpers. Authorization is an admission snapshot; it does not cancel already-admitted work.

## Executed verification

External logs: `C:/Users/Public/Documents/BOGUNON-command-boundary-output`.

- Independent source-bound Synthetic harness: **63 passed / 0 failed**, rebuilt and executed by independent QA (`qa-command-tests.exe`). Includes 48 named command cases, registry/definition/case reconciliation, and 14 pre-existing production identity-policy tests. Each case tests valid Main plus non-Main label, same-label different Webview/window and replaced registered Main Webview/window: 288 command/scenario combinations.
- Each command case verifies its actual source signature and first statement, then exercises the shared production identity and dispatch code. Rejection preserves zero simulated credential/file/network/state effects, and async future factory count zero. This does NOT invoke actual Tauri commands or real sensitive dependencies; runtime WebView admission remains unverified.
- Red run before the parent-owned ten wrappers: 52 passed / 10 failed, correctly reporting missing injected caller/guard (`red.log`). Final isolated harness passes all 63 after the inventory check was added.
- Safe full Library regression: **349 passed / 0 failed / 1 filtered**, exit 0 (`library-final.log`, `library-final.exit`). Filter: `current_windows_shell_probe_returns_a_consistent_sanitized_result`, deliberately excluded to prevent Explorer access. Includes existing auth/ChatGPT/identity regressions. An initial compile caught the probe getter's raw return not wrapped in Ok; corrected without changing probe behavior. The failed compile is retained in `library.log`.
- `cargo check --offline --locked --manifest-path src-tauri/Cargo.toml --all-targets` with external target dir: exit 0 (`check.log`, `check.exit`). Existing unrelated write_json dead-code warning remains.
- Scoped rustfmt: all 38 modified command regions plus complete guard/test files pass. Whole legacy files contain pre-existing unrelated formatting differences (including ODT parsing/tests and lib.rs); these were preserved. `git diff --check` passes.
- Independent goal, code quality, security, hands-on Synthetic QA and context/wire compatibility reviews: all five PASS. Reviews are separate agent contexts, not human execution approvals.

## Runtime audit hypotheses

1. A same-label different or stale Main identity could be admitted: production policy matrix rejects every such case; private resource table tests remain in the full Library suite.
2. A denied command could perform work before admission: actual source first-statement checks plus production sync/async dispatch tests show zero simulated effects and no denied async future construction.
3. Guard wrappers could break pre-login or wire values: existing pre-login/serialization tests and full Library regressions pass; independent frontend/signature review confirms arguments and authorized return/error shapes. Actual frontend invocation remains NOT VERIFIED.

## Protected state

Historical protected artifacts: **15/15 SHA-256 match** (`protected.log`). Existing Runner/Gate/Evidence source hash inventory matches (`runner.log`). Original artifact/manifest/descriptor/static packet SHA256SUMS matches (`packet.log`). Existing Native Owner/Host/Driver and all qa/desktop-surface files, Cargo manifests/lockfiles, capability files and frontend have no diff.

Prior authorized Live records remain unchanged:

| File | SHA-256 |
|---|---|
| integrated-evidence.json | e2a3e291a572ddb5b5682a81cfe1df27a14328cfca705a6cd15156b2d1363db8 |
| integrated-run.claim | f533ef5178698ffd1a8af6c7de4bce4d6139939f56ed769790277d27f643bcfd |
| operator-record.USER-AUTHORIZED.json | 369c362659695bfb9c61cbe29853a6fc7245b942276906df86abb4f4e8ba061d |
| authorized-live.stdout.txt | 6022a9f3a1b0d96eb911efb986db1bc1d42d3ad13998e2af1fb8ffcd6818f260 |
| authorized-live.stderr.txt | 667ccd25294dbb9ac1fbd333b413bf5545959303873de860170da67c6038f371 |
| authorization-basis.USER-AUTHORIZED.md | c1efdfafd881074eb63160cbc617089560c4862c293794868783d8b5c71c203e |

## Residual scope

See command-inventory.md for all 48 implementation/frontend/effect rows and event-boundary-audit.md for existing broadcasts, unscoped native drop/close callbacks, missing recipient instance/revision contracts and plugin capability separation. These are audited, not implemented. They must be resolved before any additional production WebView is enabled. No auth/session/business/unsaved state was moved to Surface; no new event channel, projection endpoint or window was created.

No operational app, WebView, tray, Explorer, Native QA Runner, real credentials or user data was exercised. Windows caller integration, actual Main startup/login/hide/restore/tray, real dialogs/import/export and network operations remain **NOT VERIFIED**. No push or PR. Final scoped verdict: **COMMAND_BOUNDARY_READY**, not multi-window or Live approval.
