# Surface Windows QA execution design (not authorization)

Baseline source: `a3acee1b7511559977dfbc7aa5b7a5d2a8816de3` plus the separately recorded 9B-3L-E checkpoint. This stage creates no QA artifact, runner, approval, claim or runtime Evidence. Explorer backend remains Disabled. Historical Native A+B Evidence does not authorize or verify Tauri resources.

## Independent artifact and admission

A future QA-only process must contain a dedicated entrypoint and manifest/descriptor/scope distinct from every existing Runner. Build only after the unresolved effective-UDF observation bootstrap is reviewed. Record exact final source commit, clean snapshot hash, locked dependency hash, target/profile/features and embedded identity; then build, hash the PE, create manifest, hash manifest, create descriptor and hash descriptor, finally bind these values. Do not embed an executable's own final hash in itself. No arbitrary HWND/PID/path input, no production startup or Main login/data repository.

A separate human approval must bind the exact PE, source, manifest, descriptor, output namespace and one hidden Surface maximum. A one-shot create_new claim must be written, flushed and synchronized before a private non-clone permit is consumed. Claim collision has no renamed-path retry. Opt-in/hash matching is not human approval. Every failed precondition means zero Tauri construction calls.

## UDF and Main protection

Use a new disposable QA root, with two explicitly isolated directories and a synthetic QA Main fixture. Do not run the operational Main, inspect its profile contents or use its storage. A fixture cannot prove the operational Main is unaffected; require a separate reviewed operational comparison before that broader claim.

Require absolute canonical disjoint directories; reject equal/nested paths, reparse ancestors, missing directories, unknown filesystem observations, any WEBVIEW2_* override and environment change. Directory preparation may occur only under an approved new QA root. Preserve existing Main defaults and all operational profile contents. Configuration checks cannot exclude registry/policy overrides.

The actual environment UserDataFolder getter is postcreation. A future implementation must resolve the precreate effective-isolation Gate versus postcreate getter without silently accepting configuration as proof. A reviewed quarantined blank-only bootstrap with no app assets/IPC may be considered in a separate stage, but is NOT enabled by this design. If trustworthy actual Main/Surface effective directory separation cannot be observed, do not load Surface assets; report Unknown and attempt only known-owned cleanup.

## Exact scope and preflight

Independent process, one creator thread, one hidden QA Surface, fixed closed assets/CSP/origin, no recreation or retries. No Explorer/WorkerW, parenting, style/z-order mutation, Native QA owner, Main business commands, Main Channel, operational credentials, external navigation, downloads, popup or OS queued-message dispatch. Verify all Main command ACLs deny Surface.

Before execution: exact hashes/source clean, dedicated approval/opt-in, absent claim/output/staging, create_new write/sync probe in new namespace, path/reparse/override checks, Medium integrity, interactive input desktop, preservation manifests, bounded outer observation policy and explicit hang/abort limits. No unapproved process termination. Source/PE immutability protection and its limits must be recorded.

## Ownership, failure and cleanup

Track reservation, construction attempted, returned exact Window/WebView pins, registered identity, retirement and cleanup observations separately. A build error with no returned resource may leave a partial native resource: never destroy a resource selected only by label. No safe public recovery handle means CleanupUnknown and no replacement. Exact returned resources may receive a single identity-checked destroy attempt even after normal admission fails.

Record CloseRequested, Destroyed, Window registry observations and WebView registry observations separately. Locked stable Tauri exposes only combined get_webview_window; a missing combined lookup means each individual resource is Unobserved, not proven absent. Independent get_window/get_webview APIs require unstable and are not enabled. A future supported observer is required before individual absence can be certified. Backend registration/pins retained, unknown identity, missing callbacks or incomplete release observations remain Unknown. DestroyWindow/close dispatch, Destroyed, registry absence, process exit and Drop are not full WebView2/environment/profile release proofs. Never convert Native QA A+B to a Tauri cleanup receipt.

## Evidence and outcome

Use a new sanitized schema: artifact/source/manifest/descriptor/binding hashes, approval reference, Gate/claim results, configured versus effective UDF observation status (no user paths), ownership stages, navigation denial reason enum, lifecycle result, separate cleanup observations, backend release status, proof kind, process start/end, output hashes and final exit. Exclude raw handles/PID/TID/profile paths/cookies/credentials/callback bodies. Separate external supervisor observations from process self-report.

create_new staging -> write -> flush/sync -> reread/hash -> non-overwrite publish. Existing Evidence/Claim/approvals are immutable. Self-report cannot certify its own later stdout or publication success. Capture stdout/stderr and exit externally; preserve partial staging on failure rather than overwrite.

Suggested precedence: cleanup failed/Unknown exit5, panic exit4 when cleanup is independently known, lifecycle exit3, Gate exit2 before creation, Evidence/output exit6, success0 only if every explicitly required scoped observation is proven. Abort/hang/no final record => EXECUTION_UNCERTAIN; process disappearance does not infer cleanup. No automatic retry. A narrower successful Tauri resource-retirement observation must not be named complete OS/WebView2 cleanup.

## Windows-only evidence still required

Effective UDF/policy/registry behavior; initial blank/global-hook ordering; real redirect/new-window/download denial; callback/resource retirement ordering; partial-create ownership recovery; backend and WebView2/environment release; no operational Main interference. No OS queue quiet, Pump Stop C, join, asynchronous lifecycle or future-message absence claim. This document grants no execution permission.
