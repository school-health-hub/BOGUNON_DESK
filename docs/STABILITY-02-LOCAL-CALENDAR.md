# STABILITY-02 — independent local calendar

Base: `integration/electron-feature-baseline` at `38b45c2a762224f0af976026519b3d47463e4454`.
Implementation branch: `feature/electron-local-calendar`. No integration/main update, workflow, Portable build, real service call, or user data migration.

## Original contract and restoration scope

The reachable Tauri path is `QuickAddPanel` → `workItemCreateService` → `workItemCreateRepository.createEvent`: a server event with title, area, one date, `is_all_day=true`, and null times. `bogunonWorkspaceRepository.EVENT_SELECT_COLUMNS` reads date ranges, all-day state, optional times and color. `workspaceDataAdapter.adaptWorkspaceData` supplies the monthly, weekly, today and upcoming projections. The original read/create contracts do not include recurrence, descriptions or locations. The standalone `CalendarPanel` contains fixed sample data; it is not a working event persistence implementation.

This restoration reuses the real `CalendarWidget.getCalendarMonthCells`, the workspace projection adapter, the existing Quick Add UI, fixed command execution, and `SurfaceDialog` focus/inert/scroll behavior. It connects independent Event CRUD, day details, month/year navigation, today/upcoming lists, overlap review, and local persistence. Time ranges, notes, locations and Main-owned audit timestamps are additions explicitly required or considered in STABILITY-02, not claims about original Tauri functionality.

Not restored: server/account/School Workspace synchronization, recurrence, automatic Tauri migration, or global changes to Dashboard/Task time semantics. No recurrence field is accepted silently. Task dates and deadlines remain Tasks, with no conversion into stored Events.

## Data and time contract

Main owns `<Electron userData>/work-data/local-events/events.json` and `events.backup.json`. QA uses the existing isolated userData resolver, including the new local-events store in its diagnostic list. No other module file is reused.

Document: `{version:1, revision, timeZone:'Asia/Seoul', events:[...]}`. Event: UUIDv4 `id`, `title`, `startDate`, `endDate`, nullable `startTime`/`endTime`, `allDay`, `description`, `location`, `category`, and `createdAt`/`updatedAt`. Categories reuse 교육/검진/행사/보고. Audit timestamps are created in Main, in ISO UTC; the client cannot supply them. Exact keys, versions, unique IDs and lengths are validated. Limits: 2,000 records, 2 MiB, title 120, description 4,000, location 200, duration 366 days. No paths, permissions or server identifiers in input.

Dates/times are literal KST wall values (fixed UTC+09:00); date inputs are not converted through UTC date slicing. All-day end date is inclusive. Timed end instant is exclusive and must follow the start; a midnight end is absent from the next day's list and Dashboard projection. Leap days, month/year boundaries and overlap checks use those same intervals. Adjacent intervals and the same record ID are not conflicts.

The calendar's Today is KST. Existing Dashboard clock/date/Task widgets retain the PC-date reference. Event labels explicitly mark KST; PCs outside Asia/Seoul receive a calendar warning explaining the difference. This avoids changing existing Task deadlines or the shared Dashboard session contract. Windows default-KST and other PC-timezone presentation need actual GUI review; arbitrary timezone selection and historical Korean daylight-saving conversion are not offered.

## Persistence and failure protection

`LocalEventStore` reuses `SettingsStore`: exclusive temporary creation, file sync, atomic rename, existing bounded Windows EPERM retry, and temp cleanup on failure. A validated previous document is saved as backup before replacing the primary. No successful UI notice occurs before the Main result. Normal shutdown flushes the event queue alongside existing stores; tray hide does not close the store or dispose Finder.

Revision and expected-record timestamp checks reject stale mutations. A stable per-form UUID plus exact-content idempotence handles acknowledgement-loss retries without duplicate creation. Changed drafts with an existing creation ID cannot overwrite it. Writes are serialized; pending controls prevent duplicate submission/dismissal. Late UI callbacks are ignored after unmount. Editing after a refresh still uses the original record timestamp, so refreshed revisions cannot authorize overwriting newer record content.

