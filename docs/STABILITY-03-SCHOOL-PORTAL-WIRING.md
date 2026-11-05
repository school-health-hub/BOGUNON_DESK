# STABILITY-03 — school address review and launcher wiring

Base: `9934ff56d462c4748956c7fa5b7111f7a1a92c26` (`integration/electron-feature-baseline`, remote verified before work).
Branch: `feature/electron-school-portal-wiring`. Isolated worktree; existing branches, worktrees, user data and EXEs untouched.

## Existing contracts and actual missing links

- `school-protocol.ts.EDUCATION_OFFICES` already defines all 17 NEIS education-office codes. `OFFICE_LAUNCHER_URLS` already contains the user's exact portal/NEIS/eVPN table for both manual environments, with pending-official-confirmation metadata. School profiles are stored by `SchoolProfileStore` in `userData/work-data/school-profile/school.json` (+ backup); public NEIS search returns cached candidates and Main accepts only an explicitly selected cached result. No NEIS key is requested or changed by this work.
- `AdminStore` already stores independent school/eVPN system URLs, the common eVPN entry URL, last manual environment, leave drafts and templates in `userData/work-data/school-admin/admin.json` (+ backup). `createAdminHandlers` already validates registered addresses and performs native consent, limited noncredential HEAD checks, redirect protection and `shell.openExternal`. Those execution/security contracts remain.
- The missing connection was a review/application operation: `SchoolProfileSettings` saved school identity only; the table was never applied to AdminStore. `SchoolLauncherProfile` incorrectly called the count of registered (mostly unverified) URLs “verified”. The Dashboard's existing `QuickLauncherWidget` dispatched `work-portal`, but Electron `P0App.navigate` fell through to its excluded-feature notice.
- Tauri paths: `useDesktopNavigation` / `runExternalDesktopAction` → `src-tauri/src/lib.rs` desktop action → `launcher::open_work_portal` → stored `workPortalUrl` → `browser_launcher::open_url` (Chrome preference, then OS opener). Electron reuses its existing OS-default-browser Main adapter rather than importing Tauri account launcher settings, Chrome selection or auto-open timers. Tauri school info uses the same four-field DTO, loaded from its server repository; Electron's local profile is still separate. No account/membership/server restoration is claimed.

## Connected flow and confirmation boundaries

1. Existing initial setup searches NEIS and requires explicit school selection/confirmation. Existing profile saving is unchanged; selecting/changing a school still never writes launcher addresses.
2. The first-run modal stays open after school selection, so the user can review addresses and then finish or skip. Existing registered schools do not reopen first-run setup or reset settings.
3. `SchoolSystemAddresses` is reused in the existing settings school section and school-administration profile. Main `schoolAddresses()` reads the actual current school, current environment and AdminStore revision, and returns current URL, proposed URL and provenance for all four services.
4. Blank supported entries are preselected for review. Existing entries are never preselected for replacement. Unsupported entries cannot be selected. Nothing is written merely by displaying or selecting checkboxes.
5. Main `applySchoolAddresses()` accepts only office code, school code, expected admin revision, environment and service IDs. It resolves URLs from the single registry, validates them, and presents the full old→new values and verification limitations in the existing native confirmation dialog. Renderer cannot inject URLs, paths, authentication fields or HTTP options.
6. Only selected entries are saved through AdminStore's existing schema, backup, atomic-replace and revision contracts. Apply does not change school identity, templates, drafts, the other environment's system URLs, or Excel session state. The eVPN entry page is explicitly labelled common to both environments; selecting it updates that existing shared field.
7. School/recovery state and admin revision/environment are checked during confirmation and immediately before writing the primary. A narrow optional prewrite guard was added to AdminStore; other callers are unchanged. Cancel, stale context, unsupported mappings and write errors do not show success or reset the primary. Recovered school/admin stores remain read-only.
8. SchoolAdmin blocks apply/open while unsaved URL/template edits exist; successful apply refreshes its persisted address state without touching the leave editor or Main Excel review cache. UI unmount/context changes cancel only an owned pending address operation and ignore old replies. Already completed writes are not claimed to be reversible.
9. Dashboard `work-portal` now calls the same typed `admin.openSystem('portal')` as the existing launcher, without embedding a URL. Missing configuration opens the existing school-administration screen. Duplicate pending requests and modal/workspace collisions are blocked. No new Dock item or Dashboard geometry change.

School save and address apply are deliberately two explicit operations in separate existing stores, not a cross-file transaction. If address apply is canceled or fails, the selected school may already be saved; prior addresses remain, and the user can retry after reviewing them. No new store/schema version or automatic migration.

## URL mapping results and provenance

All 17 explicit codes are tested: B10 서울, C10 부산, D10 대구, E10 인천, F10 광주, G10 대전, H10 울산, I10 세종, J10 경기, K10 강원, M10 충북, N10 충남, P10 전북, Q10 전남, R10 경북, S10 경남, T10 제주. Unknown codes are rejected; no guessed fallback.

