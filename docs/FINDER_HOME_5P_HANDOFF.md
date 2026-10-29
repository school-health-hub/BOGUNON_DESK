# Finder HOME-FINDER-5P school-PC handoff

## Remote source and artifact identity

- Repository: school-health-hub/BOGUNON_DESK (public). Branch: codex/home-restore-finder-1.
- Validated executable source: `b17b46e8f999d5d53b52006e6fab3eeb12c77da9`.
- This handoff-only commit is newer than the executable source; do not replace the runtime
  source SHA with the documentation HEAD. No new build is needed for this document.
- Successful single CI dispatch: https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/40919061183
- Artifact: `finder-home-qa-b17b46e8f999d5d53b52006e6fab3eeb12c77da9-40919061183`.
- Artifact ID 12918142464; compressed size 14,192,880 bytes; retention 7 days;
  expires **2026-11-06 02:28:51 KST**. Verified accessible and unexpired during closure.
- Exactly three portable files: EXE (26,833,920 bytes), SOURCE_SHA.txt (41 bytes),
  ARTIFACT-MANIFEST.json (558 bytes). No operating data, authentication payload or cache.
- EXE SHA-256: `50ef6619c3000d931d7e98907c18df75961f7d7a87e1d70c4e26255f4221189d`.
- Windows x64 PE (0x8664), embedded source/identifier and manifest match. Unsigned QA binary.
- Identifier: `kr.sungandi.schoolhealthdesk.finderhomeqa`.

## Implemented versus verified

### 5M: old source 97f6892a8e904b848d107016b7e9367fe5b8bd95

One actual Windows QA launch, closed normally with no remaining matched QA/WebView2 processes.
User clicked; agent observed subsequent Windows AX state. Finder renders; synthetic URL
registration/invalid rejection/duplicate prevention, library save/reload/duplicate save/memo,
JSON export/import, and actual OfficialDocumentPanel draft handoff passed. User reported no
additional inaccessible controls at reduced size. No actual AI or provider requests.
Library layout and metadata duplication in draft were defects; restart and damaged-file
recovery were NOT RUN. Original evidence remains local; this is a derived summary, not originals.

### 5N: source b17b46e8f999d5d53b52006e6fab3eeb12c77da9

Shared library title/URL summary used in QA and production; wrapping controls and separate
memo/JSON groups. Finder sends numbered content to existing document generator so video URL
is not inserted twice. Teacher editing retained; no storage/schema/auth changes.
Offline regression 180 PASS, final handoff assertions 8 PASS, QA 13 PASS, paths 2 PASS,
TypeScript/build/diff PASS. Rustfmt FAIL only in unchanged baseline Rust files;
no unrelated autoformat. See `docs/FINDER_HOME_5N_VALIDATION.md` for exact scenarios and commands.

### 5O: CI verification, no EXE launch

NASM 2.16.03 hash/version, Perl, MSVC, npm ci, 16 contracts, QA unit runner, TypeScript,
frontend and Cargo --locked --offline Windows compile/link passed. E0428 occurrences 0.
Native step 14m51s. Full 180-test regression and Rustfmt are not steps in this workflow.
QA wrapper exposes PASS but not test count in retained job log; no new count inferred.
New EXE GUI/layout/restart/recovery remain NOT RUN. Existing 5M binary does not contain fixes.

## Dependency-complete inventory for next step

| Dependency | Preservation / receiving-PC requirement |
|---|---|
| Source, tests, scripts, lockfiles, configs, design rules | Tracked on Finder remote branch; executable source pinned above |
| Decisions, blockers, scenarios | This document, docs/FINDER_HOME_5N_VALIDATION.md, docs/FINDER_HOME_QA.md |
| Approved portable EXE + source + manifest | Existing GitHub Actions artifact above; authenticated download before expiry |
| Original 5M screenshot/AX/launch record/library | Local only, protected, not uploaded; not needed for fresh synthetic 5P, original-history audit unavailable on school PC |
| Original 5N RED/GREEN logs and frontend bundle/cache | Local only; check recipes tracked; no cache needed to use existing EXE |
| Original 5O job log/request/verification | Local only; run metadata and sanitized results above; no raw log transfer |
| Old runtime WebView2 profile/auth or operating data | NOT required; never copy or use operating AppData |
| School Windows x64, WebView2, usable D:/E: QA root, permissions/free space | Machine-local prerequisites; NOT verified on receiving PC |

