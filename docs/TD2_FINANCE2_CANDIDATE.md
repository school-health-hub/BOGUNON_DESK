# BOGUNON DESK 0.2.2 Windows candidate

This is an installation candidate, not an approved production deployment.
Home installation and school-PC update require separate user approval.

## Source and preserved behavior

- Main baseline: `2ef8fff0125d1ec50ea433005001e3080b689bb4`.
- Dashboard merge: `0807f2e7ee12780795df1b6d4b0fe3c5e2da593b`.
- Finance 2.0 and dependency fixes: `dc6772c996cad0d8dbfba5f6f7afb505f817fdb8`.
- Operating identifier: `kr.sungandi.schoolhealthdesk`; version: `0.2.2`.
- Vite 8.3.3 and source-map-js 1.2.2 remain locked.
- Existing SQLCipher/DPAPI, finance schema/paths, .bgfnbk format, authentication,
  WebView profile and saved dashboard layouts are unchanged.
- Existing main features remain. Unmerged official-document/Purchase enhancements
  and Desktop Surface 9B are not integrated. Existing main shell probe is unchanged;
  this candidate does not provide desktop attachment.

## References and attribution

The Dashboard UI/UX and spatial composition reference TD2 and are reinterpreted
for school health work. The recorded reference URL is https://tdesk24.com/ .
The exact original author and license of the supplied TD2 reference are unconfirmed.
This does not assert permission to redistribute TD2, or direct use of its code,
icons or other resources. Preserve existing third-party notices.

준일쌤의 이음오피스 (IeumOffice), https://github.com/pblsketch/openoffice ,
Apache License 2.0, is acknowledged as a reference for future official-document
authoring improvements. Those unmerged improvements are NOT included here.
The author's name/request is user-provided attribution. Any actual reuse must be
reviewed separately against the upstream LICENSE/NOTICE and modification notices.

## Manual CI only

Workflow: `.github/workflows/td2-finance2-candidate.yml`.
Ref: `release/td2-finance2-candidate` only. The only required input is
`expected_source_sha`, the exact reviewed candidate commit after these changes.
Default-branch registration uses the same workflow path and input schema with
`permissions: {}` and a registration-only job whose condition is `if: ${{ false }}`.
No checkout/build/deployment occurs from that registration copy. Select the
candidate branch for a later separately approved dispatch. The candidate verifies
repository, workflow/ref, source/controller SHA, clean checkout and attempt 1.
No workflow was dispatched during preparation.

The original Finance five-second timeout evidence is unavailable. The manifest
records `historicalFinanceTimeout: UNKNOWN`; this is not a claim that the old
failure was identified or fixed. Desktop Surface/Record Helper failures are not
substituted for that Finance case. Its identity is no longer a required input.

CI requires dependency audit (all severities), all Finance tests, full frontend
regressions, TypeScript, frontend build, Finance Rust regressions and the existing
release:windows checks/build. It does not raise test timeouts, ignore failures or
retry tests. Any required failure blocks the successful installer upload.
Before dependency installation, actionlint 1.7.12 checks the workflow. Its Windows
amd64 ZIP SHA-256 is pinned to
`6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9`.
A download, checksum or linter failure stops the build.
Failure artifacts contain diagnostic JSON only (audit and signature observation
when reached). Compiler/test/build output remains in GitHub step logs; an absent
JSON report is not evidence that the corresponding check passed.

Successful output contains the NSIS EXE, SHA256SUMS.txt, README-FIRST.txt,
BUILD-MANIFEST.json, this guide and THIRD_PARTY_NOTICES.md. The manifest records
the actual source/controller SHA, run/attempt, installer bytes/hash and observed
Authenticode status. This build does not use an updater signing key or publish
anything to a release/update server. Updater signatures and Windows Authenticode
signatures are different. An unsigned result is recorded, never called signed.

Before downloading/using, require final run completed/success, exact SHA/ref/run/
attempt and matching artifact inventory/digest and installer hash. Artifact
existence alone is not approval: a later failure/cancellation can leave artifacts.
Candidate creation does not authorize installation.

## Data protection

Do not uninstall existing apps or delete/rename AppData, finance.db, key.dpapi,
auth-session.bin or backups. The QA identifier .myfinanceqa remains separate.
Use only synthetic data for later approved installation/update QA. Preserve the
same Windows user/profile for DPAPI. School updates additionally require exact
old installer/version identification and validated data-preserving upgrade QA.
Do not follow older generic cleanup/reset instructions in place of this policy.

## Preparation limits

Only source/static checks run locally: no npm ci, Rust build, app execution or
workflow dispatch. Windows tests, audit, NSIS output and signatures are pending.
No previous Candidate/Environment approval is reused. Production Environment,
release creation, updater publication and deploy secrets are absent.

Local checks cover Node contracts, both helper syntax checks, the existing
release-version guard, YAML parsing, pinned actionlint and git diff checks.
Contrasting manual/automatic events, matching/mismatching source SHA, and
first/rerun attempts confirms rejection by the actual guard function. These are
source-preparation checks, not Windows application tests. Windows CI, npm audit,
NSIS output and signatures remain unverified until a separately approved run.
Registration and candidate commit identities must be rechecked before dispatch;
registration alone does not approve a run, artifact use or installation.
