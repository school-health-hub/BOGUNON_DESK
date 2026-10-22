# Desktop Surface C-2C-2 Windows native verification

## Status and scope

C-2C-2 is a compile-only GitHub-hosted Windows verification controller for the
C-2B broker policy and C-2C-1 UDF, ownership, and cleanup contracts. It does not
create a Window or WebView, start the Tauri application, touch Explorer, inspect
an operating WebView2 profile, or publish an installer.

The immutable application source is:

`e2b73675c8662990024e69bfa12e060cc68a9440`

This source contains both C-2B and C-2C-1. The later controller commit may only
contain the dedicated C-2C-2 workflow, scripts, ACL harness, and this document.
The controller guard rejects every other delta.

## Source and controller separation

The workflow checks out two independent trees:

- `controller`: the exact reviewed dispatch SHA, with full history for the
  source-ancestor and allowlist checks.
- `source`: the immutable source SHA above, without credentials.

Every frontend command, Rust contract, Cargo check, Cargo library test, and
generated Tauri Context operation runs from `source`. The controller contributes
only verification code. The guard requires an exact repository, feature branch,
manual dispatch, expected controller SHA, workflow SHA/ref, and attempt 1 before
dependency installation or compilation.

The controller SHA must be a descendant of the immutable source. Changed paths
between the two commits are restricted to:

- `.github/workflows/desktop-surface-c2c2-native.yml`
- `scripts/desktop-surface-c2c2.mjs`
- `scripts/desktop-surface-c2c2.contract.mjs`
- `qa/c2c2-acl/**`
- `docs/DESKTOP_SURFACE_C2C2_CI.md`

`Cargo.lock` in the immutable source is not changed. The independent ACL
harness has its own lock and the controller verifies that every pinned Tauri
resolver package matches the source lock.

## Matrix and checks

Both `production` and `finance-qa` run on `windows-latest` with read-only
repository permission. The workflow performs:

1. controller/source identity and allowlist checks;
2. pinned actionlint download with SHA-256 verification;
3. controller static contract tests;
4. pinned Rust toolchain and native prerequisite checks;
5. independent `rustc --edition 2021 -D warnings --test` compilation and
   execution of `qa/c2b-contract.rs` and `qa/c2c-contract.rs`;
6. locked frontend dependency installation and existing Main boundary tests;
7. full frontend regression tests in production;
8. TypeScript checking and the matching production or Finance QA frontend build;
9. `cargo check --locked --all-targets` for the selected configuration;
10. `cargo test --locked --lib` without application startup;
11. generated Tauri ACL and capability inspection with `MockRuntime`;
12. a final assertion that the immutable source index and tracked files remain
    unchanged.

The Finance QA configuration uses the immutable source's existing QA config and
source stamp. Neither configuration accesses a finance database, DPAPI key,
backup, operating UDF, or installed application.

## Evidence boundary

Artifacts contain diagnostic JSON/JSONL only:

- Cargo check messages;
- independent contract status;
- command inventory and generated-file hashes;
- generated ACL and capability JSON;
- C-2C-2 ACL report.

No executable, installer, ZIP, target tree, release output, financial data, UDF,
or secret is uploaded. `actualWindowsWebviewRuntime` remains `NOT_VERIFIED`.
Passing C-2C-2 proves Windows compilation, library/contract tests, and generated
ACL behavior for the pinned source. It does not prove actual WebView2 effective
UDF isolation, native ownership teardown, `BrowserProcessExited`, Explorer
attachment, or cleanup receipt completion.

## Registration and execution

GitHub only registers a manually dispatchable workflow after a separately
reviewed registration entry exists on the default branch. Registration must not
change this immutable source pin or broaden the event, ref, permission, artifact,
or controller allowlist contracts.

After registration, dispatch must supply the exact reviewed controller commit as
`expected_controller_sha` on `feature/dashboard-mint-ivory-v2`. A new attempt,
different source/controller SHA, different ref, automatic event, or modified
workflow identity is rejected. This document does not authorize registration,
dispatch, runtime QA, merge, or deployment.
