# School PC UX-07E / UX-07F remaining physical QA entry

## Verdict and scope

Prepared on the HOME PC on 2026-11-12, after the user confirmed that this is still the home PC. No school-PC restore, monitor inventory or GUI run is claimed. UX-07E CONDITIONAL; UX-07F CONDITIONAL. Product unchanged. School physical acceptance remains NOT RUN. No full integration QA, deployment or main merge authorized.

Repository: school-health-hub/BOGUNON_DESK (public). Branch: codex/electron-h6-design-renewal. Starting checkpoint: d66fa52c21a30cb1c27d4f89de176c42dd00db63. Product source: b8b0f4647ead1639482913094b0d836a050423cc (contains UX-07E source 55e367fe3564a01ed2044b3bd757b324ae9b3b2b and subsequent F fixes). The final documentation checkpoint is the commit containing this entry; resolve with git log -1 -- docs/UX07_SCHOOL_QA_ENTRY.md. Its exact SHA and verified remote state are in the completion reply.

## Online source and previous results

All links are repository-relative and available from this remote branch:

- [E implementation and physical NOT RUN](UX07E_MULTIMONITOR_HANDOFF.md)
- [F original design and verification](UX07F_DESIGN_RENEWAL_HANDOFF.md)
- [F R3 scoped card correction](UX07F_R3_VISUAL_HANDOFF.md)
- [F R4 actual native CSV save and remaining prerequisites](UX07F_R4_HOME_FINAL_HANDOFF.md)
- [Design rules](../DESIGN.md)

These are prior reported results, not school-side original-evidence review. Existing PASS tests/captures/output acceptance must not be repeated by default. The latest R4 native CSV path passed real Windows Save As, actual 232-byte UTF-8 BOM file, two synthetic rows, cancellation preservation; no stubs. SCHOOL populated GUI and ODT save remain NOT RUN.

## Safe school source restoration

First inspect the actual school PC and candidate repositories read-only: git status --short --branch; git remote -v; git rev-parse HEAD; git worktree list --porcelain; upstream/divergence; untracked files and ongoing Git operations; disk/memory. Preserve all unrelated WIP and other worktrees. Do not reset, clean, stash, force checkout, delete worktrees or overwrite folders.

Fetch only after confirming the origin. Verify live remote HEAD against the final entry checkpoint; unexpected divergence requires inspection, not automatic pull. Reuse an appropriate clean worktree; fast-forward only when proven safe. Otherwise create a new unused QA directory/worktree after disk checks, without changing the existing working branch. If no repository is available, an authorized fresh clone of this branch into a new folder is sufficient; no external drive is required for source and these instructions.

On a receiving PC with no WIP, a new clone can be made with:

    git clone --single-branch --branch codex/electron-h6-design-renewal https://github.com/school-health-hub/BOGUNON_DESK.git BOGUNON-school-ux07-qa

Confirm actual full SHA and clean state before any build. Node 24, npm and the committed package-lock.json are the setup baseline; Electron 45.2.1 and Playwright 1.64.1 are locked. Verify available versions and resource capacity there. Reuse a provenance-verified exact-source build if available; otherwise npm ci and npm run electron:p0:build, then inspect generated build-meta.json sourceSha/dirty and runtime electronP0.info() before accepting evidence. Do not reuse a stale app merely because its folder matches. No Portable or whole Rust build required for Palette/visual QA.

## Isolated launch recipe (receiving PC only)

First confirm all visible input targets belong to the QA PID/HWND. Do not close operating programs or capture personal previews. If isolation is unsafe, mark the affected test BLOCKED. Never use operational Finance or SCHOOL credentials.

Use a new writable, non-redirected local QA folder outside the repository and operating profiles. In a dedicated temporary PowerShell session, replace the example path with a verified school-local temporary parent (do not assume E: exists):

    $qaParent = 'C:\approved-unused-qa-temp'
    $qaRun = [guid]::NewGuid().ToString()
    $qaRoot = Join-Path $qaParent $qaRun
    New-Item -ItemType Directory -Path $qaRoot
    $env:RUNNER_TEMP = $qaParent
    $env:TEMP = $qaParent
    $env:TMP = $qaParent
    $env:ELECTRON_P0_QA_PROFILE = '1'
    $env:ELECTRON_P0_QA_ROOT = $qaRoot
    $env:ELECTRON_P0_TEST_RUN = $qaRun
    npm run electron:p0:start

This is a process-session recipe, not a command to run before choosing the safe path. QA_ROOT must be strictly beneath RUNNER_TEMP and must not be a junction/symlink or overlap normal AppData. The source enforces this. Do not permanently set environment variables; close this dedicated shell after normal QA shutdown. Check runtime userData/appData/stores all point under qaRoot. No real profile migration or copied DPAPI/Finance state.

## School acceptance checklist — record each separately

Actual monitor count, primary, Electron display IDs, bounds/workArea in DIP, scaleFactor and actual physical resolution must be recorded. Do not infer attached physical displays from simulations.

