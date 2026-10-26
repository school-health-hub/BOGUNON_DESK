# Finder Phase 2E-1A: request identity and safe errors

Base: Desktop `ba88abc770c25a8b79438800bfb34f255ad474c6`; Proxy `02b04e0c1344be9ef719c232f5ce7e778e61bf6b`.

## Request identity

Each new Finder server-search submit creates a `createSearchOperation(conditions)` object with a UUID v4 and an immutable snapshot of the conditions. Re-executing that same operation retains its UUID and original conditions. A new submit creates a new UUID even when conditions are unchanged. No automatic retry or retry button is introduced.

The operation retains no credential. Every execution reads the current session and retains the existing expiry, account and in-flight ownership checks. UI objects are transient; IDs and credentials are not written to the video library or logs.

Flow: Finder submit → operation UUID → `SearchDependencies.transport(request, accessToken, requestId)` → `education_video_search({request, accessToken, requestId})` → validated native `RequestPlan.request_id` → `x-education-video-request-id` header.

The JSON business body remains exactly `{topic,audience,desiredMinutes}`. Native accepts canonical hyphenated RFC UUIDs and canonicalizes header casing. It never creates a replacement identity. The Proxy already validates the UUID header, binds it to the authenticated user and normalized query, and uses its existing durable idempotency contract. The Proxy still generates a UUID for callers that omit the header; Desktop now supplies it.

## Safe error contract

Native accepts only the existing Proxy envelope `{error:{code,message}}`, within the existing response-size bound, and requires an allowed code/status pair. It discards the supplied message and renders a fixed local message.

| HTTP | Preserved Proxy code |
| --- | --- |
| 400 | INVALID_REQUEST |
| 401 | UNAUTHORIZED |
| 403 | FORBIDDEN |
| 409 | SEARCH_BUSY |
| 429 | QUOTA_EXCEEDED, UPSTREAM_QUOTA |
| 502 | UPSTREAM_INVALID |
| 503 | NOT_CONFIGURED, UNAVAILABLE, UPSTREAM_UNAVAILABLE |

Malformed/unknown/mismatched envelopes use the existing safe status fallback, never upstream text. Authentication failures remain generic. Timeout, redirect rejection, fixed destination and 256 KiB body limits remain in place.

## Scope and verification limits

Both external-dispatch constants remain false. The normal native command still returns `REAL_DISPATCH_DISABLED`; the real Proxy route still does not bind a prepared provider. No new external fetch binding, Auth/quota/SQL redesign, actual API call or database change is included.

The existing Phase 2D QA app uses its separate synthetic search command. It deliberately retains that contract; its passing UI test is not proof of normal native HTTP/IPC execution. The lightweight native harness compiles the exact pure request/response modules, not the Tauri command or reqwest HTTP client. No full native build is performed.

Focused verification receipts are recorded after execution; existing QA data, dist files and build caches are preserved.

## Executed verification (2026-10-22)

- Desktop focused Vitest: 26/26 across requestIdentity, searchService, Phase2Finder, EducationVideoQaApp and EducationVideoFinder. After replacing unsupported test-only Array.at calls with typed indexing, affected Phase2Finder tests passed again (7/7).
- Desktop and Proxy full `node node_modules/typescript/bin/tsc --noEmit --incremental false`: exit 0.
- Native exact-source lightweight harness: 28/28; focused transport subset: 10/10. No full Tauri/reqwest compilation or ordinary native IPC execution was performed.
- Proxy request-contract/prepared-handler/durable suite: 26/26. Independent QA separately passed Desktop 16/16 and Proxy contract 16/16.
- Personal HTTP driver against the prepared handler on ephemeral loopback observed 200, 200, 409; same-ID replay was identical without another provider dispatch. Authentication/provider/ledger were injected synthetic fixtures. Cleanup endpoint was called, but its plain-text response caused the driver's JSON parser to exit 1 after successful assertions; independent port-closure verification passed. No external service was contacted.
- Five independent review lanes (goal, code, security, QA, context) reviewed the scoped change. Terminal verdicts are required before commit.

Runtime audit hypotheses: request identity might change on retry (same-operation test and HTTP replay disproved); raw upstream errors might leak or lose SEARCH_BUSY (strict native status/code tests and fixed UI-message tests disproved); transport safety might regress (native timeout/redirect/body-cap tests and unchanged false gates passed).

Full native build, actual Auth/PostgREST/YouTube calls and live service composition remain NOT RUN. Detailed local `.omo` receipts are ignored and are not part of this source checkpoint; the commands and summarized results above are portable. Existing caches and QA data were not deleted.

Final review gate: all five lanes returned terminal PASS. Checkpoint security review: complete intended source/doc files inspected with best-effort key/JWT/private-key/credential/PII patterns and scoped diff review; no findings. No dedicated secret scanner was installed, so residual detection risk remains. Local ignored evidence is not uploaded.
