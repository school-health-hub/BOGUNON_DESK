# Finder HOME isolated QA (HOME-FINDER-3)

> HOME-FINDER-5B supersedes the historical HOME-FINDER-3 reproduction/path
> instructions below. See the current portable build/runtime contract at the end.

## Scope and boundary

This is an offline-only QA entry, not the production Dashboard or a live search client.
The base is `25e5a5c021ad1bc0d6e53699ae646dc9f71bd51e` on
`codex/home-restore-finder-1`. Production Finder/document components, their parsers,
authentication files, operating installation, both lockfiles and Proxy are preserved.

- Identifier: `kr.sungandi.schoolhealthdesk.finderhomeqa`
- Future binary: `bogunon-desk-finder-home-qa.exe`
- Frontend: `qa/finder-home/index.html` → one-way network guard → dedicated React entry.
- Workflow: actual `AiVideoFinder` → deterministic document generator/session → actual
  `OfficialDocumentPanel`. Existing draft replacement confirmation is retained.
- The only fixture video ID is `QAoffline01`. Its URL and metadata are synthetic,
  unverified and unsuitable as a real video recommendation. Other IDs/live metadata
  are rejected by QA storage boundaries. Use no personal data.
- AI, OAuth, model lookup, Supabase, real search and URL opening are disabled.
  Inert context aliases replace account providers. No production startup/sync mounts.
- Browser fetch permits only the fixed local IPC origin and eight allowed commands;
  other browser transports, new windows and external anchor navigation are blocked.
- Native feature `finder-home-qa` selects a separate builder, with no plugins, tray,
  updater, autostart, deep-link or single-instance registration. Only seven existing
  local library operations and `finder_home_qa_metadata` are registered. Empty core
  capability permissions prevent unrelated plugin/window operations.
- Embedded local bundle only; strict CSP and native navigation/new-window handlers
  provide independent boundaries. Production dispatch settings are not enabled.

## Dedicated E: paths

`BOGUNON_FINDER_HOME_QA_OUTPUT_ROOT` is mandatory. It must be a direct child of
`E:/BOGUNON_DEV/qa-output` named `finder-home-qa-<run-id>`. There is no C: fallback.
The root must have a bounded, regular `.finder-home-qa-owner.json` matching the
identifier and this worktree. Existing unowned paths, junctions and symlink ancestors
are rejected. Do not copy another feature's output marker.

Within that root:

| Relative path | Purpose |
| --- | --- |
| `dist` | QA frontend and `qa-build.json` provenance |
| `cache` | Vite/test and child-process cache |
| `temp` | Child TEMP/TMP/TMPDIR |
| `logs` | Local-only offline verification evidence |
| `target` | Reserved dedicated Cargo target, unused in HOME-FINDER-3 |
| `webview` | Future absolute WebView2 UDF |
| `data/kr.sungandi.schoolhealthdesk.finderhomeqa/education-video/library.json` | QA-only local library |
| `environment` | Empty Vite env directory; production `.env` files are not loaded |

Native library wrappers reuse the existing versioned store/atomic backup/recovery
implementation at the fixed E: path, never `app_local_data_dir()` or operating
AppData. IPC does not accept filesystem paths. Each call checks ownership and links.
Import/Export uses JSON text, not a filesystem-dialog plugin. The browser fallback
is test-only jsdom storage, isolated by the QA WebView origin/UDF at runtime.

## Reproduce offline verification

Prerequisites verified on this PC: Node 22.23.3, npm 10.9.9, Rust/Cargo 1.98.1;
installed dependency versions come from the unchanged `package-lock.json`.
No installation is authorized by this workflow. This worktree's ignored
`node_modules` junction reuses the existing matching dependency directory read-only.
It is machine-local, not a portable handoff artifact. Verify matching lockfiles and
installed tools on another PC before recreating a dependency link.

PowerShell (use a fresh run ID for every frontend build; nothing is erased):

