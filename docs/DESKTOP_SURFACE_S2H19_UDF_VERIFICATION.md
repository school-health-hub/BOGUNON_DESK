# S-2H-19 — Surface UDF path admission and rejected-admission cleanup

Baseline: `8a5dda30301defebee0db48a0c6b65ec4ad0f2e2` on
`integration/desktop-surface-s2`.

## Observed failure and reproduced defect

S-2H-18 completed initial navigation, MainLifetime, MainEvents, Host startup,
environment creation and controller creation. The Host then reported
`udf_verification / invalid_path`; no Surface widget rendering was verified.
The old generic code cannot distinguish an observation error from a profile
containment rejection. No original URL, user path or profile content is needed
or recorded to investigate this boundary.

The Windows synthetic filesystem regression reproduced a concrete defect:
requested/effective UDFs passed through `canonicalize`, whereas WebView2
`ProfilePath` did not. Ordinary drive paths and canonical extended-length
paths have different Rust prefix components. The previous lowercase-only
comparison rejected a real descendant as `ProfileOutsideUdf`.

Primary API contracts:

- [Rust canonicalize](https://doc.rust-lang.org/stable/std/fs/fn.canonicalize.html)
  resolves aliases/reparse targets and returns extended-length Windows paths.
- [WebView2 ProfilePath](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2profile#get_profilepath)
  returns the full profile directory path, without promising Rust canonical syntax.
- [WebView2 UserDataFolder](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2environment7#get_userdatafolder)
  observes the directory used by the environment; it is not the profile directory.

This reproduced defect is fixed. Its exact correspondence to the old, collapsed
S-2H-18 failure remains unconfirmed until the next separately approved GUI run.

## Admission contract

Both live Surface and the independent runtime QA path use the shared on-disk
verification boundary. Requested/effective UDF paths must be absolute and retain
matching canonical paths plus volume/file identity. A mismatching effective UDF
is rejected before profile resolution. The profile must exist as a directory;
its canonical resolved path must be a strict descendant of the effective UDF.
Relative paths, parent traversal, UDF-root profiles, missing profiles and outside
profiles fail closed. No prefix stripping or identity-check removal is used.

Renderer attachment, navigation and window display remain after UDF admission.
MainCallerGuard, MainLifetime, MainEvents, production configuration, Finance,
ACLs and workflow files are unchanged.

Fixed diagnostics separate `udf_invalid_path`, `udf_effective_mismatch`,
`udf_profile_outside` and `udf_observation_failed`. They contain no path payload,
raw API error, environment value, PID, SID, URL or credential.

## Cleanup contract and limits

The attempt creates its QA UDF with `create_dir`; an existing directory is never
adopted. Its canonical path and real directory identity are saved.

Previously, a post-controller UDF error returned through `?` before explicit
cleanup. Drop fallbacks did not prove controller close, browser exit or directory
removal, explaining `not_evaluated` and the remaining QA directory.

The rejected-admission branch now attempts, in order, controller close/drop,
owned hidden-window destruction, bounded browser-exit observation, subscription
removal and environment/STA release. An earlier release failure does not skip
later release attempts. Exit observation must match the current binding and
observed browser identity, with a normal exit. No other process is terminated.

A rejected UDF cannot authorize a full cleanup receipt or deletion: its original
failure remains a failure, `cleanupStatus` is `unknown`, and the directory is
preserved even if local release calls succeed. Successful-admission removal
requires the saved identity, the exact direct child of canonical TEMP, the QA
name constraint and no reparse points in the removal tree.

This change covers post-controller UDF rejection. It does not claim comprehensive
partial-create cleanup for every earlier/later failure, atomic protection from a
malicious same-user filesystem race, or actual WebView2 exit verification.
Previously retained QA directories and all operating data remain untouched.

## Validation and next gate

The focused red test failed with `Err(ProfileOutsideUdf)` for a real synthetic
Windows descendant; after canonical profile resolution it passed. Additional
tests cover spaces, case/separators, invalid paths, distinct identities and
outside/root/missing profiles. Cleanup orchestration and removal ownership are
tested without launching a QA Main, Host or WebView2.

Use the existing push-triggered Windows portable QA workflow for Main compile,
Main security regressions, Host tests and packaging. Its actual run and artifact
results must be reported separately; previous CI results do not prove this build.

Actual GUI and WebView2 cleanup: **NOT_VERIFIED** in this step. Stable MSVC has no
installed Miri component; Miri/sanitizer coverage is **NOT_VERIFIED**, not PASS.
The next GUI run requires separate approval and preflight. It must check UDF
admission, six widgets, Main restore and terminal cleanup evidence, with no retry
on failure and no operating AppData inspection or mutation.
