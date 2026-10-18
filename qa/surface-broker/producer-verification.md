# 9B-3L-B Main projection publisher

Baseline: e95ae658146a8376997e64dd4573f860b6a34bb8, clean. Scope is pure publisher/lifetime state, a guarded backend contract and inactive storage requirements. No Tauri command, renderer, Surface adapter, operational producer or auth-flow change is added.

## Authority and lifetime

Public Rust facade: main_projection (a reexport of main_lifetime::projection). capture, publish and revoke pass through existing main_caller::run before touching publisher state. Actual Tauri caller Webview/Window resources and local-origin/lifetime admission are checked by the unchanged guard. with_main then verifies actual registered Main resource identity and available state under the existing MainLifetime mutex. Reads also require that registered, admitted Main. No JS label/generation/claim is accepted as authority.

The pure state uses the existing opaque Generation (Arc instance plus generation) and a separate checked publication epoch. PublisherLease binds both. Same-generation work captured before logout/permission revocation cannot restore a cache with a later revision: its epoch is stale. Foreign Main leases and previous navigation generations cannot publish. Navigation request/Started and Main retirement revoke within the same lifetime state lock, before a subsequent publication/read; existing Main command admission, Channel state and event policy are otherwise unchanged.

Logout and permission revocation are explicit pure-state operations and a guarded backend notification API. Existing authentication/login/logout/permission callsites are intentionally not modified. Therefore actual operational producer admission is mechanically unavailable: capture additionally requires &ProducerConnection, an uninhabited public type with no issuer, variants or conversions. Its opaque PublisherLease has no alternate public issuer. A future source cannot be enabled merely by calling this facade; adding a connection issuer requires separate reviewed auth/permission notification integration and authorization-refresh policy. Read currently remains Unavailable because there is no connected runtime producer.

Synthetic test publications instantiate independent pure Lifetime fixtures, whose Arc identities do not match the actual registered runtime state. Legacy Broker<Synthetic> publication remains separate and unchanged. Neither its projection nor its cleanup proof can become the registered-Main publication authority. Nothing here issues Native cleanup evidence or adopts/destroys a Main/Surface HWND.

## Publication policy

Approved data is revision-only, with private fields and no free strings, extension map, user IDs, paths, tokens, raw rows or unsaved input. An explicit first revision of zero is allowed by the pure publisher; no missing value is ever replaced with zero. Publication revisions strictly increase across logout/navigation/retirement invalidation, preserving the watermark. Rejected authority or duplicate/older revision preserves the last valid publication and watermark; trusted revocation always clears it. Epoch exhaustion permanently closes only the publisher, without breaking unrelated Main command admission.

read is an immutable cache observation, not a Surface delivery route or acknowledgement. No business repository, credential store, file, network client or DOM is queried. Broker Core is not connected to a runtime producer; a future authenticated Surface adapter must use this registered-Main cache and revalidate before submission, never promote Synthetic values or fall back to Main Channel/broadcast. A copied/queued result cannot be recalled by this state; final submission checks and Windows navigation/effect TOCTOU remain future work.

## Verification surface and limits

External logs: C:/Users/Public/Documents/BOGUNON-storage-producer-output.

- Pure state QA independently compiled the actual lifetime/publisher implementation using rustc --edition=2021 -Dwarnings: 23 passed (10 publisher + 12 existing lifetime + 1 external type-contract test).
- Library adds two real pure caller-verifier composition/serialization tests and two storage-policy static tests. The fixture includes the existing caller identity source rather than reimplementing it, so its existing 14 tests execute again; these are not claimed as new independent scenarios. Actual Windows caller/Webview resources are not instantiated.
- Negative rustdoc cases cover extra projection fields, forged publisher leases, construction of ProducerConnection and promotion of Synthetic projection into registered-Main projection. They are compile-only checks, not successful operational publication.
- A mutation sensitivity test removes only the navigation revocation hook in an external copied source tree. navigation_invalidates_publisher_and_clears_cache fails with exit101 and stale cached revision; unmodified production pure tests pass. No repository source was mutated for this test.

Failure hypotheses exercised through the actual pure model: (1) same-generation stale work could revive a cache after logout; epoch rejection prevents it; (2) failed revision or foreign publisher could replace the last valid cache; tests preserve publication/watermark; (3) navigation could leave prior cache visible after a new generation admits; the external mutation fails, and actual revocation clears it. Storage-sharing/override hypotheses are source-supported risks, not disproven Windows behavior.

The default-disconnected gate was added after independent security review identified that documentation alone did not prevent operational use before auth/permission notifications existed. Security re-review confirms no safe-Rust connection/lease issuer exists. Necessary security API comments describe that gate; they grant no approval or runtime guarantee.

Actual Tauri/WebView2 resource checks, effective storage paths/profile, browser data separation, auth-event scheduling, same-URL late callbacks and already scheduled submission cancellation are NOT VERIFIED. Existing Main navigation error/abort/public-document-ID limits remain. No app, Native Runner, Windows window, Explorer/WorkerW or operational storage was accessed.

## Completed verification

- Rust Library: 433 passed, 0 failed, 1 explicitly filtered real Windows shell probe (library.exit=0). This is 405 previous tests + 14 new tests + 14 existing caller-verifier tests repeated in the composition fixture.
- Compile-negative rustdoc: 4 passed (type-boundaries.exit=0).
- Frontend with BOGUNON_VERIFY_GENERATED_ACL=1, maxWorkers=1: 163 files, 988 passed, 0 failed (frontend.exit=0).
- Final Cargo offline/locked all-target check, TypeScript noEmit and scoped rustfmt: exit0. Diff whitespace audit passes. Existing unused Event variants / Evidence::write_json warnings remain unchanged source issues; no new production warning remains.
- Independent review: goal, security, quality, context/scope and pure execution lanes PASS. Security's initial disconnected-readiness P1 was resolved by the uninhabited connection gate and re-reviewed.
- Protected artifact manifest: 15/15 SHA-256 match. Historical Runner/Gate/Evidence source manifest: 40/40 match. Existing 50 command implementations/signatures/ACL/Guard and Main Channel sources/configuration are byte-unchanged in the diff. Broker Core, dependency manifests/locks and Main storage configuration are unchanged.

Changed files (one atomic contract checkpoint): src-tauri/src/lib.rs; src-tauri/src/main_lifetime.rs; src-tauri/src/main_lifetime_state.rs; new main_projection.rs, main_projection_state.rs, main_projection_tests.rs, main_projection_caller_tests.rs and surface_storage.rs under src-tauri/src; this verification record; storage-isolation.md. Each new Rust file is below 200 nonblank/noncomment lines. Responsibilities are runtime admission facade, pure publisher state, caller composition tests, state behavior tests and inactive storage requirements. No unsafe code, untyped payload extensions, production unwraps, credential logging or new dependency is introduced.

Final source/contract verdict: ISOLATION_PRODUCER_READY. Operational publishing and Surface creation remain disabled. This is not a claim of Windows storage/profile isolation or execution approval. Enabling a real source requires reviewed auth/permission notification wiring; enabling a Surface requires effective storage/origin verification and separate approval. No push or PR is performed.