```powershell
$env:BOGUNON_FINDER_HOME_QA_OUTPUT_ROOT = 'E:/BOGUNON_DEV/qa-output/finder-home-qa-<new-run-id>'
node scripts/verify-finder-home-qa.mjs paths
node scripts/verify-finder-home-qa.mjs unit
node scripts/verify-finder-home-qa.mjs regression
node scripts/verify-finder-home-qa.mjs types
node scripts/build-finder-home-qa-frontend.mjs
git diff --check
```

Run sequentially to avoid competing CPU/memory-heavy test jobs. Each verification
process writes a new timestamped log/status JSON in its own `logs` directory and
has a four-minute bound. `regression-focus` reruns only the existing synthetic
auto-search contract tests. No task invokes a real provider.

The frontend builder refuses a nonempty `dist` and emits parent HEAD plus an
explicit `sourceDirty` flag. A dirty-source frontend is **not** an executable built
from the later checkpoint SHA. Before a separately approved native build, use the
clean checkpoint, a fresh output root and rebuild the frontend. Preserve previous
evidence rather than clearing directories.

## Native verification remains separately gated

HOME-FINDER-3 does not compile/link Rust, build an EXE or launch any GUI. Rust source
format/syntax inspection and cached Tauri API comparison do not prove native IPC,
Windows filesystem atomicity, navigation blocking or UDF runtime behavior.

Before requesting a native build/run approval:

1. Verify clean checkpoint, sufficient E: space and no competing build process.
2. Verify cached dependencies offline; no install, broad cache sharing or deletion.
3. Rebuild frontend from clean HEAD into a fresh owned E: root.
4. Merge `tauri.finder-home-qa.conf.json` with an overlay setting `frontendDist` to
   that root's `dist`; select only `finder-home-qa`. Do not run a production build.
5. Set `BOGUNON_FINDER_HOME_QA_SOURCE_SHA` to the exact clean HEAD,
   `CARGO_TARGET_DIR=<root>/target`, `TEMP` and `TMP=<root>/temp`, and keep logs/cache
   on E:. The native build guard rejects a mismatch or production integrations.
6. The installed Git Bash Perl lacks `Locale/Maketext/Simple.pm`. If required,
   verify the already installed Strawberry Perl 5.42.3 and use its path only in
   the build child environment; do not change system PATH.
7. Request explicit Windows native build/GUI approval. Then verify executable
   source SHA/hash, metadata isolation, zero outbound calls, manual click flow,
   native persistence/recovery and window closure without touching production.

No cursor automation is required: future manual clicks can select the synthetic
saved candidate, choose `기안 초안으로 연결`, then return to QA Finder/library tools.
This is independent of the school's GetCursorPos permission error.

## HOME-FINDER-3 offline result (2026-10-29)

- Dedicated QA tests: 13 PASS; TypeScript: PASS.
- Existing Finder/document regression: 177 PASS and one 5-second timeout in the
  full run. The unchanged affected auto-search file subsequently passed all five
  tests alone, without increasing its timeout. Resource contention is plausible,
  not a proven diagnosis. Initial failure logs are preserved.
- Path/config/IPC source contracts: five PASS; new Rust modules: rustfmt check PASS.
- Four authored Rust synthetic-admission tests: NOT RUN (native linking deferred).
- QA frontend and production-transport bundle exclusion: PASS. The first bundle
  correctly failed because a pure validation import retained Supabase. A QA-only
  inert Supabase alias removed that dependency; production files are unchanged.
- Local evidence: `E:/BOGUNON_DEV/qa-output/finder-home-qa-20261029-hf3/logs`.
  Passing frontend bundle/evidence: sibling `finder-home-qa-20261029-hf3-bundle-v2`.
  Both are local-only, uncommitted and not uploaded.
- No installed secret scanner was found. Scoped text-pattern inspection plus human
  diff review found no secrets/obvious personal information; this is best effort,
  not proof that all confidential material can be detected.
- Native compilation, EXE, GUI, real IPC/UDF/Windows atomicity and real external
  requests: NOT RUN. Actual external AI/API requests in this stage: zero.

## Preservation

Checkpoint scope (38 files):

