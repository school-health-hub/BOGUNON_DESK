# MY FINANCE — Implementation Plan (Phase 1)

Status: feature branch started; domain model only. **Do not enter real financial data until encrypted persistence and portable backup have been implemented and tested.**

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
