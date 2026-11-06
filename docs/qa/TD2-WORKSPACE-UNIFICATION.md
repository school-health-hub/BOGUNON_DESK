# TD2 workspace chrome — implementation handoff

Base: `ec181a18f94c5ff4730dc6006ea94018db28d5e3`.

The original design branch at `b053093fe289721f07e6c37d38e3e7054614d747` is preserved. Its three UI-only commits were selected onto this new SCHOOL06–08 integration base. No old Main/Preload/SQL/provider file was copied over the new implementation.
Audit: `/tmp/BOGUNON-DESK-TD2-MENU-DESIGN-AUDIT.md`.

## Scope

This is Electron presentation work. `WorkspaceShell` owns no application state,
storage, focus, requests or navigation. `WorkspaceHeader` uses the caller's existing
close/disabled callback. `WorkspaceDisclosure` keeps the expert editor mounted.
`SurfaceDialog` retains its existing modal/nonmodal, inert, Escape, handoff and
focus restoration implementation.

`td2-workspace.css` applies only in `@media screen`, within explicitly opted-in
Electron workspace roots or dialogs. Tokens reuse the approved TD2/v2 ink,
rose, sheet and highlight material. Dense forms and tables use opaque surfaces.
Lazy-loaded module CSS remains responsible for specialist content and semantics.

## Menu coverage

| Menu | Presentation applied | Verification boundary |
|---|---|---|
| Home B / Dock / widget placement | Protected, no geometry or material changes | Existing source files unchanged; new GUI captures compare the protected surface |
| QuickMemoSurface | Protected; excluded from the new dialog class | Existing measured Dock/150% correction retained |
| Personalization / widget library / Dock settings | Common dialog controls when opened in Settings | Stored values and previews are not reset |
| Tools / calculator / command palette / quick add / work folders | Existing SurfaceDialog and common controls | Existing allowlists, key handling and callbacks retained |
| Tasks / independent calendar | Named form rows, readable actions, container-aware settings, calendar single-column inside bounded dialog | Existing local Task/Event stores and timezone contracts unchanged |
| Global file drop | Existing confirmation uses the shared dialog | Actual Windows Explorer drop remains a separate check |
| Official documents | Workspace sheet/header, editor/preview grid, collapsible AI controls | Current/source/proposal remain separate; disclosure does not clear inputs |
| Purchase / image review / settings / outputs | Workspace controls, wrapping toolbar, independently scrolling table, reachable sticky footer | AI consent/OCR/approval/calculation/export engines unchanged |
| Finder / search connection / library / notes / AI | Workspace header, controls, tables and state styling | Real search and synthetic mode remain distinct; no service calls in GUI review |
| Newsletter / creation / editor | App toolbar, editor controls and navigation only | SVG/canvas, approved assets and PNG/PDF engines unchanged |
| Finance | Shared host/control styling including unavailable state | Windows SQLCipher/DPAPI editor cannot be certified by Linux UI review |
| Local Inventory / nonpersistent preview | Shared workspace and list/control styles | Local/server separation and Purchase handoff unchanged |
| School admin / school profile / BOGUNON account / AI settings | Shared header, settings controls, readable constraints | No login, external URL execution or address/data changes |
| SCHOOL-05 / instructor | Existing school/role/connection header, shared tasks/events/handovers, SCHOOL07 Inventory and instructor tabs within Electron workspace scope | Existing production gate stays disabled; no Hosted or Cloud B branch changes |
| Instructor attendance/payment preview | Protected, excluded from `td2-dialog` | Existing portal stack, white print canvas, stamp roles and payment NOT REQUIRED policy unchanged |

Development-only QA tools remain development-only. A styled disabled screen is
not an enabled feature. Instructor read-only web and document generation code
are not migrated or redesigned by this presentation change.

## Focused checks

- 17 related Vitest files: **113 PASS, 1 pre-existing failure** (114 tests).
- The same school-profile Excel selected-row-copy assertion fails on the clean
  base SHA (5 PASS / 1 FAIL). It is unrelated to the changed header callback.
- Electron Main/Renderer/tests typechecking and the existing production build
  are the build gates. Root TypeScript has the existing 13 errors; do not replace
  Electron results with a claim of root PASS.
- No lint script exists. Do not introduce one for this task.
- Native CLI/ASAR configuration and all five CLI sources remain unchanged.
  A frontend build is not a Portable/ASAR/native execution test.

## Actual GUI evidence

Use the existing Electron build and isolated profile pattern:

```sh
npm run electron:p0:build
ELECTRON_P0_EXECUTABLE=/path/to/exact/electron \
TD2_UI_EVIDENCE=/tmp/td2-menu-gui-final \
node scripts/qa/td2-workspace-gui.mjs
```

The script visits actual existing entrypoints, uses the real Preload, captures
1280×800, 900×680 and maximized states, and records outer/content bounds, renderer
size, PNG hashes, errors and cleanup in `review.json`. Top and bottom screenshots
are separate. It makes only synthetic local task changes in its own profile.
It neither replaces IPC with mocks nor calls external services.

On Linux, a QA-owned display and window manager are required. The script retains
Chromium sandboxing; it does not pass `--no-sandbox` or change the product policy.
On managed Cloud, the command sandbox may prohibit Chromium user namespaces;
use an approved GUI execution context, not a product security workaround.
The exact downloaded runtime must be verified against Electron's SHA-256 list.

Read raw screenshots separately from automated layout assertions. Default/empty
screenshots are not proof of populated tables, native dialogs, live AI, financial
recovery, document output or production collaboration. Windows GUI, OS DPI,
physical print and real school/service access remain explicit follow-up checks.

## Integration

Fast-forward is possible only if the integration branch is still the base SHA
or another ancestor of the feature head. If Cloud B has advanced it, compare
`P0App.tsx` and `SurfaceDialog.tsx` wrappers and preserve the newer callbacks,
school connection gates and lifecycle. Do not overwrite Cloud B's workspace
implementation with an old full file. No integration/main merge or deployment
is performed by this work.