```text
docs/FINDER_HOME_QA.md
qa/finder-home/index.html
scripts/build-finder-home-qa-frontend.mjs
scripts/check-finder-home-qa-scope.mjs
scripts/finder-home-qa-boundary.test.mjs
scripts/finder-home-qa-paths.mjs
scripts/finder-home-qa-paths.test.mjs
scripts/verify-finder-home-qa.mjs
src-tauri/Cargo.toml
src-tauri/build.rs
src-tauri/finder_home_qa_build.rs
src-tauri/src/education_video/mod.rs
src-tauri/src/lib.rs
src-tauri/src/finder_home_qa.rs
src-tauri/src/finder_home_qa_library.rs
src-tauri/src/finder_home_qa_paths.rs
src-tauri/src/finder_home_qa_synthetic.rs
src-tauri/tauri.finder-home-qa.conf.json
src/finder-home-qa/FinderHomeQaApp.tsx
src/finder-home-qa/FinderQaWorkspace.tsx
src/finder-home-qa/FinderQaWorkspace.test.tsx
src/finder-home-qa/LibraryTools.tsx
src/finder-home-qa/bootstrap.tsx
src/finder-home-qa/boundaries.test.ts
src/finder-home-qa/env.d.ts
src/finder-home-qa/finder-home-qa.css
src/finder-home-qa/inertConnections.ts
src/finder-home-qa/inertSupabase.ts
src/finder-home-qa/main.tsx
src/finder-home-qa/metadata.ts
src/finder-home-qa/networkBoundary.ts
src/finder-home-qa/networkInstallation.test.ts
src/finder-home-qa/qaIpc.ts
src/finder-home-qa/qaLibrary.ts
src/finder-home-qa/qaLibrary.test.ts
src/finder-home-qa/syntheticFixture.ts
vite.finder-home-qa.config.mjs
vitest.finder-home-regression.config.mjs
```

Only source/config/tests and this note belong in the local checkpoint. Evidence,
frontend artifacts, owner marker, QA library/UDF, dependency junction, credentials
and caches are not committed or uploaded. No push is performed in this stage.
Receiving-PC restoration and native runtime acceptance are not claimed by this note.

## Current contract: HOME-FINDER-5B portable CI preparation

Status: implemented and offline checked only. No push, hosted workflow run,
Native compilation/link, EXE generation or application launch is authorized here.
The HOME-FINDER-4 partial target, evidence and existing operating data are preserved.

### Build paths and source identity

`BOGUNON_FINDER_HOME_QA_OUTPUT_ROOT` is build-only. A local build/verification root
must be a direct `finder-home-qa-<run-id>` child of D:/BOGUNON_DEV/qa-output or
E:/BOGUNON_DEV/qa-output. A GitHub-hosted build additionally permits a direct child
of RUNNER_TEMP only with CI=true and GITHUB_ACTIONS=true. Links/reparse ancestors,
UNC, traversal, ADS and nonowned build roots are rejected. Build marker
`.finder-home-qa-owner.json` still binds the local build workspace; it is never
distributed as runtime state. No C: local fallback exists.

The native build accepts only a manifest-relative frontend directory resolving to
the validated build dist. Windows drive-letter URLs are rejected. The embedded
frontend stamp contains SHA, identifier, dirty flag and externalConnections=false;
it contains no build workspace/output paths. Native runtime no longer uses
CARGO_MANIFEST_DIR or a compiled output-root environment variable.

### Runtime preparation (do not launch without separate approval)

The EXE requires an explicit process-only `BOGUNON_FINDER_HOME_QA_RUNTIME_ROOT`.
Only direct D:/BOGUNON_DEV/qa-output/finder-home-qa-<name> or E: equivalents are
accepted, independent of the EXE location and build PC. AppData, arbitrary paths,
runner temp, symlinks, junctions, reparse ancestors and traversal are rejected.
No automatic production fallback, operating authentication access or network path
is provided. Seven existing library commands plus QA metadata remain the entire IPC
allowlist. Plugins, provider contexts, URL opening and production startup stay absent.

After verifying the downloaded EXE hash and manifest, a later approved preparation
may use the following (the script prepares ownership only; it does not launch):

```powershell
$env:BOGUNON_FINDER_HOME_QA_RUNTIME_ROOT = 'E:/BOGUNON_DEV/qa-output/finder-home-qa-<source-short-sha>-manual-1'
node scripts/prepare-finder-home-qa-runtime.mjs <full-executable-source-sha>
```

