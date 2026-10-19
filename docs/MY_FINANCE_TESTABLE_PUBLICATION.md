# MY FINANCE SHA-pinned TESTABLE publication (QA-24R)

## Trust model and scope

The test subject is explicitly trusted source `c6f11974822e06a7855314575551983ea6dadcef`, PR #14, branch `feature/my-finance-phase1`, in `school-health-hub/BOGUNON_DESK`. This is not an independent proof that its code or dependencies are harmless. Same-job Evidence is a validation record, not tamper-proof evidence against malicious candidate code. Runtime artifact credentials and output files are available to trusted candidate code in the validation job.

TESTABLE means synthetic QA packaging, not production deployment approval or real-user financial-data safety. Home/school installation, data protection, account/VM isolation and cross-PC restore require separate authorization. This implementation does not dispatch the workflow or authorize installation on either PC.

The existing PR #14, CI workflow and diagnostic workflow are unchanged. Operating comparison source is separately pinned to `5cec64358436c148710499b5aa9d2e78c34e0136`; this does not represent every installed production version.

## Controller and source identities

Only `.github/workflows/my-finance-qa-testable.yml` on `main` accepts `workflow_dispatch`, with no inputs. The controller is checked out at `github.sha`, which must equal `github.workflow_sha`, the checked-out controller HEAD and the current run's head SHA. It is deliberately different from the fixed app source. Before source execution and immediately before final upload, API checks require the exact repository, open Draft PR #14, branch, fixed source SHA and current run ID/attempt. API errors/missing fields block publication.

The app checkout has no persisted Git credentials. Only explicit controller API steps receive `GH_TOKEN`; jobs have read-only contents, pull-request and Actions permissions. No production secrets, release, deployment, updater or self-hosted runner are used. The protected Environment is a human publication gate, not a production deployment. Both jobs use disposable GitHub-hosted `windows-latest` runners. Installation, app execution and QA uninstall occur only in the candidate runner and use synthetic data. Publisher never executes candidate scripts or installer bytes.

## Required owner configuration before any dispatch

The repository owner must separately configure Environment `my-finance-testable-publish`:

- Required reviewers: one or more individual human GitHub users (Teams are intentionally unsupported by this minimum implementation).
- Prevent self-review enabled; administrator bypass disabled.
- Custom deployment branch policy: exactly the `main` branch; no tag/wildcard/additional branch policies.

The controller checks these real API fields **before candidate build** as well as at publication. A missing Environment or incomplete protections fails closed. The implementation must not create an Environment and accidentally treat its creation as approval. This prerequisite is currently not configured; existing production Environment is untouched.

A reviewer must be different from both the original run actor and rerun triggering actor, and must be one of the configured reviewers. After inspecting the candidate artifact and transfer manifest, approve the Environment in GitHub with the exact comment printed in the candidate job summary:

```
QA24R run=<run-id> attempt=<attempt> artifact=<artifact-id> manifest=<TRANSFER.json-sha256>
```

The publisher verifies the approval history, Environment identity, reviewer identity and exact comment. Approval without this binding is rejected. A rerun needs fresh bound approval for its own attempt/artifact. No approval is inferred from workflow success, a hash match, a file name or a previous run. Review revocation/PR change between the last check and upload remains a distributed-system race; there is no atomic API transaction combining identity verification, human approval and upload.

## Candidate validation and transfer

Candidate preserves the fixed source's frontend/native regressions, feature/config mismatch guards, operating-reference build, QA build, static OpenSSL check, native UI/concurrent operating/QA isolation checks, operating-data preservation and QA-only uninstall contract. Isolation failure, cancellation or uncertain cleanup stops packaging/upload. The original package helper accepts only successful strict isolation Evidence and copies the exact tested installer bytes.

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

The final package has those six files plus `PUBLICATION.json`, recording the verified installer/transfer hash, source/controller/run/attempt and real approval reference. Only this seven-file directory is uploaded as `MY-FINANCE-QA-TESTABLE-c6f11974822e06a7855314575551983ea6dadcef`. Upload is success-only, manual-main-only, after a final PR/run/Environment/approval check. Failed/cancelled runs and cleanup failure cannot publish through this workflow's declared path. Same-name artifact collisions fail; no overwrite is enabled.

Unsigned (`NotSigned`) and validly signed installers are distinguished in the original status; unsigned installers may trigger SmartScreen. Neither signature state nor publisher verification authorizes home/school use. Preserve the downloaded installer SHA if two PCs later use the same approved bytes.

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

Residual risks include non-atomic API-check/upload timing, dependency/action trust, hosted-runner failures and artifact-service behavior. Distinct GitHub user IDs are enforceable; distinct physical humans cannot be established by this workflow. Actual Windows and human approval runtime behavior is NOT VERIFIED. No workflow dispatch or real TESTABLE creation was performed.
