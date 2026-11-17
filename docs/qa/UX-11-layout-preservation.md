# UX11-LAYOUT-001 — automatic grid callbacks overwrote saved geometry

Status: correction validated. Final full regression: 1,063 PASS / 0 FAIL / 3 existing SKIP (160 files). No integration or deployment.

## Classification and cause

This predates UX-11. The exact UX-10 source
`f36a32e5b8e8e2190e60ad3929a0f4b8c388b796` and pre-fix UX-11
`0cf7a3dcf60689abe80b6028f80f90d137fc9bdc` plus its presentation WIP
produced identical geometry at all 13 observed checkpoints.

`DesktopWidgetLayout` forwarded automatic RGL `onLayoutChange` notifications.
While editing, `DashboardCanvas` merged them and its settings effect persisted
the new geometry. No pointer drag occurred during the visibility operations.
Observed save-API arguments exactly matched the actual localStorage writes;
the incorrect values survived reload. This was not merely a visual projection.

| Visibility sequence, after initial projection | Before correction: saved meal / memo y | After correction |
| --- | --- | --- |
| Meal OFF | 5 / 5 | 5 / 7 |
| Meal ON | 8 / 5 | 5 / 7 |
| Memo OFF, then ON | 8 / 5 | 5 / 7 |
| View/Edit transition | 8 / 5 | 5 / 7 |
| Reload | 8 / 5 | 5 / 7 |

Do not confuse this defect with existing canonical materialization. Fresh default
storage uses meal `(4,7,4,2)` and memo `(0,9,5,3)`; the dense display projects them
to `(6,5,3,2)` and `(6,7,3,3)`. The first intentional visibility edit materializes
those displayed coordinates. That established behavior remains unchanged. No
custom layout is replaced with a default Bento layout.

## Minimum correction

- Shared layout saves only completed drag/resize in editable, noncompact mode.
  Automatic mount, width and visibility callbacks do not write coordinates.
- The drag-handle button is exempt from the ordinary-control cancellation
  selector. Other buttons, inputs, links and resize handles remain protected.
- Electron's existing selector rewrite is idempotent. Its forwarding and the
  shared callbacks compose into exactly one save per explicit completion.
- Geometry transforms, visibility actions, storage APIs/schema, authentication,
  engines and Main/preload/IPC are unchanged.

Unit RED reproduced four shared-boundary failures and one selector-idempotence
failure. GREEN covered automatic callbacks, both explicit edits through shared
and Electron paths, view/compact guards, and permitted/excluded controls.

## Actual operation checks

In a fresh synthetic ordinary App session, stored geometry remained stable
after initial materialization. Direct drag changed clock x `0→1`; direct resize
changed its size `2×2→3×3`. Each generated exactly one save-API call and storage
write. All widget IDs/type/x/y/w/h/visible/settings matched after reload.
The production App also passes all 13 visibility round trips, four viewport
keyboard/layout checks and reload preservation.

Electron passes its 26-capture visibility/restart checks and a separate actual
drag/resize/restart scenario. Intentional manual collision resolution may move
peer widgets; its final user-edited layout is deliberately persisted.

Synthetic ordinary memo text survives OFF/ON. Ordinary memo is explicitly
session-only and resets on reload; it is not certified as durable storage.
Electron's existing saved memo survives restart. No real school/meal records or
production authentication were used; live authenticated meal-data QA is NOT RUN.
The meal provider/store and its settings contract are unchanged.

## Reproduction and trace provenance

Use a new QA profile. Open the ordinary App, choose setup later, enter
**화면 꾸미기 → 위젯**, toggle **오늘의 급식** and **빠른 메모**, then reload.
Inspect `school-health-desk.dashboard-layout.v1` by stable widget ID. Observe
stored values separately from RGL's displayed/transient compacted positions.
Repeat with explicit handle drag and resize; only those completions should save
geometry. Existing custom data must not be reset to prepare this check.

Local evidence: `E:/BOGUNON_DEV/ux-11-home/layout-20261118-003006/`.
Exact UX10 archive hash, original/fixed traces, actual API/storage arguments,
pointer events, screenshots and summary hashes are retained there. Observer-only
Vite instrumentation logs values and delegates to original calls; a separate
untouched production preview confirms the same preservation result. The first
font-resolver setup failure is retained and excluded from validation evidence.
Raw local evidence and profiles are not included in Git.

See [UX-11 validation record](UX-11-widget-selection-polish.md) for final gates.
