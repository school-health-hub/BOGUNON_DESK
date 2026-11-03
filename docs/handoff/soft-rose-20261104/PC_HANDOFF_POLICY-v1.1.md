# Codex Global Working Rules — Development Closure & PC Handoff v1.1

Applies to all development repositories and worktrees on this computer. This file is intended to be installed at `$CODEX_HOME/AGENTS.md` (normally `~/.codex/AGENTS.md`). Project-specific instructions may add requirements, but must not silently waive the handoff checks. Respect higher-priority instructions and the user's explicit decisions.

## 1. Closure trigger — mandatory

When the user says they are leaving work, going home, switching PCs, shutting down, stopping for the day, pausing, or asks whether they can close the computer, **do not immediately say they may leave**. First initiate a closure-and-handoff audit, even if they do not mention Git or repositories. Do not claim handoff success from `git status` or `git push` alone.

When a user wants to pause immediately, avoid new development and long-running verification. Protect the existing work first; report anything that cannot be completed safely before shutdown.

## 2. Identify the work to preserve

- Identify the active project, repository root, branch, detached worktrees, local-only directories, untracked files, and concurrently active work relevant to the session.
- Record the actual completion state: PASS, FAIL, BLOCKED, INCOMPLETE, NOT RUN. Distinguish implementation from validation and approval.
- Record current HEAD, upstream, remote, working tree, unpushed commits, and divergence for every affected repository. Never discard unrelated edits.
- Do not assume all needed work lives inside Git. Check paths outside the repo mentioned in plans, commands, validators, logs, and handoff notes.

## 3. Build a dependency-complete handoff inventory

Before declaring READY, identify everything needed to resume the **next approved step** on the other PC:

- Source, tests, scripts, lockfiles, configuration examples, migrations, and environment version pins.
- Current plan, decisions, approval conditions, issue/blocker report, next task, and exact validation commands.
- Evidence manifests and all artifacts **transitively referenced** by them (RED/GREEN logs, stdout/stderr, screenshots, cleanup and independent-review records, hashes/provenance).
- Local-only and Git-ignored paths, including `.omo/`, other evidence stores, generated artifacts, and files located outside the repository.
- Necessary runtime prerequisites and reproducible setup, while distinguishing portable files from machine-local secrets or state.

For each dependency, mark: tracked and pushed / safely transferred by another approved method / reproducible with verified instructions / unavailable. A `HANDOFF READY` verdict is prohibited if a required dependency is unavailable.

## 4. Security and safe transfer

- Before commit or transfer, scan staged files **and the complete intended handoff package**, including ignored evidence and logs, for API keys, credentials, tokens, cookies, private keys, personal/student/patient information, and private database content. Use an available secret scanner; if none is installed, perform documented best-effort inspection and mark residual risk explicitly.
- Never add secrets or personal data to Git merely to satisfy a handoff check. Do not bypass `.gitignore` blindly or force-add whole evidence directories.
- Preserve original evidence bytes, relative paths, timestamps where feasible, SHA-256 inventory, and provenance. Redacted copies must be labeled and must not be presented as unmodified originals.
- Use only a user-approved secure transfer destination. Private GitHub visibility is not by itself permission to upload confidential artifacts. Do not silently upload evidence, alter remote settings, or copy protected data to external storage.
- Store secret values separately and document only variable names and re-creation steps. Never print secrets in the closure report.

## 5. Git checkpoint and verification

- Confirm the correct owner, repository, branch, visibility, and upstream before any push.
- Make scoped checkpoint commits only with permission and with status accurately labeled (`wip`, `blocked`, etc.). Never fabricate evidence or turn an incomplete gate into PASS.
- No force push, destructive reset, unapproved branch overwrite, indiscriminate container cleanup, or deletion of other worktrees.
- If push is authorized, verify the remote HEAD matches the intended commit, divergence is `0/0`, and report the working tree state. Clean is desirable, not a substitute for evidence completeness.
- Where feasible, verify a fresh clone plus restoration of approved supplemental artifacts in a disposable location, then inspect that the next-step prerequisites are present. Do not run destructive or long tests merely to satisfy the check.

## 6. Handoff document and verdict

Write or update a handoff note for each active project with: repository/branch/HEAD; implemented vs validated status; current blocker; exact next step and commands; version pins; non-Git artifact inventory and transfer location; security review; cleanup state; and what the receiving PC must verify. Do not imply another machine was tested when it was not.

Use these verdicts:

- **HANDOFF READY**: all required dependencies are accessible on the receiving PC via verified remote or approved transfer; restore steps and at least a non-destructive reproduction/inventory check have been verified; unresolved environment prerequisites are explicitly manageable.
- **PARTIAL**: code is preserved, but receiving-PC restore or a noncritical prerequisite remains unverified. State exactly what remains and do not tell the user resumption is fully ready.
- **BLOCKED**: a required artifact, approval, access path, or prerequisite is missing and prevents resuming the next approved task. State the recovery action and where the original currently resides.

Always distinguish **Git sync status** from **full handoff verdict**. A Git-synced repository can still be BLOCKED.

## 7. Before saying 'you can go home'

Provide a concise closure summary: inspected projects; current task status; remote checkpoint and SHA; ignored/out-of-repo dependencies; evidence and approval completeness; transfer/reproduction test; security scan limitations; running services/cleanup; and READY/PARTIAL/BLOCKED verdict.

If the verdict is not READY, say what will not work on the other PC and offer the smallest safe action to preserve access. Do not wait for the user to ask, 'What about the repository check?'

## 8. Cross-PC and instruction-file maintenance

- Codex global guidance is **per machine / per user profile**. Apply and verify on each PC separately, including when `$CODEX_HOME` differs from the default.
- Before installing, check for an existing `AGENTS.md` or `AGENTS.override.md`. Never overwrite; merge carefully or request approval for conflicts. Note that `AGENTS.override.md` takes precedence over `AGENTS.md` in the same directory.
- Start a new Codex session after changing global instructions, and ask Codex to identify the loaded instruction sources and summarize this handoff rule.
- Keep a versioned backup of this policy in an approved, non-sensitive location so updates can be applied to both PCs; do not assume edits on one PC propagate to the other.

## 9. Remote-first cross-PC resumption — v1.1

When the user says they will continue at school or on another PC, interpret the handoff goal as resuming without this PC and without carrying an external drive, unless the user explicitly chooses physical transfer.

- Preserve source, the next-step instructions, and every required non-Git evidence dependency in an approved online destination. Local paths and external-drive-only copies do not complete this handoff.
- Use the destination already authorized in the session. Obtain approval before a new public or sensitive upload; approval for synthetic artifacts never authorizes uploading secrets, real records, Finance/DPAPI state, or unrelated WIP.
- Verify the remote checkpoint and a fresh remote-only restore, including dependency inventory and hashes. Never mark READY from source Git synchronization alone.
- Keep one prominent online entry document with the exact branch/SHA, implemented versus verified state, remaining blockers, minimal receiving-PC checks, and links to all required evidence.
- If a required dependency remains solely on this PC or external storage, report BLOCKED for that resumption step and the smallest safe recovery. Do not describe it as ready to continue.
- Receiving-PC tool prerequisites may remain explicitly manageable; do not claim that PC, its DPI, credentials, or GUI were tested.
- For a scoped handoff, identify unrelated local-only WIP separately and do not imply that it was transferred.