Oversized, corrupt, unknown-version or linked files are not reset. A validated backup can be displayed read-only; mutation remains blocked. Failed writes preserve the primary and the editor input. Missing primary with existing backup is also read-only, not a new empty store. Storage ancestor/file checks reject symlinks/nonregular files/hardlinks. Existing local Task bytes are verified unchanged by event CRUD.

There was no independent Electron Event file in the base source. Tauri/server events are not inspected or automatically imported. Real prior user calendar data compatibility is **NOT VERIFIED**, and migration is intentionally absent; an explicit, validated import design is needed before claiming such compatibility. Unknown document versions are blocked rather than converted.

## Reachable UI and integration

- Dock → 업무 도구 → 독립 로컬 일정.
- Existing Dashboard monthly-calendar date click → calendar on that date.
- Toolbar Quick Add → 일정 tab → separate calendar; a nonempty Task draft requires confirmation before leaving. This is a handoff, not a Task-to-Event conversion. The Task save path is unchanged.
- Ctrl/Cmd+K → 독립 로컬 일정. Only the Electron command list contains this command; the original Tauri command list is unchanged.
- Event projections are merged into existing monthly/weekly/upcoming widgets and today's Event count, prefixed `일정` and time/all-day labels. Task rows, completion, counts and D-Day semantics remain intact.

The modal uses fixed header/close, existing keyboard trap/background inert/focus restoration, and scrollable body. New CSS is scoped to the calendar; single-column controls fit narrow windows, with two columns at 1050px. No widget ID, saved layout JSON, Dock geometry or TD2 token changes. Empty/loading/error/recovered states are distinct. Delete and dirty discard require confirmation; overlaps are displayed and require confirmation on save. No student/health data entry is encouraged, and no external request is introduced.

## Focused validation

- 134 Vitest tests across 17 focused files passed: Event validation/CRUD/restore, KST/midnight/year/leap handling, intervals, ID/CAS/retry protection, failed writes/corruption/backup, typed IPC/Preload, day UI/edit/delete/discard, Dashboard, Quick Add and command handoffs, original local Tasks, calculator/commands, STABILITY-01 tray/Finder, Soft Rose/Glass, QA profile and existing Windows rename retry.
- After memoizing the new Dashboard projection, 11 calendar UI/application-routing tests passed again; no whole suite rerun.
- Electron production command `npm run electron:p0:build` checks Main/Preload, renderer and test TypeScript, packages offline OCR, and builds the renderer. The usual Vite large-chunk warning remains.
- Root `tsc --noEmit`: the existing 13 diagnostics match `/tmp/stability01-root-types.log` exactly; no new root diagnostics. No lint script exists; none was added.
- 6 existing ASAR/runtime/native-resource contract tests passed. The new `local-events.js` is selected by builder configuration and is part of the recursively checked Main runtime graph. Existing five native CLI resource declarations and offline OCR unchanged. The existing locally built Record helper and matching provenance were reused for the contract check; no new native build or Windows Portable was produced.
- `git diff --check`, exact changed-path review and secret-pattern review are required before commit.

Logs: `/tmp/calendar-focused-tests.log`, `/tmp/calendar-adapter-regression.log`, `/tmp/calendar-build.log`, `/tmp/calendar-root-types.log`, `/tmp/calendar-package-tests.log`. These are local Cloud evidence, not Windows execution evidence.

## Windows handoff / assessment

**CONDITIONAL** for release readiness: independent local-calendar scope implemented and Cloud-verified. Server scheduling, recurrence and migration remain separate scope.

**NOT RUN:** actual Windows GUI at 980×700 / 1280×800, 125%/150% DPI, calendar button visibility/scroll, keyboard focus and native confirmation dialogs, real Electron quit/restart and profile paths, tray return with an open calendar, Windows filesystem failures, actual Portable packaging/startup. Fresh store/provider tests verify disk restoration in Cloud; they do not substitute for Windows restart. Existing TD2 PARTIAL and prior Windows QA are not upgraded to current-SHA PASS.

Cloud B may fast-forward only while its target remains the base SHA or another ancestor of this feature commit. Recheck remote HEAD before integrating. No automatic integration is performed.
