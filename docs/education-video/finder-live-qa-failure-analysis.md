# Finder first live-attempt failure analysis

Scope: base 6941b94879677393d4bf7a7063370e4108306aae. The first attempt's raw response, HTTP status and request prompt were not captured. Fixtures below are synthetic, never claimed to be that response.

## Exact error path

AiVideoFinder.prepare snapshots form conditions and builds the prompt. The editable official-document confirmation passes its final outboundText to ChatGptConnectionContext.searchWeb, chatGptPlanService.searchWeb, then webSearch.searchChatGptWebNative and Tauri chatgpt_search_web. The native QA command reuses plan::web_search::search_web, validates the model/prompt and existing access credential, reserves the durable attempt before HTTP, and POSTs the Responses request with web_search to the fixed endpoint. The response passes ensure_success, shared parse_response_stream, and web_search_parser::parse. A successful native result is parsed by parseWebSearchResult and then parseVideoSearchResult.

The exact visible string is ERROR_MESSAGES.invalidResponse in src/chatgpt/chatgptPlanService.ts. Native InvalidResponse DTOs or frontend IPC-envelope validation failures map to it. Native causes include oversized response, unclassified non-200 HTTP status, malformed/missing/failed/incomplete SSE, absent completed search/source/text, or unsafe source URLs. HTTP401/403/429 have distinct mappings; ordinary transport failure maps temporaryFailure. Model/prompt rejection maps permissionDenied. Valid sources with videos:[] produce empty results, not this error. Malformed candidate JSON currently throws a general Korean Error that is normalized to unavailable, a different notice.

## Evidence limit

The first durable receipt proves the native model/auth/body gates and request reservation were reached. It is written BEFORE builder.send, so it alone does not prove the server received the request. No success receipt exists. HTTP status/body/event details were discarded and the process was launched without stdout capture. Current source reads status/request-id/error code internally but does not persist them. Exact first-attempt status and root cause remain UNKNOWN; parsing failure and unclassified HTTP rejection are hypotheses, not established facts.

## Conditions

Initial state is empty topic, elementary target, 10minutes, public-first. It is local React state, not a restored approved QA preset. Identity changes clear results but retain conditions; tab/document remount resets defaults; loading saved entries replaces conditions. Form fields remain editable during a request. Confirmation text can be edited independently of the stored condition snapshot. Thus a screenshot showing gender-equality/elementary/10minutes is not proof of the exact sent prompt. No first-attempt prompt hash was recorded. The approved drug/high-school/20minutes scenario was not validated.

## Offline verification

Synthetic Rust parser fixtures cover completed source-backed SSE, missing/failed/incomplete events, empty/non-SSE/invalid JSON structures, missing sources/text, unsafe URLs, and zero-video output. Frontend fixtures cover distinct native error DTOs, malformed IPC envelopes, valid empty results, malformed candidate JSON, in-flight condition changes, and editable confirmation payloads. None contacts an external service.

## Explicitly approved second attempt

The human separately approved ONE extra live search after analysis/offline tests, plus the minimum QA-only instrumentation/build. Preserve slot1 forever; reserve slot2 atomically once, requiring slot1. Never delete receipts to retry. Reject the QA command before authentication/reservation unless the full UTF8 prompt is exactly964bytes with SHA256 e806072de6813dbb960686403f4d88f4eef5a682c3f13909d441b14f85b4e802. The fingerprint derives from buildVideoSearchPrompt(drug prevention, high-school,20minutes,public-first); a frontend test verifies it. No production auth/model/parser policy change is made.

Diagnostics persist only bounded structural counts, finite status/event/error categories, HTTP status and request-id-presence. No prompt, response text/body, URLs, account fields, tokens or secret keys are saved. Write before HTTP fail-closed; record after-HTTP structure, shared-parser acceptance, and native final code in separate immutable files. Diagnostics cannot retroactively recover attempt1. The second attempt permits no additional AI review.

Preflight: verify source/exe hash and metadata slot2; slot1 present and slot2 absent; existing read-only connection and account-supported model available. Operator alone controls QA while setting all four approved conditions, reads the exact confirmation and checks the fingerprint guard, then confirms once. After completion inspect redacted diagnostics and UI, preserve evidence, and stop without retry regardless of outcome. Both existing YouTube/Proxy dispatch flags remain false.

## Official interface recheck

OpenAI documentation (checked2026-10-22) requires store:false,stream:true,array input and the public Responses endpoint for this plan flow. It states web search is subject to model and account/workspace policy; a listed model is not proof of account permission. The implemented request avoids the documented unsupported fields. References: https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference and https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations . No inference call was made for this documentation check.
