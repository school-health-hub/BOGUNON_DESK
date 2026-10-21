# Education Video Finder native Phase 2B

This document supersedes the Phase 1 native contract. No full Tauri build, package installation, system/environment change, remote API call, token generation, deployment or database mutation was performed for this phase.

## Version 2 library contract

Path remains `app_local_data_dir()/education-video/library.json`.

```
{version:2, entries:[{
  videoId,
  teacher:{educationTitle,target,schedule,instructions,message,notes},
  provider:null | {
    title,channelId,channelTitle,durationSeconds:number|null,url,
    source:'live'|'synthetic-mock',official,officialEvidence:string|null,
    synthetic,fetchedAt,expiresAt
  }
}]}
```

All objects deny unknown properties. Limit: 1000 entries / 2 MiB JSON. Provider video URL must be exactly the canonical HTTPS YouTube watch URL for the entry's 11-character video ID. Unknown duration is `null`, never invented as zero. No keys or auth tokens are part of the schema; the application never writes credentials to the store. Teacher free text remains user supplied; do not paste credentials into it.

The live official registry only recognizes the two manually reviewed channel IDs with exact homepage URL evidence: 교육부 `UCexUyFaq9YH7XJfCQzVR_jg`, 질병관리청 `UCa7-3Zvxg-5Rfxgu3RQY_gw` (review date 2026-10-22). Channel names/subscriber counts are not evidence. Unknown or synthetic official claims are rejected. Human-readable evidence labels are separate from the machine URL field. Official status does not imply educational suitability.

Timestamps use canonical UTC millisecond ISO strings (`YYYY-MM-DDTHH:mm:ss.sssZ`), calendar validated. Expiry must be after fetch time and at most 30 days later. Fetch timestamps beyond current clock +5 minutes, and expiry beyond current clock +30 days +5 minutes, are rejected. Saving, importing and refreshing never re-age provider metadata by replacing its original fetchedAt with current time.

## Commands

- `education_video_library_load()` → `{library,recovered}`
- `education_video_library_save({entry})` → same. Explicit teacher save replaces that ID without duplicate entries.
- `education_video_library_import({json})` → same. Existing teacher fields are retained; only incoming non-null valid provider metadata replaces an existing provider. Teacher-only or expired incoming metadata cannot erase fresh saved metadata.
- `education_video_library_export()` → JSON string.
- `education_video_library_recover()` → `{library,recovered:true}`.
- `education_video_library_metadata_delete({videoId})` → clears provider in primary and valid backup, retaining teacher data.
- `education_video_library_metadata_refresh({videoId,provider})` → updates provider for an existing ID, retaining every teacher field.

Writes remain atomic with a recoverable first-save/previous-generation backup. Commands hold a process-wide mutex across read/merge/write. Version 1 files are strict mock-only files and migrate to synthetic-mock v2 without changing teacher fields. Before replacing a v1 primary, its exact original JSON is retained at `library.v1-backup.json`; this immutable historical snapshot contains Phase 1 synthetic data only. Incoming files remain with their caller, not copied into unbounded import archives.

## Provider lifecycle and damaged files

Repository load/save/import/export physically removes expired provider objects from valid primary and valid backup JSON; it does not merely hide them in the UI. Teacher fields/videoId remain. Explicit metadata deletion also sanitizes the recoverable generation.

If a primary is valid but a backup is binary/oversized/malformed, the invalid backup is quarantined and replaced from the known valid primary. If the primary is damaged and a valid backup exists, the primary is quarantined before atomic recovery. If neither parses, an error is returned; no empty library is fabricated.

New raw damaged evidence is scoped to `education-video/quarantine/<uuid>.raw`, accompanied by `<uuid>.retention.json` with a 24-hour deletion deadline. Only Finder-created UUID/valid-receipt pairs are cleaned up, on subsequent repository access. A damaged/unreadable/oversized housekeeping receipt is skipped so it cannot block a valid primary; its ambiguous raw evidence is preserved for manual review and cannot be automatically classified or purged. This exception can exceed the intended 24-hour retention and requires user review, not a blanket compliance claim. Unparseable corrupt raw bytes cannot be reliably classified by provider timestamp; quarantine is a temporary recovery compromise, not a claim that every damaged byte satisfies provider retention policy. If the app is closed/offline, no background timer can enforce physical deletion at the deadline. The next repository access performs cleanup. A user with unrecoverable damaged files must recover teacher data promptly from the temporary raw evidence; do not treat it as permanent archival storage.

