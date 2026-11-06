# Cloud B — frozen TD2 Desktop Floating Surface QA entry

## Approval and immutable source
- Design SHA: **abf6f6f049f01dc57a574825fad8be86e2a4d68a**
- Design branch: `codex/td2-floating-surface-b`.
- Base and latest verified `integration/electron-feature-baseline`: `243ae95e69483dfbe8d2438c41f858577d748048` (2026-11-06). No upstream delta at preservation time; no merge/rebase performed.
- User approved B direction and actual1280×800 appearance. Freeze design. Windows usability, integration, main merge, release and Portable replacement remain **unapproved**.
- Controller is the later QA-only commit containing this document and the additional guarded job in the existing `electron-cloud-g0.yml` workflow. Record its exact SHA when dispatching.

## Scope and files
Design commit contains DESIGN.md, renderer/P0App.tsx (existing canonical guard class), renderer/main.tsx (CSS imports), renderer/td2-desktop.css, td2-desktop-v2.css, td2-desktop-b.css, and scripts/qa/td2-b-review.mjs. No Main/Preload/IPC, business/data/storage contracts, registry, action order, package or lockfile change.
B is a live CSS view projection only for exact default geometry. Custom layouts and Edit use existing RGL. Do not reset existing user geometry. Do not introduce another design proposal.

## Current verdict
| Check | Result | Boundary |
|---|---|---|
| Renderer production build/types | PASS | Existing dependencies, no Portable rebuild |
| Existing focused tests | PASS |5files38tests |
|1280×800 /1440×900 /900×680 /maximize | PASS home | Native Windows Electron, top+bottom |
| Long task/event titles | PASS home | Synthetic valid119–120char titles through real local IPC; ellipsis/list scroll retained |
| Calendar/week readability | PASS | Full-title tooltip and +N, condensed summaries |
| Dock/home overlap | PASS | Home four sizes and content zoom |
| Electron content zoom125%/150% | PASS home | Not Windows OS DPI |
| Real mouse move+resize+process restart | PASS | Isolated profile clock(8,0,2,2)→(1,0,3,3), deep-equal settings, memo/tasks retained |
| Selected memo dialog at150% | **FAIL / OPEN** | Dialog covers Dock and blocks Home pointer click; Escape closes. Escape is a workaround, not a fix |
| Long meal ready data/binding | **NOT RUN** | Electron meal adapter currently returns signedOut; disconnected message only tested |
| Actual Windows OS DPI125%/150% | **NOT RUN** | Content zoom must not be relabeled OS DPI |
| Physical PC /multi-monitor/DPI transition/low-GPU | **NOT RUN** | No evidence yet |
| Product integration /deployment/Portable replacement | **NOT RUN / prohibited** | Separate user approval required |

Independent reviewer directly inspected all18 focused captures: home PASS, whole Windows usability REVISE because memo overlay issue remains. Existing focused local run `aa7ac8ce-8a56-4941-b519-ee1696ec9a95`. Earlier approved1280 implementation run `f17147cc-2b46-4dcf-aa51-939835d43de8`. Renderer bytes were fixed; additional work changed QA harness/documentation only.

## Reuse Windows Actions
Existing workflow `Electron CLOUD-G0 integration` is registered. Its old integration/Portable jobs have branch guards that do not match this design branch. The new `td2-floating-b-focused` job reuses Windows2022/Node22.23.3 with an immutable dispatch controller SHA and byte-equivalent product check against the hardcoded design SHA, isolated synthetic profiles, locked npm dependencies and artifact-only output. No deployment/Portable command is in the new job. Existing job guards were not widened.

```
gh workflow run electron-cloud-g0.yml --repo school-health-hub/BOGUNON_DESK --ref codex/td2-floating-surface-b
gh run list --repo school-health-hub/BOGUNON_DESK --workflow electron-cloud-g0.yml --branch codex/td2-floating-surface-b --limit 5
gh run view RUN_ID --repo school-health-hub/BOGUNON_DESK
gh run download RUN_ID --repo school-health-hub/BOGUNON_DESK --name td2-b-focused-RUN_ID-1 --dir E:/TD2-QA/RUN_ID
```
Verify workflow/controller SHA, design SHA, run attempt and SHA256SUMS before reviewing. Artifacts expire after14days; preserve required synthetic results in an approved destination before expiry. A green automated run does not resolve the known memo overlay or OS DPI/meal NOT RUN items.

## Local reproduction on another Windows machine
Use a fresh clone at the exact design SHA. Node22.23.3, Electron45.2.1, Playwright1.64.1, Vitest5.0.1 are fixed by the existing lockfile. No secrets/login/real student or patient data are required.

