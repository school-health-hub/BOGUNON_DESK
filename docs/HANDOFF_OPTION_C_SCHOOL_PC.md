# OPTION C Soft Rose Surface — school PC handoff

Repository: `school-health-hub/BOGUNON_DESK` (public).
Branch: `codex/soft-rose-option-c-polish`.
Validated implementation: `5bd1c5c842fd16d49d2d220a141028dc5c96177d`.
Base: `195f3375e91348d2bbc7145b0e3743ca5f54385f`.
The handoff commit adds documentation/evidence only; obtain its exact HEAD from the remote and the closure report. Do not substitute main or a Native branch.

## Current status and next step

- Implementation PASS: compact header, independent Dock row, scroll access, internal Soft Rose glass with opaque fallback, long-title handling and modal focus/layering.
- Validation PASS: 20 focused unit tests; one real Windows Electron scenario across five viewport/zoom combinations; Electron Main/renderer/tests TypeScript and production renderer build.
- Windows OS DPI transitions, low-end performance and the latest Portable: NOT VERIFIED. Zoom checks assert renderer geometry, not Windows DPI changes; cropped zoom bitmaps are not accepted as complete visual proof.
- Native attachment: BLOCKED by OPTION C; no WorkerW/SetParent experiment or Native branch integration.
- Next approved resumption: restore this branch, inspect the source and evidence, and assess the remaining Windows DPI/Portable validation scope. A new Portable build, installation, main merge, PR or deployment needs its own approval. Do not repeat all tests or redesign the app.

## Receiving-PC restore (read first)

Find the actual school repository and worktrees first. Preserve all dirty files, untracked files and local-only commits. Never assume a home-PC path exists at school. Do not use reset/stash/clean to make these commands fit.

```powershell
# Run from the verified school repository.
git remote -v
git worktree list --porcelain
git status --short
git ls-remote origin refs/heads/codex/soft-rose-option-c-polish
git fetch origin codex/soft-rose-option-c-polish
git show -s --format="%H %s" origin/codex/soft-rose-option-c-polish
```

Reuse a clean checkout of this branch only if it has no local-only changes/commits and can fast-forward. Otherwise use an unused school-PC path and branch name after checking collisions. For a fresh branch:

```powershell
git worktree add --track -b codex/school-option-c-review '<unused school workspace path>' origin/codex/soft-rose-option-c-polish
# In that new checkout:
git status --short
git rev-list --left-right --count HEAD...origin/codex/soft-rose-option-c-polish
git diff 5bd1c5c842fd16d49d2d220a141028dc5c96177d HEAD -- electron-p0 src package.json package-lock.json
```

Expected: clean, divergence 0/0, no product-code difference from the validated implementation. Check manifest SHA-256 values against the transferred evidence copies. Stop on unexpected changes.

## Dependency-complete inventory

| Dependency | Preservation / restore |
| --- | --- |
| Product source, focused tests, E2E, build scripts, TypeScript/Vite configs | Tracked on this branch |
| Dependency lock and Node/Electron pins | Tracked `package-lock.json`; Node 22 (home used 22.23.3), Electron 45.2.1, TypeScript 6.0.3, Vite 8.3.0, Vitest 5.0.1, Playwright 1.64.1 |
| Design/constraints/commands | `DESIGN.md`, `docs/ELECTRON_OPTION_C_SURFACE_POLISH.md`, this note |
| Representative before/after captures and original build log | `docs/evidence/option-c-20261104/`; copies preserve original bytes; SHA-256/provenance/timestamps in `MANIFEST.json` |
| Other ignored captures | Optional home-only evidence, inventoried in the manifest; reproducible from tracked E2E. Not needed for source review |
| Unit-test terminal stdout | No original standalone log retained; 20 PASS is the recorded result, not an original log file. Reproduction commands are tracked |
| Home `node_modules` junction | Machine-local, not transferred. It references existing home development dependencies. Use school dependencies only after checking compatibility, or approved `npm ci` in the isolated school checkout |
| Build output / Electron binary | Reproducible from lockfile and tracked build command; not needed for read-only resumption. Portable is not generated |
| Test profiles, UDF, raw traces, user data, credentials | Not transferred, not required; never reuse operating profiles. E2E creates a UUID QA profile |
| `.omo` or external plan files | None required for this task |

Do not run setup/build just to repeat a closure check. When focused validation is approved, use the commands in the verification note. The E2E creates synthetic task data only inside its isolated test profile and closes its Electron application in `finally`.

## Security and cleanup

Only synthetic titles and public UI are present in selected screenshots. Text evidence and intended Git additions receive best-effort credential/private-path pattern inspection; a dedicated secret scanner is unavailable, so this is not a comprehensive secret-scan certification. No profile, DB, token, environment dump, installer or UDF is included.

Existing installed apps, original repositories, all other worktrees and QA evidence remain preserved. No Electron process for this worktree remained at closure. No persistent QA service was started.

Remote restoration is verified from a separate clone/inventory on the home PC before the final report. This does not mean the school PC itself or its Windows DPI/Portable environment has been tested.
