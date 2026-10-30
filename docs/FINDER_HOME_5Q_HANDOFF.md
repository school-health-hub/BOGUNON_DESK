# Finder HOME-FINDER-5Q school-to-home handoff

## Source identity and current status

- Repository: `school-health-hub/BOGUNON_DESK` (public).
- Branch: `codex/home-restore-finder-1`.
- Finder executable source commit: `bc20e5eccea67547097262b0ae8237a26224663f`.
- Source commit message: `fix(finder): show library recovery status`.
- The source commit is present on `origin/codex/home-restore-finder-1`; the school
  worktree was clean with divergence `0/0` before this handoff document was added.
- HOME-FINDER-5Q-1 implementation and local focused verification passed. The recovery
  success notice is shown only for `recovered: true`; normal and failed loads do not
  claim success. Production Finder and isolated QA use the same notice contract.
- Existing quarantine, backup and primary recovery storage logic was not changed.

## HOME-FINDER-5Q-3 Windows CI

- One workflow dispatch was already created before the closure request. Do not create a
  duplicate run or rerun it automatically.
- Run: https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41012660300
- Workflow: `.github/workflows/finder-home-qa-windows.yml`.
- Requested branch and source SHA: `codex/home-restore-finder-1` at
  `bc20e5eccea67547097262b0ae8237a26224663f`.
- School-PC closure observation: **IN PROGRESS**, in the Windows Native portable EXE
  compile/link step. SHA validation, checkout, pinned Node/Rust toolchains, verified
  NASM/MSVC/Perl, locked frontend install, offline contracts, Finder QA tests,
  TypeScript and locked Rust dependency fetch had passed.
- The local `gh run watch` process was stopped during closure; the GitHub-hosted run was
  not cancelled or modified.
- If the run succeeds, the expected artifact name is
  `finder-home-qa-bc20e5eccea67547097262b0ae8237a26224663f-41012660300`.
  Treat the artifact, retention deadline, EXE hash and manifest as unknown until the
  completed run and downloaded bytes are verified.

## School-only evidence and QA data

The following directories remain in the approved school QA output area. They are not
tracked by Git and were not uploaded. Replace `<SCHOOL_QA_OUTPUT_ROOT>` with the approved
local `qa-output` root on the school PC; do not assume the same path exists at home.

- `finder-home-qa-b17b46e-40919061183-school-20261030`: verified older CI artifact.
- `finder-home-qa-b17b46e-5p-school-20261030-01`: 5P normal QA runtime and evidence.
- `finder-home-qa-b17b46e-5p-school-20261030-corrupt-01`: isolated corruption scenario.
- `finder-home-qa-b17b46e-5p3-school-20261030-01`: small-window GUI QA evidence.
- `finder-home-5q-1-20261030`: 5Q recovery-notice visual evidence.

These are historical evidence, not prerequisites for checking run 41012660300 or
downloading its artifact. Exact replay or audit of the school GUI sessions requires a
separately approved secure transfer; Git does not contain the originals. Never upload
runtime profiles, operating AppData, OAuth files, QA libraries or raw logs merely to make
the handoff complete.

## Home-PC next steps

### HOME-FINDER-5Q-3: finish CI and artifact verification

1. Fetch the branch without rewriting occupied work:
   ```powershell
   git fetch origin codex/home-restore-finder-1
   git show --no-patch --format='%H %s' bc20e5eccea67547097262b0ae8237a26224663f
   ```
2. Read this handoff from the remote branch. The documentation commit may be newer than
   the executable source SHA; do not substitute the documentation HEAD for `bc20e5e...`.
3. Inspect the existing run only; do not dispatch or rerun automatically:
   ```powershell
   gh run view 41012660300 --repo school-health-hub/BOGUNON_DESK
   ```
4. On `SUCCESS`, download the named artifact into a fresh, non-overwriting local folder.
   Require exactly the EXE, `SOURCE_SHA.txt` and `ARTIFACT-MANIFEST.json`. Verify source
   SHA, identifier, file size, manifest hash, EXE SHA-256 and Windows x64 PE before launch.
5. On failure, record the failed step and actual error. Do not rerun without a new explicit
   approval. On expiry or missing artifact, report the missing dependency.

### HOME-FINDER-5Q-4: isolated Windows GUI recovery verification

After 5Q-3 artifact integrity passes and EXE execution is separately approved:

1. Prepare a fresh source-SHA-owned QA runtime root outside operating AppData.
2. Use synthetic data only. Confirm normal load shows no recovery notice.
3. With the app stopped, preserve a valid backup and place only the predefined corrupt
   primary in the disposable runtime.
4. Launch once and verify the exact notice:
   `저장된 교육영상 목록에 문제가 발견되어 백업에서 복구했습니다. 현재 목록을 확인해 주세요.`
5. Confirm video and memo preservation, no false success on unrecoverable data, and no
   repeated recovery notice on ordinary subsequent reads. Preserve screenshots and hashes.
6. Do not access operating AppData or call AI, YouTube or Supabase.

## Security and closure boundary

- No credentials, tokens, student/patient data, operating data, QA raw data or executable
  bytes belong in this public repository.
- This document deliberately uses placeholders instead of a Windows user-profile path.
- The dedicated secret scanner was unavailable; the intended document receives manual and
  best-effort secret/PII pattern review before commit.
- Finder source is remotely reproducible for the next step, but the pending artifact is not
  yet a verified handoff dependency.
- The school repository has other dirty worktrees and active Codex processes unrelated to
  Finder. They were inspected read-only and were not modified or terminated. This document
  is not a claim that those unrelated tasks are safe to discard or that the entire PC has
  no active work.

## Verdict at document creation

- Finder Git source: **HANDOFF READY** for resuming HOME-FINDER-5Q-3.
- Windows QA artifact: **PARTIAL** until run 41012660300 completes and its downloaded bytes
  pass integrity verification.
- Whole-PC closure: **CONDITIONAL** because unrelated dirty worktrees and active Codex
  sessions remain; preserve them and do not force-close their processes.
