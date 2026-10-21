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
Ref: `release/td2-finance2-candidate` only. It must already exist on GitHub and the
workflow must be registered/available for manual dispatch. GitHub may require a
workflow on the default branch before a newly added workflow can be dispatched;
do not merge/change main or bypass that restriction without separate approval.

Inputs: `expected_source_sha` = exact reviewed candidate commit; `timeout_test_file`
= tracked failing test file; `timeout_test_name` = its exact full Vitest name.
The previous five-second timeout case is currently UNIDENTIFIED in the available
records. Do not substitute an arbitrary passing test. Identify that original case
from its failure record before execution. Missing inputs fail before npm/build.
No workflow was dispatched during preparation.

CI performs dependency audit (all severities), focused Finance tests, exactly one
selected timeout regression without raising its timeout, full frontend tests,
TypeScript, frontend build, Finance Rust regressions and existing release:windows
checks/build. Audit findings or test failures block installer upload.
Failure artifacts contain diagnostic JSON only (audit, selected timeout report and
signature observation when reached). Compiler/build output remains in GitHub step
logs; an absent JSON report is not evidence that the corresponding check passed.

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

Local preparation verified 14 Node contract cases, both helper syntax checks,
the existing release-version guard and git diff whitespace checks. Contrasting
manual/automatic events, matching/mismatching source SHA, and first/rerun attempts
confirmed that invalid contexts are rejected by the actual guard function.
No installed YAML parser or actionlint was available in the checked tools; those
checks remain unverified. Windows build/QA execution has not been attempted.
GitHub's workflow list did not register this new candidate workflow at preparation
time. CI EXECUTION READINESS remains BLOCKED until default-branch registration is
authorized separately and the original timeout case is identified.
