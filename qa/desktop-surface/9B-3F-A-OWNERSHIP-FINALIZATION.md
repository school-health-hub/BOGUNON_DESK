# 9B-3F-A synthetic ownership and finalization boundary

Scope: pure Rust QA contracts under qa/desktop-surface. This phase does not create an OS resource, actual native owner, window, message pump, Runner, Gate, application entry point, or executable target. Existing own_main/own_execution/own_native/own_gate/own_store behavior remains outside this change.

## Receipts and trust

OwnerReceipt<P>, FinalizationReceipt<P>, and CleanupProof<P> have private fields and carry distinct Synthetic/Native marker types. There is no Native constructor, issuer, conversion, promotion, From implementation, or method accepting observation booleans to brand them Native. The current Outcome and Adapter consume Synthetic receipts only. Rust privacy is a module boundary within this source tree, not a cryptographic credential or protection against changing trusted source.

OwnerReceipt retains a unique Arc allocation identity plus immutable creation Binding (Surface instance, generation, creation operation), branded LedgerToken, creator thread, class/PID/TID observations, and Owned/Partial/Unknown resource ownership. Read-only creation access cannot mutate the receipt. A creation response must match the pending creation Binding and Owned status before availability. No request constructor accepts an HWND, PID, or path.

Fake tracks the active disposal Binding separately. It never rewrites the creation receipt. Disposal must stay within the creation instance and generation, with a distinct operation. Finalization checks the exact verify Request, active Binding, creation owner identity and metadata, creator thread, terminal expected generation, ownership, destruction, post-Ledger state, residual count, class release, callback-context clearance, and owner release. CleanupProof retains that exact finalization receipt.

Confirmation has Confirmed/Failed/Unknown variants for destruction, Ledger state, class release, callback clearance, and owner release. Residual None is distinct from Some(0). Every failed, unknown, partial, or missing result rejects cleanup. An ordinary Result<()> or zero residual count cannot mint proof. A per-owner attempt latch prevents repeated finalization even with a newly forged sequence; a separate success latch prevents new Fake allocation after unconfirmed cleanup.

Fake uses the existing Ledger reserve/register/bind_disposal/notice/drain operations. The live-Ledger hostile case allocates a second synthetic ledger entry through reserve/register; it does not simply assert a live boolean. Other faults deliberately alter synthetic observations. Constants 7/11/13 and synthetic handles are model values with no claimed relationship to actual Win32 facts. Neither successful destruction nor class/context/owner release here is an OS observation.

## Validation receipts

Behavioral red: ownership_boundary_duplicate_finalization_cannot_mint_again failed before implementation because the same owner could mint a second CleanupVerified proof for an incremented request sequence. The same test passes after the attempt latch.

Targeted command (2026-10-17):

    CARGO_TARGET_DIR=C:/Users/Public/Documents/BOGUNON-9b3fa-output/target cargo test --offline --locked --manifest-path qa/desktop-surface/Cargo.toml --lib ownership_boundary

Result: 27 passed, 0 failed. Coverage includes normal receipts; immutable creation observations through disposal; foreign owner and foreign creation binding; stale generation and operation; duplicate finalization; thread/token/class/PID/TID mismatch; failed and unknown destruction; actual live Ledger and unknown ledger; residual Some(1)/None; failed and unknown class release, callback clearance, owner release; partial/unknown create; replacement before cleanup; full authoritative Main equality.

Preserved targeted command with --lib native_contract: 22 passed, 0 failed. Existing stale-proof, foreign-owner proof, exact envelope/replay, callback queue and Ledger tests remain in that suite. Root also independently validates all Async/Main and full offline checks.

Root-owned native_boundary_compile.rs is an import-only crate compiled directly with rustc --crate-type lib --emit metadata, outside Cargo targets. Root reproduced the non-test Adapter::inspect failure (AsyncSurface::inspect is test-only), then verified normal metadata compilation after matching the Adapter inspector cfg(test). Nine negative compile probes reject Synthetic-to-Native proof/owner/finalization substitution (E0308), Native synthetic constructors (E0599), non-test Adapter::inspect (E0599), public CleanupProof struct construction (E0451), external Synthetic receipt construction (E0624), and creation mutation (E0594). No Main inspector is exposed in non-test code.

## Limits and future seam

This candidate proves model protocol boundaries, Rust provenance separation, and fail-closed response handling. It does not prove actual native ownership, class registration ownership, PID/TID observations, destruction, callback detachment, or native release. The Native marker is a closed reservation with no issuer. A future separately reviewed native implementation must own private construction, gather independent actual resource observations, maintain immutable creation identity with exact current-operation lineage, and issue a Native finalization only after independently confirmed cleanup. It must not reuse Fake or promote Synthetic receipts.

No dependencies, manifests, lockfiles, production/frontend/Tauri code, or existing own_* runtime modules were changed. Touched modules own single responsibilities (contract envelopes, immutable creation receipt, finalization verification, synthetic operations, synthetic cleanup, Adapter admission, scenario tests). Maximum touched implementation pure LOC remains below 250; adapter and Fake are in the 200–250 warning band and should split before further expansion. No unsafe code or untyped errors were added.

## Checkpoint verification

Verified on 2026-10-17 against parent 4fa3e05530a8baad27c45c7c5ab69b0ea82ca53d.
All outputs are isolated under C:/Users/Public/Documents/BOGUNON-9b3fa-output.

| Check | Observed result |
| --- | --- |
| New ownership Synthetic suite | 27 passed, independently rerun |
| Full Library Harness | 298 passed |
| Existing Native Contract / Async / Main Boundary | 22 / 20 / 21 passed, subsets of Harness |
| Existing protocol subprocess | 20 passed |
| Own synthetic subprocess | 1 passed, 33 child cases |
| Fresh isolated legacy pure regression | 27 passed, 1 real-Shell test excluded |
| Offline locked all-features/all-targets Cargo check | Exit 0 |
| Actual modules compiled without cfg(test), metadata only | Exit 0 |
| Forbidden type/API operations | All 9 rejected with expected diagnostics |
| Scoped rustfmt / diff whitespace audit | Passed |
| Independent goal / quality / security / context / execution review | All five PASS |

Cargo checks retain dead-code warnings, including the deliberately unissued Native
marker. The compile-only root also has intentionally unused metadata-only code.
No diagnostic suppression was introduced. No LSP success is claimed.

The integrator personally drove all 27 ownership scenarios. Runtime audit checked
three hypotheses: the inspector mismatch could survive all-target checks; cloned
or stale ownership could release replacement; missing finalization observations
could mint proof or be branded Native. The non-test red/green, provenance compile
rejections, duplicate-owner and per-field failure/Unknown scenarios are observed
evidence against those failures in this model. No temporary source instrumentation
or test-only copy of lifecycle logic was added.

First exact successful creation enrolls its owner from the trusted Synthetic
issuer; subsequent responses/proofs must match that accepted owner. There is no
pre-enrolled actual Native executor in this phase. A future Native issuer needs
an exclusive executor/owner allocation boundary, not acceptance of arbitrary
caller-supplied observations. Type reservation is not Native implementation or
execution approval.
