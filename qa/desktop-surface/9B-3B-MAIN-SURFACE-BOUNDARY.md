# 9B-3B Main / Disposable Surface boundary

This is a pure synthetic QA contract. No Tauri command, WebView2, HWND,
filesystem persistence, native driver, or production application is connected.
Actual Windows behavior and WebView2 state preservation are NOT VERIFIED.

## Ownership and projection

`main_boundary_state::Authoritative` exclusively owns synthetic work data,
unsaved input, authentication and permission, user settings, and work progress.
Its fields are private. `Boundary` owns both that value and a private existing
`Router`. No mutable Router or authoritative state is exposed to a Surface.
Trusted Main policy methods can revoke authentication, permission or OpenMain
allowance; those methods are not part of a Surface adapter or command schema.

The existing immutable `Projection` contains only revision (`u64`) and an
aggregate open-task count (`u32`). It has private fields and read-only getters.
It includes no raw work, unsaved text, credentials, tokens, settings, or paths.
Work progress is separate from the aggregate task count. A detached copied
projection cannot mutate Main. Access through Boundary requires an available,
current binding and no protocol fault.

## Command processing

The existing `CommandRequest` carries binding (opaque instance plus ticket
containing generation and operation identity), event sequence, action, and
projection revision. Actions remain `OpenMain` and `RefreshProjection`.
The former is subject to Main's allowlist; both require current authentication
and permission. Processing returns a decision only, with no native action or
authoritative-state write.

Router accepts consecutive events into a bounded eight-request queue. Main
rechecks instance, generation, operation, availability, protocol health and the
entire issued head request before checking current authorization and allowlist.
Routing alone therefore grants no execution authority. A duplicate, fabricated,
or reordered request is rejected without consuming the expected queued request.
A valid queued request denied by current authorization or allowlist is consumed;
the next issued request remains processable. No denied request can be replayed
after permissions change. A queue gap must be corrected by supplying its head.

## Lifecycle and failure

All lifecycle transitions delegate to the existing Router and Surface state
machine. Notice handling reuses the actual `own_coordinator::observed` helper.
It performs no native action. Queue overflow and callback protocol mismatch
latch fail-closed access and cleanup uncertainty. Native loss also blocks access.
Main-owned data is independent of those failures.

Creation, loss and disposal leave cleanup uncertain until explicit confirmation
for the current exact binding while unavailable. `confirm_cleanup` is only a
synthetic trusted-adapter assertion, not evidence of native cleanup. It cannot
confirm an available or creating Surface, nor clear another operation's latch.
No automatic retry exists. Lost/failed-create retry additionally uses the
existing explicit retry path and budget. Failed disposal continues to prohibit
new creation even after confirmation; this contract provides no native recovery
implementation. An old command remains rejected after a new instance is bound.

## Synthetic evidence scope

Tests exercise real Router, Surface and Coordinator helper rather than cloned
lifecycle logic. Full Authoritative equality before/after loss, disposal,
recreation, normal decision and queue failure simultaneously verifies unsaved
input, work data, authentication, permission, settings and progress preservation.
Separate tests cover authentication/permission revocation after queueing,
minimal projection, valid decisions, stale instance/generation/operation,
duplicates and reordering at both boundaries, policy denial, cleanup uncertainty,
failed creation/disposal, previous-instance requests and callback mismatch.

This does not implement an asynchronous lifecycle, native cleanup proof,
operating Main HWND access, attach/detach, or a production UI integration.

## Checkpoint verification

Verified on 2026-10-17 against parent source `e31cc0b15fdd3a63da04730969e017567818071d`.
All build outputs used dedicated `C:/Users/Public/Documents/BOGUNON-9b3b-output`
directories; no native Runner or Runtime Gate was invoked.

| Check | Observed result |
| --- | --- |
| New boundary scenarios | 21 passed; all 18 requested cases mapped |
| Complete synthetic library Harness | 229 passed |
| Existing synthetic subprocess fixture | 20 passed |
| Own synthetic subprocess fixture | 1 passed, covering 33 synthetic child cases |
| Fresh isolated legacy pure regression | 27 passed; 1 real-Shell test excluded |
| Offline locked all-features/all-targets Cargo check | Exit 0; existing dead-code warnings |
| Scoped rustfmt and diff whitespace audit | Passed |
| Independent goal, quality, security, context and execution reviews | All five passed |

The runtime audit rejected queued commands after authorization loss or Surface
loss, rejected replay/reordering at Main processing, and retained cleanup
uncertainty after stale confirmation or queue overflow. Those observations use
the actual boundary and reused models through the synthetic Harness.

Rust LSP diagnostics were unavailable because its daemon request timed out.
Cargo compiler checks completed successfully; no LSP success is claimed.
The recorded failing-first increment was the missing authentication-revocation
setter (E0599), followed by passing tests. An initial hook interruption prevented
a recorded red run for the entire initial implementation; full TDD provenance
is not claimed.
