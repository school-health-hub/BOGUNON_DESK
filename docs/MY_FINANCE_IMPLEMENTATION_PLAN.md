# MY FINANCE — Implementation Plan (Phase 1)

Status: SQLCipher/DPAPI and transactional CRUD passed Windows validation through 53a54e7. Dedicated income management/annual summary UI added; this commit's Windows validation pending. Backup/restore and cross-PC real-use gates remain incomplete. **Do not enter real financial data until encrypted persistence and portable backup have been implemented and tested.**

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

## Transactional income CRUD

This step exposes `my_finance_list_income`, `my_finance_create_income`, `my_finance_update_income`, and `my_finance_delete_income` through Tauri and the local TypeScript repository. The existing `my_finance_load_snapshot` command stays compatible. List and mutation results contain the complete snapshot, including the next identity token.

Every mutation requires `expected: SnapshotIdentity` from a previous read and a full income entry (create/update) or UUID (delete). Updates replace an existing record by its immutable ID; duplicate creates and missing update/delete targets are errors. No upsert, automatic retry, merge, management screen, or backup restore is added.

SQLite `BEGIN IMMEDIATE` acquires the write lock before reading. The transaction compares the complete schema/dataset/revision/history identity, validates the proposed mutation, appends one random history UUID, increments revision by exactly one, and writes the snapshot payload in a single commit. Separate connections/processes with the same old identity cannot both commit. A busy connection waits at most two seconds before failing. Caller must reload on conflict and explicitly resolve the edit; it must not silently retry with a new identity.

Rust reuses the existing snapshot income validation for real Gregorian dates, nonnegative integer KRW, checked deduction summation, exact net amount, unique nonnil UUIDs, field limits, and verified tax classification. Serde rejects fractional/out-of-i64 amounts and unknown enum values/fields. New CRUD input also caps KRW at JavaScript's exact safe-integer boundary. The existing snapshot schema v2, database schema version 1, backup envelope, and restore lineage policy are unchanged. The existing 100,000 revision/history limit remains fail-closed.

All validation, conflict and database failures roll back without advancing identity or changing stored records. Mutation commands refuse a missing DB instead of silently initializing replacement data. DB path and per-install DPAPI key handling remain local and separate from school/account settings. No financial payload logging or network transport is introduced.

Synthetic regression tests cover CRUD and each reopen, edited amounts and payment date, invalid date/money/tax/JSON, duplicates/missing IDs, stale/different-dataset/diverged tokens, simultaneous independent connections, SQL statement failure, deferred commit failure, and revision limit. Windows adds DPAPI-key-preserving CRUD/reopen and a separate-process test that reloads and updates the same synthetic encrypted store; existing installer QA independently launches/relaunches the actual app. There is no finance-screen end-to-end test because that screen is deliberately out of scope.

Local validation: JavaScript 161 files / 977 tests passed; TypeScript/Vite build passed; isolated Rust core harness 27 tests passed using verified offline Cargo cache. Required Windows Rust/SQLCipher tests, integrated app build/DLL checks, and clean-install QA must pass for the pushed commit before this step is marked complete. The GitHub API remains blocked (HTTP 403), so PR checklist/comment updates require applying the previously saved `api.github.com` network allowance; do not mark them posted until confirmed.

## Income management UI and annual summary

The dashboard's top action bar now opens MY FINANCE. Its menu does not enter the account-synced Dock or workspace schema. The lazy-loaded screen is a sibling of the school/account-sync provider tree. The school workspace stays mounted but hidden/inert, retaining existing drafts; native school navigation/file-drop listeners pause while the finance screen is open. Keyboard events from finance controls do not reach school tool shortcuts. Returning restores the launcher focus.

The screen reads only `listFinanceIncome` and writes through the existing create/update/delete Tauri commands. It contains no remote client, telemetry, broadcast event, browser-storage draft, or account-setting persistence. Inputs live only in component memory until the user confirms a native write. Closing clears the finance screen's memory. Raw native errors are never displayed/logged; safe static messages distinguish a revision conflict from a failed or uncertain write. Both require explicit refresh before any further write. A dirty draft is discarded only after user confirmation; it is never silently rebased onto a new identity.

The navy/white/pastel interface provides five income kinds; source, contract, earned/paid dates; integer KRW gross/deductions/net; explicit tax category/evidence flag; and notes. Tax classification is never inferred from deductions. Confirmation dialogs gate create/update/delete, protect against duplicate submissions, trap keyboard focus, and restore focus on cancel. UTF-8 field limits and exact native payload keys are enforced before IPC; Rust remains authoritative.

Year and income-kind selection affect both the list and the four summary cards (gross, deductions, net, unpaid count). All grouping uses earned date, not payment date. Unpaid means `paidOn === null`. Twenty-row pages bound rendering without changing summary totals. Loading, genuinely empty store, no filter matches, native-store unavailable, save success/failure and stale revision have separate states. An unsafe annual sum shows no rounded total and leaves records editable. A persistent development banner states that real financial data must not be entered until backup/restore and cross-PC validation are complete.

Local evidence:
- `npm test -- --maxWorkers=4`: 164 files / 999 tests passed, including synthetic UI CRUD/confirmation/conflict/summary tests and school-draft/account-sync-boundary regression.
- `npm run build`: TypeScript + production build passed. Finance is a separate lazy chunk; the pre-existing main bundle-size warning remains.
- Chromium at 1440px and 600px: real dashboard entry, browser-only native-store guard, synthetic IPC create/update/delete/filter/summary verified; no runtime exceptions, horizontal overflow, browser-storage changes or external HTTP/WebSocket requests during finance operations. Data-URL assets are local and excluded from outbound-network counting.
- Chromium synthetic IPC verifies the renderer contract only; actual SQLCipher/DPAPI and the Windows app build/install/relaunch must pass in Actions for this commit. No production fixture data or browser fallback is shipped.

No backup/restore screen/command, cross-PC transfer, investment/asset management, main merge or deployment is part of this step. Keep Draft PR #14 and real-use readiness gates open. If GitHub API access is still HTTP 403, report code/CI results and the blocked checklist/comment update without broadening network access or replacing an unreadable PR body.
