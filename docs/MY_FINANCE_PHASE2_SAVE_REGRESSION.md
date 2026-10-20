# Phase 2 post-save feedback regression

## Baseline and reproduction

Reported TESTABLE source: `daab156c5ac0e340574593990fc9d230d574e9a1`.
In the investment section, add a synthetic brokerage account and instrument.
The saved row can appear together with the generic save-failure alert. The
in-app refresh can reload the rows while leaving that child alert visible.
No user database, backup, operational profile or installed binary was read or
modified in this investigation. Restart/reopen durability of the reported rows
remains unverified.

Three hypotheses were checked:

1. CAS conflict or a duplicate native request: the successful synthetic save
   reproduced the alert with exactly one request, so neither is required to
   reproduce this defect. Native identity/CAS rules were not changed.
2. Post-save UI exception: React clears SyntheticEvent.currentTarget after
   dispatch. The shared submit handler awaited onSave and then dereferenced
   event.currentTarget inside the save-error catch. A successful response and
   updated parent snapshot could therefore be followed by a false error.
3. Stale feedback after refresh: Phase2Workspace owns its own error state;
   FinanceScreen.reload previously cleared only the parent's error.

## Minimal change

Capture the HTMLFormElement before awaiting. Reset that captured form only after
save success. Clear transient Phase 2 feedback when a new Phase 2 snapshot value
arrives; do not remount the workspace, reset failed input, retry a write, or relax
CAS, validation, SQLCipher, DPAPI or IPC rules. A full WebView reload was not
reproduced; the stale-feedback test covers in-app snapshot refresh.

## Evidence and limits

- Before the fix, the strengthened FinanceScreen test failed after the success
  message because the account form did not reset. The seven new regressions
  also failed: six deferred-success forms and stale feedback after refresh.
- After the fix, both React suites pass (20 tests). All six forms share the fix:
  brokerage account, instrument, trade, dividend, cash/deposit/savings and debt.
- Tests cover delayed save completion, one request, no false alert, failure
  input retention, sanitized errors and same-value versus fresh-value refresh.
- These are rendered React/jsdom tests with a mocked persistence boundary, not
  SQLCipher or Windows IPC persistence evidence.
- Native replace_phase2 returns success only after its transaction commits.
  That source contract does not prove a particular reported user write committed.
  A rejected/uncertain IPC response also cannot prove that no commit occurred.
- Existing investment UI coverage checked the success message and payload but
  not form reset or absence of the error. Native Windows CDP QA covered income
  seed/reopen flows and did not submit Phase 2 forms.

The published TESTABLE is immutable and still has the bug. A separately approved
controller repin, new TESTABLE and Windows synthetic UI revalidation are needed
after this source change. The current main controller stays pinned to daab156;
its gate must reject a different PR #21 HEAD. No publication or approval is
performed by this fix, and PR #21 remains Draft/unmerged.

Validation: full frontend Vitest suite passed (180 files, 1,190 tests),
TypeScript `tsc --noEmit` passed, and `git diff --check` passed. Five independent
read-only review perspectives found no new blocking issue. No local Rust build,
installed-app execution or production data access was performed.