```
git checkout --detach CONTROLLER_SHA
git diff --exit-code abf6f6f049f01dc57a574825fad8be86e2a4d68a HEAD -- electron-p0 src package.json package-lock.json
npm ci
node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.renderer.json --noEmit
node node_modules/vitest/vitest.mjs run electron-p0/tests/soft-rose-surface.test.tsx electron-p0/tests/widget-state-notices.test.tsx src/dashboard/deskGeometry.test.ts src/dock/AppDock.test.tsx src/dock/storage.test.ts
npm run electron:p0:build
$env:TD2_ELECTRON_PATH=(Join-Path $pwd 'node_modules/electron/dist/electron.exe')
$env:TD2_QA_TEMP='E:/TD2-QA/temp'
$env:TD2_REVIEW_DIR='E:/TD2-QA/evidence'
$env:TD2_FOCUSED_QA='1'
node scripts/qa/td2-b-review.mjs
```
Set TEMP/TMP/npm cache to an E directory before commands when C is full. The unpackaged runtime build compiles existing main/preload and renderer plus existing OCR assets, never a Portable/Rust release build. Use Actions if local resources are insufficient.

## Cloud B remaining work
1. Reproduce pinned source on the existing Windows runner, inspect every capture and native provenance.
2. Reproduce memo overlay at content zoom150%: open Dock quick memo; attempt Home click; record intercepted hit test, screenshot and usable close/Escape path. Do not force-click and claim PASS. Propose a minimal usability fix separately; no redesign/data change.
3. On a physical Windows test system, change actual display scaling125% and150%, record OS scaling and Electron content zoom separately, then repeat four sizes, Dock focus/selection, drag/resize/restart and long-data access.
4. Meal ready adapter is unavailable in current production path. Mark blocked/NOT RUN unless an isolated test-only fixture using the actual MealWidget is explicitly scoped; do not add a production connection or silently switch the adapter. Do not use confidential real records.
5. Keep saved custom geometry unchanged. Test populated lists and small widgets by scrolling to last item and reaching all actions. Report hidden/unreachable controls as FAIL rather than only checking scrollWidth.
6. Report PASS/FAIL/NOT RUN separately. Return findings before product integration; do not merge main/integration, deploy or replace Portable.

## Evidence and preservation
Machine-local originals remain under E:/BOGUNON_DEV/design-runtime/td2-electron-surface-20261106/generated/artifacts/td2-static-ab, td2-b-implementation and td2-b-focused-final-valid. Original C v2 checkout is untouched. These historical PNGs/profiles are not pushed and are not required to execute the next pinned QA; regenerate fresh synthetic evidence using the versioned harness. The compact versioned validation record contains provenance/hashes, not private profile content.

No screenshots, profiles, real databases, credentials, Finance/DPAPI state or unrelated WIP are included in Git. Secret scanner binaries were unavailable; strict staged credential/JWT/private-key/ID patterns and manual source/fixture inspection found no secrets/personal records. Residual risk: best-effort scanning is not exhaustive.

**Handoff scope:** source/controller/instructions for Cloud B QA. It does not grant Windows usability approval or product integration. Remote-only source restoration must be recorded in the final session report. Existing local-only v1/v2 QA scripts remain preserved and are not dependencies of the self-contained B harness.

## Cloud B usability evidence supplement (2026-11-06)

The subsequent QA-only controller adds actual Home pointer click attempts at Electron zoom 125% and 150%, popup/Dock rectangles and hit tests, close-button versus Escape results, keyboard focus and rendered small-widget end-of-scroll inspection. It also checks actual appData/userData/sessionData under the isolated root and records PID/creation-time identities after both QA Electron sessions close. Product files, design geometry, Main/Preload/IPC and workflows are unchanged. The controller source SHA is the immutable `github.sha` in provenance.json. The Actions harness can finish green while `review.json.usability` is FAIL; do not treat the open memo defect as fixed. OS DPI and meal ready binding remain NOT RUN. No integration is performed.

## Authorized Quick Memo Dock correction

Fix branch: `fix/td2-b-memo-dock`, starting at QA controller `985aa25ac5af950191690f59b80217567ce0d0f9`. The only product delta is a Quick Memo renderer wrapper, its scoped CSS, the existing P0App entry and four regression tests. The generic SurfaceDialog, modal z-index, Main/Preload/IPC, widget geometry storage and TD2 B styles stay unchanged. The wrapper measures Dock top with ResizeObserver and viewport resize updates; reserves 12px above Dock, limits popup height and retains body scrolling. No profile migration or reset.

The existing manually dispatched TD2 job is restricted to this fix branch and rejects product changes outside those four files. It verifies 100/125/150% content zoom at normal/small/maximized sizes and custom-layout 150%; requires an actual unforced Home click while memo is open, non-overlap, final action accessibility, close and Escape. A FAIL causes a failing run. Inspect `review.json.memoZoom`, PNGs, process cleanup and SHA256SUMS; OS DPI125/150 and disconnected meal ready binding remain NOT RUN. Product integration and Portable replacement are not performed.
