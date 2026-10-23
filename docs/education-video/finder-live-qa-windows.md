# Finder Windows Live QA executable

## Current status: diagnostics contract v3, no approved QA5 slot

QA5 has **not been authorized, run, or marked PASS**. The current source contract is SSE diagnostics version3, but the diagnostics are observation-only and do not create a live-request entitlement. Native metadata and its frontend verifier remain authoritative. The runtime still records the previously approved slot4 policy; there is no active slot for QA5. This document does not authorize an AI request, a retry, or a new attempt slot.

Finder policy note: an explicit `response.completed.output: []` is authoritative and is not reconstructed from earlier `response.output_item.done` events. When the final `output` field is absent, the pre-existing completed-item fallback remains available, subject to completed status, assistant role, supported content type, valid Finder JSON, a canonical HTTPS YouTube video URL, and an exact matching search source before any recommendation card can be shown. Diagnostics version3 may describe event structure but never authorizes recovery or recommendation output.

## Historical QA3 and QA4 record

The remaining attempt-slot, diagnostics-v2, build, and execution details describe the completed QA3/QA4 preparations and runs. They are retained as historical evidence only and are not current QA5 instructions. Imperative wording below records the procedure used at that time; it must not be executed as a current runbook without a separately reviewed QA5 slot policy and explicit approval.

Historical approved SSE checkpoint: df8375a015f1868b27d7741a754e0df772837684 (2026-10-23 KST). Original Finder implementation base: f0981bf965b191ca380d5a97afe9aa61f9a1c3d8.
The Windows artifact uses this checkpoint plus the minimum QA wrapper commit. SOURCE.json records both baseSha and actual sourceSha and SHA-256. It must not be described as an unmodified SSE checkpoint binary: the QA overlay adds only the separately approved third-attempt controls and matching provenance stamps.

Build: `.github/workflows/finder-live-qa-windows.yml`, existing pinned Windows checkout/Node/Rust/cache actions, exact event SHA, ancestry and QA-only file guards. No production release environment, signing key, service API key, deployment or installer. Build output is a portable executable with identifier `kr.sungandi.schoolhealthdesk.finderliveqa`.

The QA frontend mounts the existing Finder and common ChatGPT/official-document layers, not the full dashboard, updater, Google or Supabase providers. Existing synthetic QA entry remains unchanged. QA metadata verifies frontend/native source, approved base, identifier, isolated library and false external dispatch.

Existing local ChatGPT credentials are read by the existing native DPAPI storage under the production identifier folder. No credential copies or values are printed. The QA storage rejects every credential mutation and the QA transport rejects discovery, refresh and revoke before HTTP. Expired access credentials therefore block QA; a fresh connection must be prepared by the human in the operating app. The QA does not sign in, disconnect, refresh or change the operating account.

For historical QA3, the first two attempts were preserved permanently and approval permitted only a third slot, requiring both previous receipts and atomically creating search-attempt-3.receipt before HTTP. Its diagnostics and success receipt used slot3 names and could not overwrite earlier records. The command required model gpt-6.1-sol plus the exact964-byte approved public prompt fingerprint BEFORE authentication or reservation. No automatic retry or additional AI review was permitted. Receipts were not to be deleted for retry. Historical QA3 metadata required source/base/id/readOnly/isolation/false-dispatch, diagnostics version2, both old slots used and third slot unused. Bounded structural diagnostics contained no response body/text, prompt, URLs, account data or secrets. Existing YouTube Desktop/Proxy dispatch flags remained false.

Native policy6/6, frontend QA service/preflight4/4, TypeScript and QA frontend build passed before the overlay commit. The Windows executable and live request are not validated by those tests. Exact gpt-6.1-sol native rejection of other supported models was added after review and tested. Existing credential files, installed executable and both prior receipt/diagnostic bytes must be hashed before/after QA; only names/hashes or unchanged booleans may be recorded.

Build once from the final overlay SHA. Both push(workflow path on the feature branch) and workflow_dispatch triggers exist; skip the intermediate checkpoint CI and dispatch only one reviewed final build. Never combine automatic and manual runs for the same QA preparation. SOURCE.json and package guards require search command, metadata command, SSE diagnostic markers and third-slot receipt marker in the executable.

## Run prerequisites

Download the artifact from the successful SHA-bound Actions run; compare SOURCE.json sourceSha/runId and executable SHA-256 to the run. Run only the separate `bogunon-desk-finder-live-qa.exe`, never an installer or the operating executable path. Preserve the production app and all data. A child-only WebView2 debugging argument may be used for local browser QA if native window automation cannot target the QA window; never change machine/user environment or policy.

Preflight before any search: native metadata/SHA match, Finder visible, existing connection connected with plan use enabled, account model catalog contains gpt-6.1-sol, search button enabled and invocation path registered. Do not print account identifiers, tokens, headers, cookies or full connection state. If credentials/model/permission cannot be confirmed, stop with zero search requests.

Approved live input: 고등학생 / 마약류 예방교육 / 20분 내외 / 공공기관 우선. Submit once through the existing privacy confirmation. On error stop; do not retry or replace with a different provider. If successful inspect recommendation cards and their original URLs/sources only, then stop. Do not run AI detailed review, draft generation, library save/reload, document submission or external sharing. Do not record the full prompt or raw response; compare the confirmation prompt SHA in memory. After one success or failure stop.

Local limits: C: about2.9GB and current Perl lacks Locale/Maketext/Simple, so no local fullnative build or package/cache cleanup. Parent automation kernel asset error has no identifiedmissingpath; a freshchildNodeREPL successfully initializedsky and enumeratedwindows. No system/runtime installation changes were made.

## Search button initialization regression

The default search service and web-search module have a circular dependency. An arrow-function export was captured before initialization in the production bundle, leaving searchWeb undefined even after model lookup succeeded. The search operation now uses a hoisted function declaration. The bundled-import regression runs the real Rolldown bundler without network calls and is included before Windows compilation. Rebuild the QA executable to receive the fix; changing the selected model does not repair an older binary. Authentication, supported model allowlist and durable one-search receipts are unchanged.