## Native search transport preparation

IPC `education_video_search({request:{topic,audience,desiredMinutes},accessToken})` validates conditions/token then always returns structured `REAL_DISPATCH_DISABLED`. No environment variable can enable dispatch in Phase 2B. The prepared HTTP adapter is also independently hard gated.

The request plan uses request-scoped `Authorization: Bearer ...`, fixed `/api/education-video/search`, timeout 12 seconds and no redirects. Production remains exact `https://bogunon.vercel.app`; debug builds alone accept explicit `BOGUNON_EDUCATION_VIDEO_DEV_PROXY=http://localhost:3000` or `http://127.0.0.1:3000`. No caller-supplied arbitrary URL is accepted. Existing meal/weather restrictions are unchanged.

Prepared reqwest/rustls response reading caps Content-Length and accumulated chunks at 256 KiB. 401/403, 429, redirects, timeouts, oversized/malformed responses and upstream failures map to fixed codes/messages. No raw upstream bodies, URLs, queries or authorization values are logged or returned in errors. The core deliberately does not implement Debug/Serialize on credential-bearing RequestPlan.

Wire envelope: `source`, `notice` (500 chars max), `results` (0..12). Each result contains videoId/title/channelId/channelTitle/durationSeconds|null/url/official/officialEvidence|null/synthetic/fetchedAt?. Live results require canonical fetchedAt; synthetic fixture timestamps may be absent. Source/synthetic/official registry consistency and duplicate IDs are validated.

## Executed versus unverified

The exact production pure modules are tested in the lightweight offline harness; its harness-only `reqwest` crate alias points to the `url` package for the identical Url type. It does not compile the HTTP client or Tauri dependencies. Production Cargo dependencies and reqwest/rustls configuration are unchanged.

The local fake transport tests inspect the Bearer request plan and exercise safe status/body parsing without opening a socket. They are not an actual proxy or authenticated API call. Prepared reqwest adapter compilation, native IPC, full Tauri application build and installed app execution remain unverified by design. Prior Phase 1 full-build Perl/OpenSSL prerequisite failure is historical; Phase 2B did not retry a large build or change that environment.

## Verification receipt (Phase 2B)

Executed from the task worktree:

```
CARGO_BUILD_JOBS=2 CARGO_INCREMENTAL=0 cargo test --manifest-path src-tauri/education-video-harness/Cargo.toml --offline
rustfmt --edition 2021 --check src-tauri/src/education_video/*.rs src-tauri/education-video-harness/lib.rs
git diff --check -- src-tauri docs/education-video-native-phase2b.md
```

Final focused runtime: command exit 0, **23 tests passed, 0 failed**, actual Windows executable, 0.18 seconds test execution. No warning was emitted by the final harness run. Formatting and diff checks exit 0 (Git's existing LF→CRLF informational notices are not source errors).

Review-driven failing-first evidence: the missing live fetchedAt and valid-primary/damaged-backup regressions first failed with 18 passing / 2 failing tests; teacher-only import deleting fresh metadata then failed its focused test. After minimal fixes, all passed. A separate fixture-encoding compiler error was corrected; that compiler error is not claimed as a behavioral TDD receipt.

Logs are `%TEMP%/education-video-native-phase2b-final.log`, `education-video-native-phase2b-review-red.log`, `education-video-native-phase2b-import-red.log`. Harness-only target output is ignored; measured footprint after execution was about 211 MiB, with 9.2 GiB free on C:. No full Rust/Tauri build was started in this phase.

The malformed-housekeeping-receipt regression also failed first (valid primary incorrectly returned Corrupt), then passed after bounded skip/preserve handling. Receipt red log: `%TEMP%/education-video-native-phase2b-receipt-red.log`.
