# Purchase Helper AI-FIRST image import

Base: integration/electron-feature-baseline@f11c3a899268b029df537f7b250296c0eedc05f6.
Branch: feature/electron-purchase-ai-first-glass. Previous 709799c worktree/WIP preserved.
TD2 Glass, Dashboard geometry, SurfaceDialog and all saved settings/data contracts unchanged.

## User flow

Select original JPG/JPEG/PNG through existing Main IPC → default Connected AI mode →
explicit provider/model choice → exclude images or redact rectangles by mouse/keyboard →
prepare exact transmission previews → user checks external-transfer/usage consent → native
Main confirmation lists provider/model/images/redaction counts/full SHA-256 → one request →
strict review-only result → edit and approve each item → confirm append/replace → existing
PurchaseItem/math/CSV/XLSX/settlement/fixed-four-column Edufine writers.

No request on selection/prepare/connection-state read. No automatic provider or OCR fallback.
Local OCR remains a manual mode, including P1/P2 rotation/enhancement/layout/evidence.
The image picker no longer requires OCR resources; OCR execution still validates them.
No original files are modified. No renderer paths/URLs/keys/tokens cross the new IPC.

## Capability and entitlement gate

This is not a name-pattern guess or blanket vision enablement. Reviewed official entries:
- gpt-6.1-sol: https://developers.openai.com/api/docs/models/gpt-6.1-sol
- ChatGPT direct images conditional on model: https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- gemini-3.8-flash: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash

The versioned capability record (reviewed 2026-11-04, valid until 2027-02-04) is intersected
with the authenticated connection's actual model catalog. ChatGPT additionally requires
ready state and chatgpt.tokens.use.direct scope, current account binding and a fresh native
catalog check after consent before inference. Unknown models/routes/expired policy and
missing scopes fail closed. The server still makes the final per-request authorization
and billing decision. Catalog/docs are not proof a real image request succeeded. No paid
API/model probe is made to populate the UI. Other models need a reviewed capability entry;
no image generation, Files upload API, external image URLs or tools are enabled.

ChatGPT and either existing API connection coexist. Existing API credential, OAuth,
DPAPI, registration paths and text request envelopes stay unchanged. Selected image model
is independent of the text model. Connection changes invalidate prepared requests. Busy
text requests cannot be cancelled by an image operation that never acquired that service.

## Main-owned transmission and privacy

The existing opaque token/sourceId selection owns normalized private PNGs. Main-only
readSource verifies ownership and bounds, and cleanup waits for pending reads. No new
filesystem capability is exposed. Main decodes a private PNG, copies BGRA bytes, paints
opaque black rectangles (all color/alpha channels), and re-encodes PNG without original
metadata. Source SHA and transmission SHA are distinct. The exact transmission PNG is
previewed; Main rechecks its hash, selected account/model, source generation and expiration
both before and after native consent. One-use prepared IDs prevent replay. Changed
provider/model/inclusion/masks/order invalidate approval; images/row edits clear approval.

Consent text warns about personal/school information, shipping details/phone numbers,
API fees or ChatGPT plan/credits, and the impossibility of retracting sent content.
There is no claim that a heuristic detects all image PII. Users review/redact/exclude.
No images, credentials, prompts or provider diagnostics are logged or auto-saved.

Limits: existing 10 files/10MiB original/12MP per original; AI PNG <=4MiB each, <=8MiB
batch, <=24MP aggregate; serialized request <=12MiB; result <=64KiB and 200 rows; 90s
request timeout; 10min consent lifetime; <=3 outbound attempts per selected session.
No automatic splitting, generation retries or alternate billing path. Transformations
use bounded row copies. Prepared images live only in Main memory and are discarded on
cancel/new selection/navigation/window close/quit. External abort cancels only the owned
API or native operation; stale replies are discarded. Already-sent data cannot be recalled.

## Structured data and existing Purchase protection

A common temporary model stores sourceId, product/option/specification, pack size, order
quantity, applied price/amount, list price/product discount, separate order discount,
shipping/total, evidence quote, uncertainty, duplicate candidates and edit/approval state.
Unknown values stay null/blank; no inferred quantities or guessed prices. Unknown schema
fields (including fabricated coordinates/confidence), foreign/duplicate/missing source IDs,
fractional/negative/oversized values and partial malformed objects are rejected. Explicit
per-image errors are retained separately. Order mismatch warns without allocating coupons
or shipping to items. AI quotes are labelled model claims, not verified OCR/transcriptions.
No fake OCR lines or boxes are constructed. Actual OCR evidence remains unchanged.

Existing option-aware duplicate candidates and manual corrections are reused; no merge or
delete. Results never mutate the purchase list. User edits invalidate item approval. A
source/config change requires reanalysis before stale rows can be approved. Failed/cancelled
analysis retains old review edits and original Purchase list. Existing list snapshot guards
and append/replace confirmation remain. Existing per-item amount mismatch/output blockers
are applied with amountMismatchReviewed:false. Order charges are reference-only, not items.

## Verification boundary

Cloud checks use synthetic images, fake provider/native responses and existing native
Purchase writers. All three provider envelopes and ChatGPT completed/failed/incomplete SSE
are tested independently of actual authentication. Original Rust authentication tests/code
are reused, not reimplemented; this task runs only focused image adapter tests.

Actual API image accuracy, account-specific image authorization, fees/quotas, Windows native
redaction/dialogs/DPAPI/GUI/helper packaging and Portable are NOT RUN. No new workflow,
Portable, paid calls, main/integration update or deployment. Existing unrelated Rust
is_total_row parity issue is not changed or reclassified. Policy expiry requires a reviewed
update, not automatic model-name inference or a silent fallback.

## Cloud verification result

- Focused Vitest: 142 PASS / 21 files (new image boundary + selected API/ChatGPT/OCR UI/IPC/output regressions).
- Rust image adapter: 4 PASS; other 83 existing tests filtered out. Native debug compilation PASS.
- Builder-selected ASAR runtime + native resource/provenance contracts: 5 PASS.
- Electron Main/Renderer/test TypeScript and production build: PASS (existing large-chunk warning).
- Real existing Purchase native writer: synthetic reviewed rows exported to CSV/XLSX,
  settlement and Edufine; fixed four columns and amount mismatch rejection confirmed.
- No actual AI requests, credentials, Windows GUI, Portable or workflow executions.