- The existing 51 portal/NEIS/eVPN values are unchanged, including Gangwon `kwe.*` and Gyeongbuk `https://evpn.gbe.kr`. The two environment lookups reuse the existing registry; no second list in UI/Main.
- **One added registry value:** K10 K-Edufine `https://klefedu.gwe.go.kr/`, reused from the user's earlier explicit confirmation already recorded in `docs/school-admin/LAUNCHER_CONNECTION.md`. It remains **needs-official-confirmation**, with no fabricated verification date. No assumption that it uses the `kwe` hostname.
- Other 16 offices have no registered K-Edufine initial value. UI says so and directs users to the existing manual URL configuration. No common public NEIS site is substituted for teacher NEIS, and no generic K-Edufine address is invented.
- Registered values are initial candidates, not newly verified official/reachable URLs. The prior R10 eVPN official-source review metadata is preserved but is not a current network test. Gangwon portal/NEIS/eVPN and K-Edufine require particular institution confirmation.
- **Real-time URL freshness, school-network reachability and authentication: NOT VERIFIED / NOT RUN.** No live institution checks were made in Cloud. Existing HTTPS/official-domain-shape, query/credential/port/protocol and redirect protections were not broadened.

## Login/session policy

Main still requests the OS default external browser after existing consent/checks. A valid official session may be reused only within the same browser profile, subject to the site's own policy. DESK does not read that session or determine its expiry. Electron's internal session and DESK account are not assumed to share cookies with the external browser. Expired sessions require direct official reauthentication. Browser dispatch, HTTP response, school/eVPN connectivity and authenticated success remain distinct results.

No passwords, certificate passwords, OTPs, cookies, authentication automation, session extension, certificate bypass or electronic submission were added. Existing eVPN/school-network guides, separate nonpersistent HEAD session, no-client-certificate/NTLM policy and sanitized failure states remain. A new settings message explains session limits. BOGUNON account membership and School Workspace DB remain unsupported/out of scope.

## Validation and limits

- Focused Vitest: **123 PASS / 17 files**, covering all 17 mappings, unknown codes, explicit review/replace, Main/Preload contracts, restore, write failure/corruption, stale context, unsafe URLs, browser errors, initial setup, Dashboard route, leave/CSV review preservation, existing launcher/redirects, STABILITY-01, STABILITY-02 and TD2/QA profile regressions.
- Added owned-operation close/cancel regression: **1 PASS**, other tests in that file deliberately not rerun for this isolated addition. These are synthetic/mocked network/browser tests, not actual Windows execution.
- `npm run electron:p0:build`: Main/Preload, renderer and tests TypeScript; offline OCR resources; Electron production renderer build PASS. Existing large-chunk warnings remain. No standalone lint/typecheck script exists; none added.
- Root `tsc --noEmit`: existing **13 errors**, identical to the STABILITY-02 baseline log, **0 new errors**.
- Existing ASAR/runtime/Record resource checks: **6 PASS**. Builder explicitly includes the new `school-launcher.js`; runtime graph checked in a temporary ASAR. Existing native CLI 5 declarations and OCR unchanged; reused existing Record binary/provenance, no native rebuild or Portable build.
- Existing Purchase Excel debug binary was reused by the real synthetic CSV/Excel regression via a temporary worktree-local symlink, removed afterward. No source engine or user files were modified.
- Logs under `/tmp/stability03-*`: `focused-tests.log`, `close-test.log`, `build.log`, `root-types.log`, `package-tests.log`. Diff/changed-path/secret checks are performed before commit. No production credentials or personal data used.

Windows GUI (980×700, DPI, native consent, default browser), actual NEIS search, school/eVPN connection, real certificate/login/session expiry, actual app restart and Portable are **NOT RUN**. Previous GUI PASS/TD2 PARTIAL are not upgraded to this SHA. Follow-up should use synthetic school/profile inputs and manual official authentication, not repeat unrelated QA.

## Changed files / integration

Production: `school-protocol.ts`, new `school-launcher.ts`, `admin-protocol.ts`, `builder.json`, `main/admin-ipc.ts`, `main/admin-store.ts`, `main/main.mts`, `preload/preload.cts`, `renderer/P0App.tsx`, `renderer/school-admin/SchoolAdmin.tsx`, `renderer/school-profile/{SchoolProfile.tsx,SchoolSystemAddresses.tsx,school-profile.css}` (paths under `electron-p0/`). Tests: `admin-preload.test.ts`, `school-profile-ui.test.tsx`, new `school-portal-wiring.test.ts`, new `school-portal-dashboard.test.tsx`. This report is the only documentation addition.

Assessment: **CONDITIONAL** — code/Cloud wiring complete; address freshness, unsupported K-Edufine mappings and Windows/official-system checks remain explicit. Cloud B can fast-forward if its integration target is still the base or another ancestor; recheck remote HEAD first. This task never updates integration/main or creates a PR/workflow/deployment.
