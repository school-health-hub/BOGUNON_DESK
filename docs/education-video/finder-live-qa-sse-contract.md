# Finder SSE offline contract correction

Date: 2026-10-23 KST. Base: `824f85a71a00e27518ffaef8b6ea3e4ac3c7f291`.
Scope: offline changes and synthetic fixtures only. Additional AI requests: **0**; cumulative live search attempts remain **2**. No Windows executable rebuild or deployment in this step.

## Confirmed versus unknown

The second attempt recorded HTTP200, valid SSE, one terminal completed event, sharedStreamAccepted=true, native invalidResponse, and51 events grouped as other. The old counters inspect response.output, not event.item. They do not distinguish missing output from an empty array and cannot recover the51 original event types. No raw response was stored. We cannot prove those events carried search metadata or that this patch fixes the historical service response.

The common `plan::parse_response_stream` reads immutable bytes, returns text deltas and checks completion/error state. Finder discards its text return but passes the original bytes to its own parser. It does not lose raw metadata. It remains unchanged, including general text generation and error/usage handling.

## Official contract and minimal correction

Official references checked2026-10-23:

- [Responses streaming events](https://developers.openai.com/api/reference/resources/responses/streaming-events): response.output_item.done carries a complete item and output_index. Web search lifecycle events carry item references, not source lists. Text/content/annotation events are separate stream events.
- [Web search output and citations](https://developers.openai.com/api/docs/guides/tools-web-search): completed web_search_call output and message output carry tool actions and cited URLs.

The old Finder parser inspected only response.completed.response.output. The new collector also retains complete response.output_item.done payloads by unique index/id, and requires terminal response.status=completed. This uses documented item structures; it does not claim that an omitted final output field is the normal documented Response shape or that it occurred in the live attempt.

A present final output array is authoritative, including an explicit empty array. Any contradictory done item is rejected. Only an absent final output field may use completed items. A wrong output type, duplicate item/index, conflicting final item, missing completion, failed/incomplete/error stream, or incomplete item is rejected. Lifecycle notifications and text deltas alone cannot establish successful search or source evidence. Unknown event types are ignored rather than converted into results.

The collector supplies output to the existing title/URL/citation extraction. HTTPS, no URL credentials, source-count bounds and downstream per-video source matching remain in place. A completed search with an explicit exact {"videos":[]} payload can return zero sources and zero candidates; other source-free text/claimed candidates remain invalid. A completed response with no output items is still a structural failure, not fabricated empty results. The IPC validator uses the same narrow empty-result exception. Incomplete or unverified URLs never become recommendation cards.

## Safe diagnostics

QA retains previous field names and adds fixed-key streamEventCounts, toolLifecycleCounts, finalOutput presence/kind/count, completedItemCounts and completedItemEvidence. Final and item-done evidence are counted separately; their raw counts are not unique-source counts. Unknown names are counted as unknown without recording their actual strings. SearchParseReason is a finite structural code such as missingOutput, missingCompletedSearch, missingSources, malformedEvent, conflictingOutput or failedStream. The common stream acceptance remains separately visible.

No OAuth token, prompt, response body/text, URL, item/request ID value, account detail, or provider error message is persisted. Existing immutable receipts, slot2 cap and read-only authentication policy are unchanged. No new attempt slot or retry authorization is added.

## Offline validation

- Parser regression first:15PASS/5FAIL before collector; corrected cases turn green.
- Explicit final-empty conflict regression: RED accepted versus conflictingOutput, then GREEN.
- Empty-result IPC regression: RED invalidResponse, then GREEN; unsafe/absent source regressions retained.
- Final pure-module harness: **76PASS,1existing explicit stdio driver ignored**, including24 parser and11 diagnostic cases.
- Finder/common AI/official document/library frontend: **224PASS /32files**.
- TypeScript: PASS. No general text generator source changed.
- Independent production-library driver: **4PASS** (thin terminal/full final/conflicting empty final/lifecycle-only). Synthetic DTOs only; no network.
- Five independent review lanes: PASS after final snapshot precedence and exact workflow allowlist corrections.
- Existing Windows workflow source allowlist adds exact new parser module/test paths and web_search.rs; workflow was not dispatched.

Commands:

```sh
cargo test --offline --manifest-path src-tauri/education-video-harness/Cargo.toml
node node_modules/vitest/vitest.mjs run src/chatgpt src/education-video src/official-document src/finder-live-qa/services.test.ts
node node_modules/typescript/bin/tsc --noEmit
git diff --check
```

## Next live gate

Do not reuse either previous slot or delete receipts. Another actual search needs separate explicit approval, a reviewed single-attempt gate and a Windows QA executable rebuilt from the approved source. Before approval, verify source/executable hashes, account/model access, exact outbound conditions and both existing YouTube/Proxy dispatch guards false. In an approved request inspect finalOutput.kind/count, done-item evidence, tool lifecycle, per-type event counts, sharedStreamAccepted and searchParseReason. Never treat HTTP200 alone as search success. No further actual search was performed here.

## Changed-file inventory and Git state

- Production Finder parser: plan/web_search.rs, web_search_parser.rs, web_search_stream.rs, web_search_error.rs.
- QA diagnostics: plan/live_qa.rs, live_qa_diagnostics.rs, live_qa_diagnostic_shape.rs.
- IPC empty-result handling: src/chatgpt/webSearch.ts.
- Synthetic tests: web_search_parser_tests.rs, web_search_stream_tests.rs, live_qa_diagnostics_tests.rs, src/chatgpt/webSearch.failure.test.ts. Existing parser/diagnostic tests were moved intact before extending.
- Build scope: .github/workflows/finder-live-qa-windows.yml.
- Documentation: this file.

There are14 changed/new files, uncommitted and unpushed in this offline task. HEAD and remote remain824f85a; tracked commit divergence0/0 does not include these local edits. No checkpoint was requested explicitly in this step.