UX-07E (only if 2+ physical monitors): exactly one Palette per monitor; independent safe widget input and layout edits; per-screen persistence after restart; singleton Workspace/Settings; all Palette taskbar/Alt+Tab exclusion; actual coordinates/DPI/workArea. Cable disconnect/reconnect, primary/scale changes require separate user approval after checking other work. Without approval those scenarios stay NOT RUN. Mixed DPI requires actual distinct physical scaling. If only one monitor is connected, do not repeat home single-monitor PASS or 112 tests; leave physical cases NOT RUN.

UX-07F: newly observed school display only — Palette/Dock readability; supported-size widget click; Workspace main-button access; Settings; text clipping/overlap and scrolling at usable sizes. Reuse prior design/output PASS. Do not redesign or repeat publication generation.

SCHOOL: look for an existing approved isolated PostgreSQL fixture/provider. Current source has SQL-backed SCHOOL05 QA, not a standalone populated no-DB runtime Mock. Never substitute production or bypass authentication/MFA. If unavailable, populated Mock GUI stays NOT RUN; unit fixtures alone do not establish GUI PASS.

ODT: there IS an Electron GUI save path. electron-p0/main/official-document-files.ts routes review -> service.generate -> native Save As -> atomic no-clobber saveNewOdt. main.mts selects the native executable from packaged resources/official-document-cli, or the development tools/official-document-cli/target/debug path. Therefore inspect the actual receiving build/resources and GUI first; a missing development CLI on the home PC does not prove every packaged GUI unavailable. No new engine or unapproved executable is allowed.

Approved synthetic fixture: tools/official-document-cli/tests/fixtures/synthetic-document.odt (400 bytes), SHA-256 5E0A1B54AA2ECD6F3267E078EB52E234568697B6DFBE5C149B07D8F1586D1D6D. Its provenance materials are tracked. Hash before/after; only if the existing safe GUI/native dependency is usable, select this fixture, use synthetic title/body, save to a new separate QA filename, verify nonzero actual output and archive integrity, completion notice, and unchanged source. If unavailable, NOT RUN with observed cause; do not implement or build a new CLI as a workaround in this QA.

Normal exit own QA app/harness and verify matching QA PID count zero; do not terminate other sessions or delete profiles/evidence. No product changes unless separately authorized; this step is QA/documentation.

## Dependencies and evidence transfer boundary

Tracked/pushed: source, tests, lockfile, scripts, fixture/provenance, design rules and all linked instructions above. Runtime dependencies are reproducible from locked npm installation/build; school hardware/tooling and safe input isolation remain receiving-PC checks. Existing ignored .omo scaffolding is supplemental, not required to launch the approved QA. No credentials, operating DB, old QA profile, Finance key or DPAPI state is required or to be transferred.

Local-only original evidence: E:/BOGUNON_DEV/qa-output/UX07E_20261112 and UX07F original/R1/R2/R3/R4 folders referenced by the linked reports, including recursive manifests and their transitively referenced before/after images, outputs, logs, cleanup and reviews. These were not uploaded. R4 originals are at UX07F_R4_20261112/evidence-manifest.json. The school PC is not assumed to have these paths. Review of old original evidence is BLOCKED pending an approved secure online destination, full-package privacy/secret scan and hash-verified transfer; raw Shell/native captures may contain local/personal navigation or other windows. Public Git is not approved for these files. Redacted derivatives must be labeled and cannot replace original-byte provenance.

The next approved task can independently generate NEW school evidence using remote source and reported home results, without the home PC/drive; it must state that home originals were not directly reviewed. Cross-PC original-evidence review is a different blocked dependency. No HANDOFF READY claim for the complete evidence package.

## Remote-only verification and closure

A new remote-only filtered clone (no checkout) was created at home, not using the local Git object store: E:/BOGUNON_DEV/temp/ux07-school-remote-inventory-20261112. It resolved d66fa52c21a30cb1c27d4f89de176c42dd00db63 and fetched the tracked inventory, qa-profile source and package version pins from GitHub. This verifies source/instruction availability, not a receiving-PC build/GUI test or old-evidence restoration. The final entry commit is likewise checked after push. No tests, app launch or monitor setting changes were performed during handoff preparation.

Security: only this non-sensitive entry is intended for public commit; reviewed staged text/patterns, no secret scanner available for exhaustive assurance. No raw evidence or operational data transferred. Existing worktrees/data untouched; no QA process started in this preparation.

Handoff verdict: **PARTIAL for school QA resumption** (remote source/instructions available; actual receiving environment and GUI unverified). **BLOCKED for remote review of old original evidence**. UX-07E and UX-07F stay CONDITIONAL independently. Full integration QA/deployment not started. The school result document should record monitor environment, each PASS/FAIL/NOT RUN, source/build provenance, new evidence manifest location, code-change status, exact Git HEAD/remote divergence/clean state and remaining acceptance. Do not convert previous results to new school PASS.
