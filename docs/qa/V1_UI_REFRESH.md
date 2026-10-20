# v1.0 desktop UI refresh

Base: main `31d3cf3a7259878677adf019360dee7b32dd3320`.

## Scope

Presentation only: App imports a workspace-scoped stylesheet after the existing
styles. No component state, routing, persistence, native, auth, finance or release
workflow is modified. Existing widget placement, appearance IDs, edit controls,
Dock and Settings navigation remain in place. No new global sidebar is added.

White widget/work surfaces replace heavy glass shadows. Teal active/focus states,
readable toolbar labels, helper headers/fields/tabs, sticky Purchase table headers,
error notices and neutral mint-accent status notices use the documented tokens.
Narrow calendars scroll internally; narrow Dock keeps all seven 42px targets.
Short helper windows allow internal scrolling instead of a fixed minimum height.

TeacherDesk (https://tdesk24.com/) is a conceptual widget-workspace reference only.
No third-party screens, assets or icons were copied. Existing Lucide icons remain.

## Verification

- Full frontend: 177 files / 1,177 tests passed.
- TypeScript `tsc --noEmit`: passed.
- Vite production frontend build: passed; existing >500kB chunk warning remains.
- Settings/Record/Purchase/Dock focused review: 26 tests passed.
- `git diff --check`: passed.
- Independent goal, code, security, context and visual review: passed after
  correcting generic input specificity to preserve Purchase validation borders.

A fresh, nonpersistent headless Microsoft Edge profile visited localhost only;
all non-localhost requests were aborted. No login, native bridge or user data was
used. Browser-driven onboarding completion, Settings open/close, tool navigation,
Record/Purchase/Document open/close, edit/done and Quick Add were exercised.
A synthetic invalid Purchase row was added then removed in browser memory;
its warning border remained the original warning color, not the generic border.

Before/after captures and JSON reports are local, outside Git:
`C:/Users/Public/Documents/BOGUNON-ui-evidence/`.
The original screenshot tool still fails kernel-asset initialization; the existing
bundled Playwright with Edge was used without installing dependencies.

Captured after resize settlement: dashboard and Settings at 1440/1280/768/375px;
Record/Purchase/Tools at 1440px; Record/Purchase/Document at 1024x600; edit,
Quick Add, invalid Purchase state, and a horizontally scrolled narrow calendar.
No page errors or document-level horizontal overflow were reported. Calendar
scrollLeft movement and all seven Dock button bounds were separately checked,
so document-level overflow alone is not treated as sufficient evidence.

## Release limits

These are browser React screenshots, not installed Tauri/WebView2 screenshots.
Signed-in cloud data density, loading/server-error variants, native dialogs,
Windows scaling/high contrast, screen readers and populated short helper views
still require Windows QA. No Lighthouse score or comprehensive accessibility
certification is claimed. Existing functional tests remain the evidence for
save/error semantics; this pass does not invent or change success messages.

Phase 2 PR #21 and controller PR #23 are untouched/unmerged. The prospective
finance dashboard hierarchy is recorded in DESIGN.md, but no Draft Phase 2 UI
or calculation is integrated. Existing TESTABLE is not UI-refresh evidence.
A separately approved Windows build and actual user-session UI review remain
required before v1.0 release. No Rust build or TESTABLE publication was performed.

Final capture provenance: the dependency junction caused development-server
font allow-list errors, so development captures are not final font evidence.
The built production preview on localhost:1438 was re-tested with
`document.fonts.ready`; all 18 `production-*.png` captures and
`production-report.json` are the final reference. HTTP >=400 and page errors
were checked and none were recorded. No production code change was needed.

## Desktop composition replacement (2026-10-21)

This pass replaces the dashboard composition rather than recoloring its previous slots.
`DesktopWidgetLayout` owns the grid and existing `WidgetFrame` instances; a typed
12-column/10-row default composition places clock/weather/summary above the calendar,
tasks/events on the right, and weekly schedule/memo/launcher along the bottom.
Only canonical dense layouts are projected. User-customized saved coordinates,
storage schema, widget IDs, data providers and action handlers remain unchanged.
Small windows retain vertical scrolling and the calendar's internal horizontal scroll.

Observed production Edge browser at 1920×1080:

- Previous centered dashboard cap: 1540px. New workspace: 1920px, widgets begin x32.
- Calendar: x32/y254, 921×441px. Weekly schedule: y709, 921×259px.
- Final widget bottom: y968. Dock: y998, 436×72px. No large unused bottom region.
- Default / Soft / Flat shadows remain distinct after CSS transition settles.
- One common account instruction replaces repeated long widget notices.

Verification for this pass:

- Failing-first geometry expectations: 3 failures before implementation; targeted suite green after.
- Full frontend: 178 files, 1180 tests passed (`--cache=false --maxWorkers=2`).
- TypeScript noEmit and Vite production build passed. Existing bundle size warning remains.
- 20 browser captures: 1920×1080; 1440/1280/768/375 widths; 1024×600 tool dialogs.
- Real clicks: settings, Dock tools, Record Helper, Purchase Helper empty-row validation,
  edit/done, quick add. Narrow calendar scroll and all seven Dock actions verified.
- Zero page errors or local HTTP errors in capture report. Independent QA also added/hid a widget.
- Independent goal, code, security, context and hands-on QA reviews passed.
  Context review found a Soft-shadow override; fixed and re-reviewed before completion.
- React review: no new effect/listener/data fetch/storage write; keyed widget identities and
  existing callback ownership retained. Presentation-only notice context has bounded scope.

Runtime audit hypotheses and evidence:

1. Width cap caused unused sides: old production screenshot shows centered 1540px layout;
   removing the cap yields measured 1920px workspace with 32px widget gutter.
2. Fixed row sizing left bottom space: old screenshot ends widgets near y848; new height-derived
   rows end y968, with only 30px before Dock. Short-window minimum height scrolls instead of clipping.
3. Narrow layout could hide controls: 375px browser run confirms internal calendar scrolling,
   no document horizontal overflow and every Dock button in viewport.

Evidence retained outside Git in `C:/Users/Public/Documents/BOGUNON-ui-evidence/`:
`previous-dashboard.png`, `desktop-dashboard.png`, `dashboard-comparison.png`,
`desktop-dashboard-375.png`, `desktop-report.json`, `layout-metrics.json`,
`desktop-tests.log`, `desktop-build.log`, `independent-report.json`.
These are fresh isolated browser previews with signed-out states, not native Windows
Tauri/WebView2 or authenticated Google data verification. No real user data was used.
No Rust/native build, PR21/23 mutation, financial/auth logic change or release operation.

## Final populated-widget polish (2026-10-21)

The approved c0c326c desktop composition is retained. No geometry, saved layout,
widget identity, data adapter, mutation handler, authentication or finance logic changed.
Only content typography, internal alignment, scrolling and empty-state presentation changed.

### Synthetic render harness

`src/widgets/__fixtures__/desktopWorkspace.ts` contains explicitly synthetic October
2026 schedules, tasks, health work, D-Day and summary values. The alternate
`qa/ui/dashboard-preview.config.mjs` substitutes only workspace/weather/meal providers
at build time. It has no production runtime switch and defaults to a separate
`dist-dashboard-synthetic` output. Task mutations in this presentation harness return
`ignored`; screenshots are not persistence, authentication or mutation QA evidence.
No real school account, repository or data is used. External network is blocked.

Reproduce the QA build from the UI worktree:

```sh
node node_modules/vite/bin/vite.js build --config qa/ui/dashboard-preview.config.mjs --outDir C:/Users/Public/Documents/BOGUNON-ui-evidence/populated-dist
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 1440 --strictPort --outDir C:/Users/Public/Documents/BOGUNON-ui-evidence/populated-dist
```

Use a fresh browser profile. Set the browser clock to 2026-10-21T09:00:00+09:00
before navigation. Normal root uses the populated fixture; `?density=sparse` uses
one task/one D-Day. Skip onboarding without connecting an account. Do not ship the
QA output. Normal production build/config remain unchanged; production JS was
scanned and contains no fixture IDs, synthetic school name or synthetic provider.

### Findings and corrections

- Calendar +N fell below a long event title. Keep +N beside the colored event chip;
  full-title hover text exposes the title and remaining events. Existing one-event/+N
  selection and date Quick Add behavior remain unchanged.
- Summary/weather/priority content used small, top-aligned lines in generous slots.
  Align content within the existing slots and emphasize existing values.
- Task/upcoming lists now have bounded internal scroll; D-Day uses readable rows;
  weekly schedule titles wrap to two lines with existing full-title hover.
- At simulated150% effective viewport, short slots clipped calendar/weather content.
  Preserve minimum readable calendar content height and panel scrolling; final date
  and list ends remain reachable. No outer layout changes.
- A shared connection banner is the only account instruction. Disconnected widgets
  use a decorative dash plus actual screen-reader-only waiting text. Loading/error
  states retain their messages; weather/meal non-signedOut actions are unchanged.
- Dock was already the approved size. Verified hover and keyboard tooltip, all seven
  reachable buttons, one current item, and Settings becoming the current menu.

### Verification and limits

- Full frontend regression: 178 files / 1181 tests passed.
- After the final accessible-text and scrolling corrections: 33 focused tests passed.
- TypeScript noEmit, normal Vite build, synthetic Vite build, diff check passed.
- Fresh Windows Edge production-style browser QA: 1920×1080, 768×900, 375×900;
  1536×864 DPR1.25 and1280×720 DPR1.5 emulate effective125%/150% conditions.
- All viewport checks: four distinct calendar category colors, +N within its date
  cell, no document horizontal overflow, all Dock buttons in bounds, one active
  menu, visible tooltip and last task reachable. Sparse fixture also rendered.
- Independent QA verified calendar October31 after internal scrolling, upcoming/task
  list ends, fixed09:00 clock, narrow Dock and tools menu. Zero console/page errors.
- Normal production disconnected screen: one common banner, zero repeated Google
  connection instructions inside widgets. Fixture exclusion scan passed.
- Independent goal/visual, code, security, context and runtime QA reviews passed.
  Review caught the paragraph accessible-name issue; replaced with actual sr-only
  text and re-reviewed. The browser test caught short calendar clipping; corrected.
- No native Windows app, WebView2, OS DPI setting, real account/data, Rust build or
  CI rerun was used. Actual installed-app DPI, cloud delivery, native window and
  authenticated workflows remain integration/release QA, not claimed here.

Evidence outside Git: `C:/Users/Public/Documents/BOGUNON-ui-evidence/`:
`polish-large.png`, `polish-dpi125.png`, `polish-dpi150.png`, `polish-small.png`,
`polish-sparse.png`, `polish-disconnected-dashboard.png`, `polish-report.json`,
`independent-final-report.json`, `polish-full-tests.log`, `polish-final-tests.log`,
`polish-production-build.log`, `polish-red.log`, `polish-green.log`.

UI refinement ends with this pass. Remaining work is v1.0 integration/deployment
verification under its existing approval boundaries; no release or merge performed.

LSP diagnostics were unavailable because the existing TypeScript server is not
installed and prior setup declined installation. No tooling installation was made;
compiler validation used the successful whole-project `tsc --noEmit` run instead.
