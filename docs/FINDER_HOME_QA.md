# Finder HOME isolated QA (HOME-FINDER-3)

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
