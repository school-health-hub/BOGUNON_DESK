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
