# MY FINANCE SHA-pinned TESTABLE publication (QA-27)

## Trust model and scope

The test subject is explicitly trusted source `c6f11974822e06a7855314575551983ea6dadcef`, PR #14, branch `feature/my-finance-phase1`, in `school-health-hub/BOGUNON_DESK`. This is not an independent proof that its code or dependencies are harmless. Same-job Evidence is a validation record, not tamper-proof evidence against malicious candidate code. Runtime artifact credentials and output files are available to trusted candidate code in the validation job.

TESTABLE means synthetic QA packaging, not production deployment approval or real-user financial-data safety. Home/school installation, data protection, account/VM isolation and cross-PC restore require separate authorization. This implementation does not dispatch the workflow or authorize installation on either PC.

The existing PR #14, CI workflow and diagnostic workflow are unchanged. Operating comparison source is separately pinned to `5cec64358436c148710499b5aa9d2e78c34e0136`; this does not represent every installed production version.

## Single-operator approval boundary

The approval model is **single-operator, two explicit actions**. First, the designated operator manually dispatches this workflow on main. Candidate QA then runs in its own disposable Windows job and produces an internal Candidate artifact. Publisher remains blocked until the same operator reviews the exact Candidate and clicks the separate Environment approval action. No initial confirmation input, automatic PR event or copied approval string can replace that actual GitHub approval record. Review-only Candidate downloads must not execute or install the package.

This deliberately removes the former different-person approval guarantee. It is not independent third-party review: account compromise, operator error and failure to actually inspect Evidence are not mitigated by a second person. Fixed-source trust and the Evidence limitations above remain unchanged. PUBLICATION.json records approvalModel = "single-operator, two explicit actions" and independentApproval=false; it cannot certify the later final run result.

The Environment policy uses GitHub's public required-reviewers/prevent_self_review fields. Public repositories support required reviewers; setting prevent_self_review=false permits this model. It does not remove the required reviewer or administrator-bypass prohibition. No Environment settings are changed by this implementation. After a separately authorized code merge, the owner must separately authorize and configure only my-finance-testable-publish with the exact settings below. Do not modify desktop-production-release or grant execution through that Environment.