The Native entry can also create its own marker on first separately approved launch.
An existing empty root may be claimed; a nonempty unowned root is refused.
`.finder-home-qa-runtime-owner.json` is schema 2 and binds identifier, exact source
SHA and purpose `offline-finder-runtime`. It is created exclusively and flushed;
malformed, oversized, linked, owner-mismatched or source-mismatched markers fail
closed. No marker repair, deletion or adoption is automatic.

Library: `<runtime-root>/data/kr.sungandi.schoolhealthdesk.finderhomeqa/education-video/library.json`.
WebView2 UDF: `<runtime-root>/webview`. They never use the operating profile.
Same-SHA relaunch may reuse the same explicit root and recover synthetic library
backups. A different Source SHA requires a fresh root. Old HF3/HF4 evidence, owner
markers, libraries and UDFs are not overwritten, copied or migrated automatically.
If synthetic notes must move between versions, separately approve a bounded JSON
export/import through the existing synthetic-only library validation; do not copy
an old directory/UDF or credentials wholesale. Concurrent launches sharing a root
are not approved or verified; use one instance per runtime root.

### GitHub Actions design and registration blocker

New workflow: `.github/workflows/finder-home-qa-windows.yml`, manual dispatch only,
windows-2022, Node 22.23.3, Rust 1.98.1, x86_64-pc-windows-msvc. Actions are pinned.
Source SHA is mandatory, exactly matches the dispatch branch HEAD and checkout,
and the branch is codex/home-restore-finder-1. Permissions are contents:read only;
checkout does not persist credentials, no secrets or Production environment is used.
No updater, installer, release publishing, signing, GUI/runtime step or provider call.
The workflow refuses reruns (attempt must be 1); a new run needs separate approval.

On the disposable runner only: npm ci uses the unchanged package-lock; cargo fetch
--locked downloads locked dependencies, then cargo build --locked --offline uses
one job and the finder-home-qa/custom-protocol feature. The debug portable EXE is
packaged under the QA filename. Node/Rust downloads and registry access are build
prerequisites, not application service calls. No local installation occurs in 5B.
Perl Locale::Maketext::Simple and MSVC remain required; missing tools fail closed.
HOME-FINDER-5I below supersedes the original NASM prerequisite rule with verified
portable NASM provisioning on the disposable runner only. No local installation
or shared Cargo target cache is introduced.

Artifact allowlist is exactly EXE, SOURCE_SHA.txt and ARTIFACT-MANIFEST.json;
retention is 7 days. Manifest records source SHA, identifier, run identity, EXE size
and SHA-256, synthetic-only and no-execution status. No evidence logs, databases,
UDF, credentials, target or cache are uploaded. CI compilation is not GUI acceptance.

Existing Surface workflows are feature/source-bound (latest portable uses push),
and the official-document workflow has different identity/feature plus native
execution steps. Neither is safely reusable unchanged. Registered workflow names
alone do not establish a generic dispatcher. No verified compliant main-free
dispatch path was found. GitHub documents workflow_dispatch default-branch presence:
https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow

If required, a later approval may add ONLY the same-path registration stub on main:
workflow_dispatch with source_sha input, permissions:{}, and a permanently false
job. That stub performs no checkout/build/deployment. The actual reviewed workflow
stays on the Finder branch. Main modification, branch push and Actions execution
each remain unapproved in 5B. Do not repurpose another workflow or enable push/PR
triggers to evade this restriction. Failure never falls back to local Native build.

### Offline verification and limits

Use a fresh E: build root, then the existing verification script's unit/types/
regression-focus tasks and frontend builder. Node contract command:
`node --test scripts/finder-home-qa-paths.test.mjs scripts/finder-home-qa-portability.test.mjs scripts/finder-home-qa-boundary.test.mjs scripts/finder-home-qa-ci.test.mjs`.
Portability fixtures are synthetic, created under unique dedicated QA roots and
retained (including junction-rejection fixtures); no prior evidence is erased.
Rustfmt parses/checks touched Rust. A standalone rustc --emit metadata check of
the build guard plus runtime path module, using existing cached serde_json rlib,
passed without code generation/link or an EXE. This is not a full Tauri type check;
Native link/runtime acceptance is NOT RUN. Unused-item warnings are expected in
the build-only harness because runtime methods are not invoked there.
Working-source frontend stamps intentionally report sourceDirty=true. A later CI
build must use the final clean checkpoint SHA, not the earlier development bundle.

