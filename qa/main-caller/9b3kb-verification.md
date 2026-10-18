# 9B-3K-B Main caller boundary verification

Baseline: `22000633ec683655255a6a013b1cc3c3865710da`, branch `codex/desktop-surface-core-9b2a`; clean before implementation.

## Implementation

Main is pinned once during Tauri setup. The guard uses the Tauri-injected Webview and private Arc identities stored separately in the real Webview and hosting Window resource tables. It checks the current registered Main and caller against those pinned identities. Labels identify roles, not lifetime identity; label-only Tauri PartialEq is not used. Main recreation/rebinding is unsupported. Authorization is an admission snapshot, not cancellation of an already admitted asynchronous operation.

Protected commands: open_auth_url, secure_session_get, secure_session_set, secure_session_remove, secure_session_clear, chatgpt_get_connection_state, chatgpt_start_sign_in, chatgpt_disconnect, chatgpt_list_models, chatgpt_generate_text.

Each command first enters the shared guard. Rejection precedes the operation closure and asynchronous future construction. Existing authorized operation bodies and existing string/DTO error wire shapes are preserved. Login state is not an admission requirement. No credential format, encryption, OAuth, loopback or deep-link changes.

## Evidence

External compiler/test logs: `C:/Users/Public/Documents/BOGUNON-9b3kb-output`.

- Production pure-policy driver: 14/14 passed (`identity-final.log`); independently rerun by QA reviewer.
- Red baseline using label-only admission: four rejection/effect tests failed (`identity-red.log`), then passed with pinned identities.
- All-target offline/locked Cargo check: exit 0 (`check-final.log`). Existing unrelated dead-code warning in worker_evidence.rs remains.
- Scoped rustfmt and git diff --check passed.
- Goal, security, code quality, hands-on Synthetic QA and context reviews: all five passed. Quality review caught an invalid test assumption that random resource IDs were equal across tables; test now verifies Arc identity and replacement at the same RID.
- Source audit: only auth.rs, chatgpt/commands.rs and minimal lib.rs registration changed among baseline tracked files. Four new guard/policy/test files and this record are added.
- Protected historical artifacts: 15/15 SHA-256 match. Existing Runner/Gate/Evidence source hash inventory matches. Prior Live Claim, Evidence and approval records preserved; no rerun.

Three runtime hypotheses checked through the pure production policy: same-label identity spoofing is rejected; denied asynchronous requests construct no sensitive future or credential/network/session effects; authorized pre-login restoration and existing error wire shapes remain available. Actual Tauri ResourceTable identity tests complement the pure policy tests.

## Limits

The Windows shell-probe unit test `current_windows_shell_probe_returns_a_consistent_sanitized_result` is explicitly excluded from Library execution because it queries Explorer. An initial unfiltered compilation was stopped before any test executable ran. No operational app, real login/credential data, HWND access, Windows creation or Native QA Runner was executed.

Actual WebView invocation, startup, tray/hide/restore and real login/ChatGPT integration remain NOT VERIFIED. Other 38 commands, capability/build.rs, global window events and business event broadcast are unchanged and still require their separate boundary work. Surface creation is not authorized or implemented.

## Final Library result

`CARGO_PROFILE_TEST_DEBUG=0 CARGO_INCREMENTAL=0 cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib --target-dir C:/Users/Public/Documents/BOGUNON-9b3kb-output/test-target -- --skip current_windows_shell_probe_returns_a_consistent_sanitized_result`: exit 0; 300 passed, 0 failed, 1 filtered out (`tests-relink.log`, `tests-relink.exit`). Includes 14 policy tests and three actual Tauri ResourceTable tests, plus existing auth/ChatGPT and other Library regressions. No real WebView or window creation is exercised by the new tests.

The first safe Library link failed with LNK1207 (incompatible PDB from interrupted compilation). That single generated PDB was moved to `incompatible-library.pdb` in the external output directory, then the same safe regression command passed. No source/test weakening or dependency changes were used to resolve it.

Final verdict: CALLER_GUARD_READY for these ten commands. This is not approval for Surface creation or complete multiwindow security readiness.