References: [required reviewer and self-review settings](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments#required-reviewers), [approval action](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments). Actual same-account approval behavior is NOT VERIFIED until a separately authorized GitHub run.

## Controller and source identities

Only `.github/workflows/my-finance-qa-testable.yml` on `main` accepts `workflow_dispatch`, with no inputs. The controller is checked out at `github.sha`, which must equal `github.workflow_sha`, the checked-out controller HEAD and the current run's head SHA. It is deliberately different from the fixed app source. Before source execution and immediately before final upload, API checks require the exact repository, open Draft PR #14, branch, fixed source SHA and current run ID/attempt. API errors/missing fields block publication.

The app checkout has no persisted Git credentials. Only explicit controller API steps receive `GH_TOKEN`; jobs have read-only contents, pull-request and Actions permissions. No production secrets, release, deployment, updater or self-hosted runner are used. The protected Environment is a human publication gate, not a production deployment. Both jobs use disposable GitHub-hosted `windows-latest` runners. Installation, app execution and QA uninstall occur only in the candidate runner and use synthetic data. Publisher never executes candidate scripts or installer bytes.

## Required owner configuration before any dispatch

The repository owner must separately configure Environment `my-finance-testable-publish`:

- Required reviewer: exactly `sungandi86-max`, numeric GitHub user ID `281109297`, type `User`. Teams and additional reviewers are rejected.
- Prevent self-review: false; administrator bypass disabled. The designated operator must perform the separate Environment approval action.
- Custom deployment branch policy: exactly the `main` branch; no tag/wildcard/additional branch policies.

The controller checks these real API fields **before candidate build** as well as at publication. A missing Environment or incomplete protections fails closed. The implementation must not create an Environment and accidentally treat its creation as approval. This prerequisite is currently not configured; existing production Environment is untouched.

The run actor, triggering actor and approver must all be the designated operator `sungandi86-max` (ID `281109297`). After Candidate QA succeeds, inspect its Evidence, installer hash and transfer manifest, then separately approve the Environment in GitHub with the exact comment printed in the candidate job summary:

```
QA27 run=<run-id> attempt=<attempt> artifact=<artifact-id> manifest=<TRANSFER.json-sha256>
```

The publisher verifies the approval history, Environment identity, reviewer identity and exact comment. Approval without this binding is rejected. Only run_attempt=1 is admitted by both jobs and both Gate modes. All job/workflow reruns are refused; after failure, begin a new workflow_dispatch and regenerate/review its Candidate. A new run requires its own approval, artifact ID and manifest hash. No approval is inferred from workflow success, a hash match, a file name or a previous run. Review revocation/PR change between the last check and upload remains a distributed-system race; there is no atomic API transaction combining identity verification, human approval and upload.

## Candidate validation and transfer

Candidate preserves the fixed source's frontend/native regressions, feature/config mismatch guards, operating-reference build, QA build, static OpenSSL check, native UI/concurrent operating/QA isolation checks, operating-data preservation and QA-only uninstall contract. Isolation failure or uncertain cleanup blocks downstream packaging/upload. Cancellation before upload admission blocks new steps; cancellation during or after upload does not guarantee artifact absence. The original package helper accepts only successful strict isolation Evidence and copies the exact tested installer bytes.

Candidate artifact name is `MY-FINANCE-QA-CANDIDATE-<run>-<attempt>`. It is not a TESTABLE publication. Its exact six files are:

1. `BOGUNON-DESK-MY-FINANCE-QA-c6f1197-Windows-x64-Setup.exe`
2. `SHA256SUMS.txt`
3. `QA-TEST-STATUS.json`
4. `START-HERE.ko.md`
5. `ISOLATION.json`
6. `TRANSFER.json`

`TRANSFER.json` binds source/controller SHA, run/attempt, installer SHA-256 and every preceding file's SHA-256. The upload action's exact artifact ID and transfer SHA are candidate job outputs. Separate failure Evidence uploads contain only the isolation Evidence directory, never installer/release-output globs.

## Independent publisher job

The protected publisher checks the candidate job's actual successful conclusion and exact artifact ID/name/run/controller identity, then downloads that ID from the same run. It validates the exact inventory, bounded regular files, all transfer hashes, strict isolation/status fields and installer hash against both Evidence and status. It never executes downloaded content. Verified buffers are copied into a new directory without overwrite; publication does not reread unverified candidate files.

The final package has those six files plus `PUBLICATION.json`, recording the verified installer/transfer hash, source/controller/run/attempt and real approval reference. Only this seven-file directory is uploaded as `MY-FINANCE-QA-TESTABLE-c6f11974822e06a7855314575551983ea6dadcef`. Upload is manual-main-only, after a final PR/run/Environment/approval check. success() checks upload-step admission, not the final workflow conclusion. Earlier candidate or cleanup failures block downstream upload; however, an upload completed before cancellation or a later failure may leave an artifact. Artifact existence is not permission to use it. Same-name artifact collisions fail; no overwrite is enabled.

Unsigned (`NotSigned`) and validly signed installers are distinguished in the original status; unsigned installers may trigger SmartScreen. Neither signature state nor publisher verification authorizes home/school use. Preserve the downloaded installer SHA if two PCs later use the same approved bytes.

## Mandatory manual checks before download, installation or transfer

Manual operator procedure only. No automatic pre-use final-status verifier exists in this change. Existing `gate.mjs` checks publication admission while the publisher is running; `package.mjs`, `testable: true` and `PUBLICATION.json` cannot attest a later workflow conclusion. Artifact existence/name is not authorization to download for use, install or forward it. This procedure does not authorize workflow dispatch, installation or forwarding; separate PC-specific approval and isolation remain required.

1. Before downloading for use, query GitHub metadata for the exact run ID and run attempt. Check both the latest run and the exact attempt: each must have status = completed and conclusion = success, with matching run ID, run attempt and controller SHA. Require run attempt 1. If a newer attempt exists, reject this execution and do not reuse approval or artifacts from an older attempt. Confirm repository, workflow path `.github/workflows/my-finance-qa-testable.yml`, `workflow_dispatch` event and main branch. Do not use a green job/step or the separate clean-install CI run as a substitute.
2. Check the source SHA is exactly `c6f11974822e06a7855314575551983ea6dadcef`. The controller SHA is the main controller commit recorded by this publication, not the app source SHA or necessarily this PR's pre-merge HEAD. Require matching identities across run metadata, `TRANSFER.json` and `PUBLICATION.json`.
3. Verify the actual GitHub human approval record for that execution: correct protected Environment, configured operator ID `281109297` matching both run actors, and exact `QA27 run=... attempt=... artifact=... manifest=...` binding. Ordinary comments, copied strings, CI success and previous-attempt approvals are insufficient. Match its candidate artifact ID and transfer digest to `PUBLICATION.json`; also record the final TESTABLE artifact ID separately. Candidate and final artifact IDs are different.
4. Verify the final artifact ID belongs to the same successful run/controller and is available, not expired. Require the exact seven-file inventory: the six candidate files listed above plus `PUBLICATION.json`, with no extra files or directories. A quarantined, non-executing verification download may be needed to inspect bytes after metadata/approval checks; it is not permission to use, install or forward them. Before any downstream download for use, installation or transfer, finish all content checks below. Never launch the installer to verify a hash.
5. Compute the installer SHA-256 and match it against `SHA256SUMS.txt`, `QA-TEST-STATUS.json`, `ISOLATION.json`, `TRANSFER.json` and `PUBLICATION.json`. Compute `TRANSFER.json` SHA-256 and match the human approval and publication record. Check every transferred file hash, source/controller/run/attempt identity, strict successful isolation flags, `productionDeployment: false` and signature status. Do not trust manifest claims without comparing the actual bytes. Any mismatch means DENY.
6. Immediately before use or forwarding, recheck the latest run and the exact attempt and their identities. If metadata, approval, files or hashes cannot be verified, DENY use even when the artifact exists. Discard it from the proposed use; do not automatically delete GitHub artifacts or retry the workflow. Keep a review record of run/attempt, controller/source, approval reference, candidate/final artifact IDs and verified installer/manifest hashes. Checks are not an atomic lock against later changes; stop if state changes or becomes uncertain.

Read-only metadata examples (replace placeholders with the recorded numeric identities):

```text
gh api repos/school-health-hub/BOGUNON_DESK/actions/runs/RUN_ID
gh api repos/school-health-hub/BOGUNON_DESK/actions/runs/RUN_ID/attempts/ATTEMPT
gh api repos/school-health-hub/BOGUNON_DESK/actions/runs/RUN_ID/approvals
gh api repos/school-health-hub/BOGUNON_DESK/actions/artifacts/ARTIFACT_ID
```

These commands display metadata; they do not automatically validate this checklist or grant approval. API failure/missing fields, an in-progress run, or any non-success conclusion is fail-closed.

| Final status | Conclusion | Decision even if artifact remains |
| --- | --- | --- |
| in_progress | any | DENY |
| completed | failure | DENY |
| completed | cancelled | DENY |
| completed | timed_out | DENY |
| completed | unknown | DENY |
| completed | success | Continue identity/approval/hash checks; not installation authorization |

Post-upload example: upload completes -> cancellation or post-step failure -> artifact may remain. Both the failure and cancellation cases require DENY, even if the earlier approval, upload step and installer hash were valid. Unlisted/unknown states also require DENY. `PUBLICATION.json` predates final completion and does not override this decision.

A future read-only consumption verifier is follow-up work. It should automate the metadata, attempt, approval, inventory and byte checks above and fail closed, while still requiring separate authorization for actual PC installation. No such executable verifier, publication redesign or artifact deletion is introduced here.

## Static verification and remaining runtime work

Controller policy, actual API orchestration and package file processing have Synthetic tests using fake installer bytes. Workflow parsing/expression checks use actionlint; contract tests inspect the actual workflow wiring and run/attempt/artifact transfer. Existing CI/diagnostic files must remain byte-identical.

No dispatch, real installer, Windows app execution, home/school AppData, registry, DPAPI or financial data is used in this implementation task. A future separately authorized manual run must still verify GitHub Environment approval behavior/API responses, hosted Windows build/install/cleanup, artifact transport and exact output contents. GitHub Actions approval and upload API behavior is not established by Synthetic tests alone.

### Implementation verification record

QA-24R was implemented on an independent worktree based on main `74b800aa2ab4c609d9274133d61b94d0c3016799`.

- 114 tests passed across seven suites: policy 55, API gate integration 14, package 17, workflow wiring 10, existing diagnostic 4, clean-install workflow 4 and updater workflow 10.
- Actual YAML parse with duplicate-key rejection: two jobs; all 21 extracted PowerShell run blocks parsed successfully without executing them.
- actionlint v1.7.12: no diagnostics (ShellCheck disabled for this PowerShell workflow). Downloaded tool ZIP SHA-256: `6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9`.
- CLI prepare/verify/publish using synthetic non-executable bytes succeeded and preserved exact bytes. Wrong source, stale approval and changed installer byte were rejected; rejected publication created no output directory.
- Independent goal, code, security, hands-on Synthetic QA and GitHub/context reviews passed. These reviewers are code-review agents, not human TESTABLE publication approvers.
- Existing CI/diagnostic/app/Cargo/dependency/lockfiles are unchanged. The original worktree's pre-existing Cargo modification and clean Desktop Surface worktree were preserved.
- Read-only GitHub checks reconfirmed fixed main and open Draft PR #14. The new publication Environment does not exist yet, so an attempted future run must stop before building until its owner configures the required protections.

Residual risks include non-atomic API-check/upload timing, dependency/action trust, hosted-runner failures and artifact-service behavior. The same designated GitHub account performs both explicit actions; independent human approval is not provided. Actual Windows and human approval runtime behavior is NOT VERIFIED. No workflow dispatch or real TESTABLE creation was performed.