Evidence for this stage: E:/BOGUNON_DEV/qa-output/finder-home-qa-20261029-hf5b/logs.
These are local-only, not uploaded or included in Git. No complete installed secret
scanner was found; staged and working files receive best-effort pattern scans and
diff review. This is not a complete personal-data/secrets detection guarantee.

HOME-FINDER-5B results: Node contracts 13 PASS, dedicated QA Vitest 13 PASS,
focused existing Finder search regressions 5 PASS, TypeScript PASS, frontend build
and production-transport exclusion PASS, rustfmt PASS, standalone Rust metadata
PASS, structured YAML parse/manual-trigger check PASS using already installed
js-yaml (read-only; no installation), diff-check and scoped patterns PASS.
Independent goal, code, security, QA and context review lanes passed after fixing
a Windows path-prefix case mismatch and completing this current-contract note.
Full Native build/EXE/Actions/GUI/push are all NOT RUN. No actual AI request occurred.

## HOME-FINDER-5I: pinned NASM preparation

Run 40899919707 on source 7fc68e68fc928e0e630a86f9e47ed3592296e97c failed
before dependency install/tests/Native compilation: Perl module passed but PowerShell
could not resolve `nasm`. The failed image reports win22/20261025.346. No inventory
of files outside PATH was recorded, so absence from PATH does not prove NASM was
entirely uninstalled. The current runner-images Windows2022-Readme does not list
NASM or a guaranteed NASM path. No failed run is retried in this stage.

The workflow now checks an application found on PATH and the conventional
ProgramFiles/NASM/nasm.exe candidate, reusing only the exact pinned executable
SHA-256. A different/missing candidate is never executed or overwritten. Otherwise
it downloads the portable 2.16.03 ZIP from the NASM official HTTPS endpoint with
redirects disabled; both archive and EXE hashes must match before `nasm -v` runs.
Its version must be 2.16.03. Only GITHUB_PATH for the disposable job is updated;
no installer, system PATH, registry, production environment or local tool changes.
Perl and MSVC checks, Source SHA/branch checks, artifact allowlist and app nonexecution
remain unchanged. The new source_sha must equal the new branch HEAD; the prior
7fc68e68 checkpoint remains an ancestor, not rewritten.

Provenance checked without executing a downloaded tool:

- Official archive: https://www.nasm.us/pub/nasm/releasebuilds/2.16.03/win64/nasm-2.16.03-win64.zip
- ZIP size: 513543 bytes; SHA-256 `3ee4782247bcb874378d02f7eab4e294a84d3d15f3f6ee2de2f47a46aa7226e6`.
- Entry nasm-2.16.03/nasm.exe SHA-256 `a93276636266516421cc9b422f47476c21f7a2949f1ae251556b2f1d33a3be04`.
- Independent KDE archive https://files.kde.org/craft/3rdparty/nasm/2.16.03/nasm-2.16.03-win64.zip matched the official archive hash.
- These are locally computed hashes of the official bytes, corroborated by KDE;
  they are not claimed to be a vendor-published checksum/signature.
- Runner reference: https://github.com/actions/runner-images/blob/main/images/windows/Windows2022-Readme.md

Offline checks cover existing verified tool reuse, absent-tool portable selection,
bad archive and bad EXE rejection using synthetic in-memory PowerShell probes.
The version/executable invocation is excluded from those mock tests. YAML and
PowerShell AST parsing, workflow/SHA contracts and diff/pattern checks are performed.
No Actions dispatch/rerun, NASM execution, local Native build or QA EXE launch occurs
in 5I. Hosted provisioning and compilation remain unverified until a separately
approved single run at the new checkpoint. Download failure, hash/version mismatch
or missing Perl/MSVC fails closed; no mirror fallback or automatic rerun exists.
