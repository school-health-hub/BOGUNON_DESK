# INT-01 — RC2 × DESIGN-07 / UX-09 / UX-10 / UX-11 compatibility audit

## Status
- **Audit-only; no production integration or deployment authorized.**
- Repo: `school-health-hub/BOGUNON_DESK`
- Audit branch: `integration/int-01-rc2-design-audit`, initially identical to UX-11 final SHA `be3b6ac35dcb07bb2a9976497b39241f343ab411`.
- RC2 reference: `162dd2873efa8ac2a42d71d09add130dee0f3d83`.
- DESIGN-07: `3a207b3e5ff42fd08a3066d968caa6a4af2e1beb`
- UX-09: `d1141bd720f4775c253846bf8b232ca4d7806e49`
- UX-10: `f36a32e5b8e8e2190e60ad3929a0f4b8c388b796`
- UX-11: `be3b6ac35dcb07bb2a9976497b39241f343ab411`

## Initial GitHub evidence
- RC2 -> UX-11: diverged; UX-11 ahead 11 / behind 5; merge base `19daed8689e6e06000d6d7367525b89d6abeca53`.
- Reverse compare: RC2 ahead 5 / behind 11.
- Shared edited file includes `electron-p0/renderer/P0App.tsx`; full path classification must be completed in local Git audit.
- RC2-only files include account/session, Electron main/preload/protocol and newsletter AI/IPC/rendering; preserving RC2 behavior is a key requirement.
- DESIGN-07, UX-09, UX-10 and UX-11 form a cumulative design lineage. Do not cherry-pick all four independently onto UX-11.

## Requested audit work — read-only
1. Confirm source refs, merge base and protected worktrees/dirty state. Never reset, clean, cherry-pick, merge, rebase, or modify protected branches.
2. Use `git merge-base`, `git diff --name-status`, `git log --left-right --cherry-pick` to build a per-file and per-commit delta matrix for RC2 vs UX-11. Classify: only RC2, only UX, both, non-code/QA evidence.
3. For overlapping source files, inspect actual hunks and dependencies, especially P0App, settings/bootstrap, newsletter entry, auth state, tray show/hide, logout cleanup, preload/IPC contracts, lazy screens, layout persist, Dock, build/packaging, tests.
4. Build a functional compatibility matrix with columns: scenario, RC2 contract, UX-11 contract, integration risk, intended preservation, needed test, confidence. Include session restore/logout; tray reopen; newsletter editing and project protection; permission/access gates; ODT/PDF cancellation, Record Helper and Purchase, toolbox 17 entries, widget 13 ON/OFF/geometry and settings, 125/150 DPI and 980x700.
5. Explicitly distinguish code merge conflicts, semantic/runtime conflicts and untested gaps. Do not claim integration PASS by combining separate QA PASS results.
6. Propose **one isolated integration candidate branch** only after a documented conflict resolution order and acceptance gates; do not create or modify it in INT-01 unless separately approved.
7. Prepare audit report `docs/integration/INT-01-AUDIT-REPORT.md` with exact commit SHAs, conflict table, risks P0/P1/P2, file-by-file merge sequence, tests, unverified cases, and GO / CONDITIONAL / NO-GO recommendation.
8. If requested testing can run read-only without mutation, carry it out within RAM/disk constraints; otherwise mark NOT RUN. Do not use elevated terminals without fresh explicit approval.

## Safety gates
- RC2 user data, working profile, source/QA artifacts unchanged.
- No new Electron main/preload/IPC/auth/finance/Newsletter behavior edits.
- No installer, publish, PR merge, main/integration merge.
- Native WorkerW attachment OPTION C remains DEFERRED / NOT RUN.
- Keep original visual evidence on E: local; GitHub does not automatically hold that evidence.
- Only audit documentation may be committed/pushed to this audit branch after scope and secrets review. If existing branch changes or dirty state conflict, preserve and report.

## Exit criteria
INT-01 passes only when a grounded compatibility audit report and evidence-backed recommended integration sequence exist. Integrated application runtime, production build, full regression and GUI are **NOT RUN** until a separate integration implementation and QA phase.