Home originals are under `E:/BOGUNON_DEV/qa-output/`:
`finder-home-qa-ci-97f6892-5l` (5M), `finder-home-qa-97f6892-5m` (runtime),
`finder-home-qa-5n-offline` (5N), `finder-home-qa-ci-b17b46e-5o` (5O).
Local closure inventory hashes referenced evidence/data/artifacts without changing originals.
Do not infer that these home E: paths exist at school. They are not Git dependencies for
fresh synthetic QA. If exact original evidence or old-runtime replay is required, stop for
an approved secure transfer route; no originals, credentials, EXE, caches or raw logs in Git.

## School PC restore / 5P preparation (requires separate execution approval)

1. Inspect existing repository/worktrees/dirty state and global/project instructions. Preserve
   school work. Fetch origin only after concurrency check; use a suitable separate clean
   Finder checkout. Do not reset, clean, stash or switch an occupied branch.
2. Read this handoff at the remote documentation HEAD and preserve exact EXE source identity.
   Inspect source b17b46e when checking behavior; do not dispatch another build automatically.
3. Download to a fresh approved local folder (never overwrite an existing executable):
   ```powershell
   gh run download 40919061183 --repo school-health-hub/BOGUNON_DESK --name finder-home-qa-b17b46e8f999d5d53b52006e6fab3eeb12c77da9-40919061183 --dir <fresh-portable-folder>
   Get-FileHash -LiteralPath <fresh-portable-folder>/bogunon-desk-finder-home-qa.exe -Algorithm SHA256
   ```
4. Require exactly the three files, source/manifest/hash/PE match. No EXE launch until 5P
   approval. If artifact expired/inaccessible, report BLOCKED; do not rebuild unapproved.
5. Node 22.23.3 can run the tracked preparation script; CI build used Rust 1.98.1, but Rust
   and a local Native build are not required for EXE QA. WebView2 and GUI permissions must
   be checked without bypassing Windows security prompts.
6. Prepare a fresh allowed direct child of `D:/BOGUNON_DEV/qa-output` or
   `E:/BOGUNON_DEV/qa-output`, named `finder-home-qa-<unique-name>`. No C: fallback,
   junction, symlink, traversal, operating path, old-source marker or profile reuse.
   ```powershell
   $env:BOGUNON_FINDER_HOME_QA_RUNTIME_ROOT='<approved-fresh-D-or-E-root>'
   node scripts/prepare-finder-home-qa-runtime.mjs b17b46e8f999d5d53b52006e6fab3eeb12c77da9
   ```
   Script validates owner/source; runtime library is `data/<identifier>/education-video/`
   under that root, WebView2 is `webview`. Process TEMP/TMP must also remain in approved QA space.
7. After explicit 5P launch approval, inspect updated layout and single-occurrence draft
   metadata using only synthetic `https://www.youtube.com/watch?v=QAoffline01`. No real
   search, authentication, model lookup, external URL, AI generation or submission.
8. Restart/recovery need specifically approved launches and a separate disposable QA copy;
   follow 5N scenarios, never damage the original 5M library or operating files.

Both external dispatch flags remain false; no updater/deep-link/autostart production flow.
QA Native commands remain local library allowlist only. No build, dispatch or app launch
was performed in this closure audit. No other worktree/session was modified or terminated.

## Closure verdict and security limits

Git synchronization is verified separately from handoff readiness. **PARTIAL** overall:
remote source/document/artifact inventory and home download/hash check verified; school-PC
restore, D/E root, WebView2 and GUI access are unverified. Fresh 5P can be prepared from remote
source and artifact without original home evidence, subject to checks/approval above.
Original-history audit and exact old-runtime replay cannot be completed at school from Git.
Dedicated secret scanner unavailable; intended single-document staged package receives
best-effort secret/PII pattern and manual inspection. Original evidence is not repackaged or
uploaded. Existing background sessions are left running; this audit covers Finder only.
