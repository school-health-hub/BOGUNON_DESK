# HOME-FINDER-5N offline checkpoint and next GUI scenarios

## Scope and evidence

Base: 97f6892a8e904b848d107016b7e9367fe5b8bd95.
The HOME-FINDER-5M report and synthetic AX evidence were read at
`E:/BOGUNON_DEV/qa-output/finder-home-qa-ci-97f6892-5l/`.
Original files, EXE, manifest and QA data must remain unchanged.

QA LibraryTools was outside `.aiv-finder`, so scoped input/button styling did not apply.
It now uses the existing Finder controls and separated wrapping action groups.
LibraryEntrySummary is used by both QA and production LibraryPanel, with inert wrapping URL text.
No library schema, storage implementation, ownership check or external transport was changed.

Finder previously passed plain metadata lines as mainContent. The existing document generator
used those lines in both its purpose sentence and detail section. Finder now supplies numbered
structured lines, using the generator's existing structured-content branch. URL remains editable
and appears once in the body. The normal document generator and submission paths are unchanged.

## Future approved native tests — NOT RUN in 5N

### Restart persistence
1. Build and verify a separately approved EXE and source/hash manifest.
2. Use a fresh allowed D/E runtime root with its own exact source/identifier ownership marker.
   Do not reuse the 5M marker for a new source SHA and do not copy WebView/authentication profiles.
3. Import a synthetic-only exported library into that fresh root; save a unique QA memo.
4. Record library hash, item count, URL and memo. Close normally, verify process exit.
5. With separate launch approval, reopen the same EXE and same owned root; reload library.
6. PASS only if item count, URL and memo remain. No operating AppData access.

### Damaged JSON and backup recovery (separate disposable QA copy only)
1. Use another fresh allowed root prepared for that exact EXE SHA. Never alter 5M data/evidence.
2. Import synthetic data, save twice to create a valid backup; close and verify exit.
3. Inventory and hash the test root's primary/backup files. Preserve intact originals in the
   approved evidence directory. Only after explicit damage-test approval replace the disposable
   primary JSON with truncated JSON; leave backup untouched. Never alter ownership markers.
4. Relaunch only with approval. Record safe error or recovery notice, item count and memo.
5. Test backup recovery, then a separate both-invalid scenario: safe error, no silent empty
   overwrite. Record original and resulting hashes; do not claim recovery without data evidence.
6. These native tests are not equivalent to browser localStorage/remount or malformed-import tests.

## Safety and known remaining work

Both external dispatch flags remain disabled. No AI, YouTube or Supabase request is authorized.
Native compile, EXE launch and GUI visual validation: NOT RUN. No Actions dispatch/rerun.
Invalid-URL add-button enabled state observed in 5M is outside these two approved fixes.
Existing teacher editing, library JSON version 2 and synthetic boundaries are retained.

Offline command recipes (process-only output root and TEMP/TMP on E:):
```
node node_modules/vitest/vitest.mjs run --config vitest.finder-home-regression.config.mjs --maxWorkers 1
node node_modules/vitest/vitest.mjs run --config vite.finder-home-qa.config.mjs --maxWorkers 1
node node_modules/typescript/bin/tsc --noEmit
node --test scripts/finder-home-qa-paths.test.mjs
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
git diff --check
```
Native compile and actual Windows rendering require a later approval, including a new CI build
and hash/source verification. Existing 5M EXE does not contain these changes.

## Offline results

- RED: new body URL regression failed before fix (URL appeared twice).
- GREEN: final Finder/document regression 19 files / 180 tests PASS; confirmed-metadata
  handoff follow-up 8 tests PASS. QA components/isolation 4 files / 13 tests PASS.
- TypeScript exit 0; QA frontend bundle build exit 0 (uncommitted working source,
  base SHA stamped with sourceDirty:true, not a release artifact).
- QA path contracts 2 PASS. `git diff --check` PASS.
- Rustfmt --check exit 1: pre-existing formatting in lib.rs, official_document_import.rs,
  purchase_helper.rs and record_helper_import/mod.rs. `git diff --quiet` against base for
  all src-tauri exited 0; no Rust source or Native configuration was changed. Do not fix
  those unrelated files here. Native compile and GUI remain NOT RUN.
- Evidence logs: `E:/BOGUNON_DEV/qa-output/finder-home-qa-5n-offline/logs/`.
  These local generated logs are not committed; the commands above reproduce checks.
- Static goal/code/security/context review found no blockers. Dedicated secret scanner
  unavailable; scoped source and staged diff receive best-effort pattern inspection.
- Outcome CONDITIONAL: approved offline implementation complete; baseline Rustfmt failure
  and actual Windows visual/restart/recovery validation remain explicitly unresolved.
