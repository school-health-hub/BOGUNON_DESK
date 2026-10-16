# MY FINANCE — Implementation Plan (Phase 1)

Status: SQLCipher store initialization/read IPC added; Windows integrated validation pending. Income CRUD, UI and transactional restore remain gated. **Do not enter real financial data until encrypted persistence and portable backup have been implemented and tested.**

## Hard requirements
- Local-only. No Supabase, BOGUNON web, telemetry, account-settings sync, or cloud transport for financial data.
- Independent financial store, independent Rust commands, and a separate UI route/panel.
- No financial data in browser localStorage, Tauri plaintext Store, URLs, logs, or analytics.
- Work offline and preserve data across app upgrades.
- Home and school Windows PCs transfer data exclusively through encrypted portable backups.
- Never auto-merge divergent PC histories or silently overwrite current records.
- No finance data should appear in the school-work dashboard or account settings.
- Do not alter existing school workflows to implement the feature.

## Delivered in this initial commit
- Pure TypeScript income model with integer-KRW validation.
- Contract label separated from tax category, which may remain unverified.
- Annual summary based on earned year; unpaid count.
- Unit tests for amounts, dates, classifications, and summaries.
- **No storage, backup, UI integration, or encryption yet.**

## Implementation gates
1. Validate SQLCipher / Rust bindings on Windows MSVC, including NSIS packaging and updates.
2. Add dedicated encrypted SQLite database under app_local_data_dir, with per-install random DB key protected by Windows DPAPI (user scope). Do not log secrets.
3. Implement portable backup format with versioned encrypted envelope, Argon2id KDF, authenticated encryption, and separate backup password. Encrypt all metadata that could reveal financial details.
4. Restore into a temporary staging area; authenticate, validate version/integrity, compare dataset and lineage, snapshot current data, then atomically switch or rollback. Re-encrypt using destination PC key. Do not overwrite on divergence.
5. Implement Rust commands and React MY FINANCE panel; make it reachable through a local-only launcher without adding finance data to existing account sync.
6. Add recurring contracts, expected vs paid reconciliation, evidence attachments (encrypted), tax-year export, and only then investment tracking.

## Acceptance tests
- Offline CRUD and restart persistence.
- DB not readable in plaintext; encrypted attachments.
- Backup requires correct password; tamper/wrong password leaves current data unchanged.
- Cross-PC restore succeeds without copying DPAPI blobs.
- Stale, diverged, wrong-dataset, unsupported-version restores are blocked.
- App upgrade, reinstall, and crash recovery are covered.
- Existing desktop app regression suite and Windows release build pass.
- Network inspection confirms finance payloads are never sent remotely.

## Required validation
`npm test`, `npx tsc --noEmit`, `npm run build`,
`cargo test --manifest-path src-tauri/Cargo.toml`,
`cargo check --manifest-path src-tauri/Cargo.toml`,
Windows NSIS build and a real two-PC restore rehearsal.

## Privacy caution
A managed school PC may have administrative access, backup agents, or organizational restrictions. Check school policy before storing personal finance records there; encryption alone does not eliminate these risks.

## SQLCipher app integration (cloud trial, 2026-10-16)

- App dependency: `rusqlite 0.37` with `bundled-sqlcipher-vendored-openssl`. The same SQLCipher/Rust binding as the successful MSVC spike now statically includes OpenSSL so the app does not require the runner's external crypto DLL. Startup verifies `cipher_version` and reads the schema before writing; plain SQLite and wrong keys fail closed.
- Explicit `my_finance_load_snapshot` Tauri command and local-only TypeScript repository. No automatic invocation from dashboard/account sync; no browser persistence fallback. No CRUD/restore command is exposed in this step.
- Windows app-local `my-finance/finance.db` contains the existing schema-v2 snapshot inside an encrypted singleton row. Internal database schema version is separate (`user_version=1`); unknown versions are rejected without migration.
- A random 256-bit per-install key is protected with DPAPI User scope in `key.dpapi`, atomically installed without overwriting an existing key. Missing/corrupt/unprotectable keys do not reset existing data. Non-Windows calls fail closed.
- SQLCipher uses memory temporary storage, disabled mmap, secure deletion and encrypted rollback journals. Serialized buffers and key material use zeroizing wrappers. No finance payloads, passwords or keys are logged by the application.
- Backup envelope/codec/lineage rules remain unchanged. Existing portable backups still require staged, conflict-checked, atomic restore before they can be used through the app; no direct overwrite path was added.
- Windows Actions now tests the real app modules (including DPAPI restart/key-loss checks), runs locked Cargo check and builds the integrated Tauri executable without installer creation or publishing. The independent SQLCipher spike remains intact.
- Synthetic tests cover encrypted file contents, persistence/reopen, wrong/no key, plain database rejection, malformed snapshot, unsupported DB version, and compatibility with the existing portable backup codec.

Do not mark the Windows integration gate complete until the new commit's Actions run succeeds. Full offline CRUD, backup-file export/restore UI, two-PC rehearsal and crash/upgrade QA remain outstanding; do not use real financial records yet.

### Cloud trial validation record (PR #14 / issue #15)

- Starting checkout: `work` at `5cec64358436c148710499b5aa9d2e78c34e0136`. Fetched and switched to `feature/my-finance-phase1` at remote/PR head `4e1ff6b58993a93d6f5e69ea1f84fbc364ddbe7a`; preserved all existing PR commits. No main commit, merge or deployment.
- `npm test -- --maxWorkers=4`: 161 files / 974 tests passed.
- `npm run build`: TypeScript and Vite passed; existing bundle-size warning remains.
- Linux isolated Rust harness importing the repository's snapshot, backup, codec and SQLCipher store modules: 18 tests passed, including synthetic income persistence/portable-backup roundtrip; repeated successfully with vendored/static OpenSSL. This is not a full Tauri or Windows test result.
- Cargo metadata with `--locked --offline --no-deps` and `git diff --check`: passed. Updated lockfile adds previously unresolved crypto dependencies as well as SQLCipher; no existing dependency versions removed.
- Required Windows DPAPI and integrated app build results must be obtained from the new commit's `MY FINANCE verification` Actions run. No claim of Windows success is made by this local record.
- At validation time GitHub API access returned HTTP 403, blocking PR comments/check-status API calls. `api.github.com` was added to the cloud environment network draft only; applying settings and confirming API authorization remain necessary to record results directly in the PR conversation.
