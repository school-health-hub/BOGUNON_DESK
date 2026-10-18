# 9B-3L-A Surface Broker Core

Baseline: codex/desktop-surface-core-9b2a at 92220d46cccd6423bd75cfadba134ccecb34b4cd, clean before changes.

## Disconnected contract

src-tauri/src/surface_broker is pure std Rust, exported by one module declaration. No Tauri command, window adapter, runtime state, renderer, Channel, repository, filesystem, credentials, network, Explorer backend or Native Owner is connected. Actual caller authentication is NOT IMPLEMENTED. The in-process Binding cannot be deserialized and is not an IPC credential. Future adapters must authenticate actual registered resources before using this model.

Registry binding uses distinct Arc instance and operation identities plus checked generation. Sequence must increase; equal/lower requests are rejected, and u64::MAX closes admission as exhaustion. Active accepts requests; explicit retiring closes admission. Synthetic confirmation moves Retiring to Retired and issues a consumed, non-Clone matching receipt. Only explicit replacement of Retired with its receipt creates a new instance/operation and checked generation. Loss or uncertainty enters CleanupUnknown, which cannot confirm cleanup or replace. No timers, Drop success, retries or automatic recreation exist.

Pending results are single-consumption values. Completion revalidates active binding, latest admitted sequence and publication epoch. A newer admitted request supersedes older results. Main loss, logout and permission change invalidate cached projection and pending intents. A new OpenMain request remains available without authentication.

## Actions and projection

Exactly OpenMain and RefreshProjection exist. OpenMain queries only an abstract existing-admitted-Main observer at admission and completion, returning an intent. It cannot create Main or perform login/business work; actual show/focus execution and its final identity recheck remain future adapter work. Main absence/retirement is MainUnavailable. The observer contract requires a side-effect-free observation; the core cannot verify a future implementor.

RefreshProjection returns only an explicitly published immutable revision-only Projection. Missing producer/cache is Unavailable, never invented zero. No name/title/body/string/map/rows/token/path fields exist. Publication revisions increase across invalidations. Current publisher is explicitly Synthetic only; no actual approved production producer exists. Backend logout/permission/Main-loss hooks are not wired in this step.

Broker<Synthetic> and CleanupReceipt<Synthetic> cannot become the reserved TauriObserved domain. No native receipt issuer or Native QA Proof conversion exists. A synthetic confirmation does not prove Tauri, WebView2 or Windows cleanup. The receipt is a future Surface-specific boundary, distinct from historical own-QA-class Native A+B Proof.

## Evidence and limits

External validation logs: C:/Users/Public/Documents/BOGUNON-broker-core-output.

The stale OpenMain regression was reproduced: begin(OpenMain) -> main_lost -> complete with Main present returned OpenExistingMain. The added test failed (stale-open-red exit101); publication epoch validation before either outcome fixes it. This does not solve OS identity/effect TOCTOU in a future adapter.

Runtime audit hypotheses exercised through the real pure model: (1) cached projection could survive logout/Main loss; invalidation and pending-result tests reject it; (2) a retired binding or foreign receipt could authorize replacement; matching-state/identity tests reject it; (3) stale OpenMain could target later Main; red regression then fixed epoch check rejects it.

Compile-only negative checks are reproducible with bash qa/surface-broker/check-type-boundaries.sh followed by an external output directory. The compiler rejects an additional sensitive Projection field, Synthetic receipt passed as TauriObserved receipt, and a foreign proof object used as a Surface cleanup receipt. These are type-contract checks, not OS observations.

Remaining work: browser origin/profile/storage isolation, trusted minimal production producer with publication revocation hooks, actual caller identity adapter, renderer isolation, Tauri Surface cleanup observations/receipt issuer, separately approved Windows verification. Explorer/WorkerW and Native QA integration are absent. Existing E2 navigation/same-URL callback/queued-delivery TOCTOU limitations remain. No actual Windows noninterference claim is made.

## Completed checks

- Standalone real pure model: 20 passed, independently recompiled/executed by the QA reviewer; no Native APIs.
- Library: 405 passed, 0 failed, 1 explicitly filtered actual Windows shell probe. library.log/library.exit=0.
- Compile-fail boundaries: 3 passed, types.exit=0.
- Final Cargo offline/locked all-target check: check-final.exit=0. Existing Evidence::write_json dead-code warning remains unrelated.
- TypeScript noEmit: typescript.exit=0. Scoped rustfmt including lib.rs and diff whitespace audit pass.
- Protected historical artifacts: all 15 SHA-256 match; legacy Runner/Gate/Evidence source manifest all 40 match. Existing Main50 commands/signatures/ACL/Guard/Channel and all Native QA sources are unchanged by the source diff.
- Five independent review lanes (goal, security, quality, scope/context, pure-model execution) completed PASS after the stale OpenMain fix.
- Earlier frontend runs are retained: unrestricted concurrency yielded 5 timeouts; two-worker full run yielded 2 timeouts. No assertions, test code or timeout limits were changed. The final full run uses one worker and actual generated ACL checking.

The code files have distinct responsibilities: broker action/publication contract, registry/receipt admission, behavioral regression scenarios. They contain no unsafe code, untyped payloads or operational logging. Test module is in the 200-250 LOC warning band; split by lifecycle/publication if expanded further.
- Final frontend full suite: 163 files, 988 passed, 0 failed; frontend-serial.exit=0 with BOGUNON_VERIFY_GENERATED_ACL=1 and --maxWorkers=1. Previously timing-out cases pass without changing assertions or timeouts.

Final source/Synthetic verdict: BROKER_CORE_READY. Actual Tauri caller identity, runtime producer/revocation hooks, browser storage separation, Tauri cleanup and Windows/WebView2 behavior are NOT VERIFIED. This checkpoint grants no Live execution approval.
