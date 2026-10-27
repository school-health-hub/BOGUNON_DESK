# Desktop Surface S-2H-10 handoff

## Checkpoint

- Repository: `school-health-hub/BOGUNON_DESK`
- Branch: `integration/desktop-surface-s2`
- Implementation commit: `ada1ebddadcf883378f6e0025ba366c1738a33e4`
- Baseline: `97ea05f6254d0189b523b89780f5c638be402ba6`
- CI: [Run 40463815139](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/40463815139) — SUCCESS
- Actual Windows QA execution at this checkpoint: **NOT RUN**
- Actual WebView2 rendering and cleanup: **NOT_VERIFIED**

## What changed

The previous QA run proved only that `main_lifetime::install()` failed. Its old
single error erased the failing precondition, so the exact root condition is
still **NOT_VERIFIED**. S-2H-10 deliberately does not reorder navigation or
weaken origin checks. It adds typed lifetime installation errors and maps them
to fixed, non-sensitive QA diagnostic codes.

Changed files:

- `src-tauri/src/main_lifetime.rs`
- `src-tauri/src/main_security.rs`
- `src-tauri/src/main_security_tests.rs`
- `src-tauri/src/desktop_surface_qa.rs`
- `src-tauri/src/qa_main_startup_diagnostic.rs`
- `src-tauri/src/qa_main_startup_diagnostic_tests.rs`
- `src-tauri/tests/desktop-surface-qa-contract.test.mjs`

Diagnostic codes:

- `lifetime_state_missing`
- `lifetime_main_config_missing`
- `lifetime_app_url_invalid`
- `lifetime_main_webview_missing`
- `lifetime_webview_url_unavailable`
- `lifetime_origin_mismatch`
- `lifetime_state_unavailable`
- `lifetime_already_installed`
- `lifetime_resource_registration_failed`

The codes contain no URL, path, token, capability, PID, SID, or user data.
Surface Host launch remains after all three Main security installation stages,
so Host launch and OpenMain remain unavailable before lifetime installation.

## Verification

Local:

- Surface tests: 24/24 PASS
- Surface production build and TypeScript: PASS
- Portable QA packaging tests: 37/37 PASS
- QA boundary contract: 4/4 PASS
- `git diff --check`: PASS
- Local Main Rust test: NOT RUN because the school PC lacks the Perl setup
  needed by vendored OpenSSL; this is covered by Windows CI instead.

Windows CI (`windows-2022`, exact source SHA):

- QA isolation contracts: PASS
- TypeScript and Surface frontend build: PASS
- Main `cargo check --locked --all-targets`: PASS
- Main library tests: PASS
- QA Main release build: PASS
- Surface Host tests and release build: PASS
- Portable package, manifest, allowlist, and artifact upload: PASS

## Portable QA artifact

- Artifact ID: `12716807427`
- Artifact name: `desktop-surface-s2f1-portable-qa-ada1ebddadcf883378f6e0025ba366c1738a33e4-40463815139`
- Retention expiry reported by GitHub: `2026-11-03T07:24:49Z`
- ZIP size: `17172335` bytes
- ZIP SHA-256: `c030835a5111587bde3cc1ae753ad90c0d445460386cebe53fb974dd7958d2f2`
- Manifest source SHA: `ada1ebddadcf883378f6e0025ba366c1738a33e4`
- Manifest file hashes: 16/16 verified after download
- QA identifier: `kr.sungandi.schoolhealthdesk.surfaceqa`
- Synthetic data only; operating data access and external network are disabled

Restore before artifact expiry:

```powershell
gh run download 40463815139 --repo school-health-hub/BOGUNON_DESK `
  --name desktop-surface-s2f1-portable-qa-ada1ebddadcf883378f6e0025ba366c1738a33e4-40463815139 `
  --dir <new-empty-directory>
```

Compare every file to `ARTIFACT-MANIFEST.json` and `SHA256SUMS.txt` before use.
The school-PC copy is supplemental only; the GitHub artifact plus this document
is the approved cross-PC transfer path.

## Home-PC restore

Inspect the existing checkout first; do not reset local work:

```powershell
git status --short
git branch --show-current
git fetch origin --no-prune
git rev-parse origin/integration/desktop-surface-s2
git merge --ff-only origin/integration/desktop-surface-s2
```

The expected remote checkpoint after this handoff document is the commit that
contains this file; verify that commit is a descendant of implementation commit
`ada1ebd`.

## S-2H-11 single GUI run

1. Restore the artifact into a new non-operating QA directory and verify all
   hashes and manifest flags.
2. Confirm no QA Main or Surface Host process is running.
3. Preserve any prior Main/Host diagnostic JSON under a separate evidence path.
4. Manually start `bogunon-desk-surface-qa.exe` exactly once. Do not retry.
5. If it exits, record the new fixed `failureCode` verbatim. Do not infer the
   root cause from the stage alone.
6. If Surface appears, capture the six widgets and test Quick Launcher once.
7. Close QA processes and record Main/Host diagnostic fields, WebView2 children,
   QA UDF residue, and CleanupReceipt/CleanupUnknown.

Do not enable WorkerW, access operating AppData, connect external services,
change system security settings, or use operating user data.
