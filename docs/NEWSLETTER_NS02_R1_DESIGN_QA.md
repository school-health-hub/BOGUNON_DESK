# NEWSLETTER NS-02-R1 Design QA

## 1. Scope and source

- Branch: `codex/ns02-integrated-visual-qa`
- Start product source: `75fa892b15f2150bd8d647c1a5474aa9087e0611`
- Validated product change commit: `bec6cc6` (`fix(newsletter): repair NS-02 card composition`)
- Scope: card-cover overlap and teaser content, six body-card action layouts, and missing optional-art presentation only.
- Existing document coordinates, revisions, source copy, A4 layout, student-art approval state, IPC, and output formats were not migrated or changed.

## 2. P1 corrections

### Cover placeholder overlap — fixed

The cover Scene previously rendered missing optional mascot and seasonal-decoration assets as large placeholders in addition to the main illustration placeholder. Those independent frames overlapped. Card Scenes now omit only optional art that has no assigned asset, while retaining the main illustration placeholder so that an unassigned illustration remains explicit in QA output.

The stored template frames and existing documents are unchanged. Pending student illustrations are not selected automatically.

### Four teaser contents — restored

The cover compiler previously copied only each selected topic title. It now uses the canonical section lead from the same source topic and renders `title + lead`; title-only remains the safe fallback when the source has no lead. No health copy is invented.

The November synthetic fixture produced four visible teaser pairs:

1. `11월 건강한 학교생활` + its source lead
2. `손 씻기` + its source lead
3. `친구 관계` + its source lead
4. `건강 상담` + its source lead

## 3. P2 body-card density correction

For a structured card with exactly four canonical actions, the existing action-list frame is now divided into four readable action rows. Alternating restrained surfaces create a scannable hierarchy without enlarging text merely to fill space. The title, lead, source illustration placeholder, four actions, and closing sentence remain sourced from the existing document.

All six body cards were inspected individually. Each contains one title, one lead, four distinct action rows, one main illustration area, and the existing closing copy. No body text, revision, or action order was changed.

## 4. September approved-reference comparison

Real September reference images were available and used read-only. R1 improves the November result in the requested areas:

- the cover no longer has overlapping optional placeholders;
- all four teaser tiles contain source title and lead;
- body actions are visually grouped rather than presented as one loose list;
- the seven-card palette, typography, and frames remain consistent.

The September approved design still has substantially richer approved illustrations, topic-specific icons, mascot placement, and tighter editorial composition. R1 does not claim that the synthetic-placeholder November output is equivalent to that approved publication design.

## 5. Placeholder and publication protection

- The main unassigned illustration remains a clearly labelled QA placeholder.
- Missing optional mascot/seasonal assets are omitted instead of becoming unrelated dominant shapes.
- The 20 pending student illustrations remain pending and were not inserted into export.
- The approval gate was not bypassed or reclassified.
- November publication readiness remains **NOT APPROVED**.

## 6. Product outputs

The actual Electron renderer, IPC export worker, output validation, and filesystem writer produced:

| Output | Result |
| --- | --- |
| A4 PNG | PASS, 2480×3508, byte-identical to NS-02 baseline |
| A4 PDF | PASS, valid 1-page PDF |
| Card PNG | PASS, exactly 7 files, each 1800×1800 |
| Card PDF | PASS, valid 7-page PDF |

Destination selection used the existing QA main-process stub. Native Windows Save dialogs were **NOT RUN** and are not claimed as part of this design gate.

## 7. Verification

- New characterization tests: cover optional-art omission, four teaser leads, and four action rows.
- Focused rendering/editor/export regression: **10 files / 71 tests PASS**.
- Electron product build: **PASS**.
- Root build: **BLOCKED by pre-existing baseline test TypeScript errors outside the changed files**; no new product error from this change was observed.
- `git diff --check`: PASS.
- Actual Windows Electron isolated-profile run: PASS; renderer/page/console errors in the successful run: 0.
- QA Electron processes after completion: 0.

## 8. Evidence

External evidence root: `NS02_R1_VISUAL_EVIDENCE_20261113` (school-PC QA storage; intentionally not committed)

- `comparison/01-cover-before-after.png`
- `comparison/02-body-before-after.png`
- `comparison/03-after-seven-pages.png`
- `comparison/04-september-reference-comparison.png`
- `outputs/NS02-A4.png` and `outputs/NS02-A4.pdf`
- `outputs/NS02-CARDS.pdf`
- `outputs/cards-parent/.../01-card-cover.png` through `07-card-topic-6.png`
- `captures/01-studio-1440x835.png` through `08-final-output-status.png`
- `windows-results.json`

## 9. Preservation

- The original NS-02 report remains present and unmodified.
- The original NS-02 evidence directory was not overwritten.
- Existing 48 worktrees and H6/H7 evidence were not reset, cleaned, checked out, merged, or deleted.
- No source copy, revision, existing document geometry, A4 image bytes, student-art source, or approval status was changed.

## 10. Independent visual review

Two independent read-only reviewers inspected the before/after boards, all seven R1 card images, and the real September references.

- Both reviewers marked the cover overlap and four teaser-content defects PASS.
- Both found all six body cards materially easier to scan, with four stable action rows and no observed Korean clipping or overlap.
- Both kept the design verdict CONDITIONAL against the September approved publication: the approved reference has denser topic-specific art, action icons, and mascot use.
- Both kept publication **NOT APPROVED** because pending art was not approved or applied.
- The remaining mismatched main placeholders are explicitly labelled QA placeholders; they are safe for QA but not suitable as final publication art.

## 11. Remaining design gaps

- Approved topic-specific art and mascot assets are still absent from this synthetic publication output.
- The November card design remains visually more minimal than the September approved reference.
- Native dialog completion, physical printing, real publication copy, and pending-art publication remain NOT RUN / NOT APPROVED.

## 12. Verdict

- P1 cover overlap: **PASS**
- P1 teaser content: **PASS**
- P2 body information density: **PASS for the scoped structural correction**
- Placeholder safety and approval gate: **PASS**
- A4 regression: **PASS**
- Product output functionality: **PASS**
- September-level final publication design: **CONDITIONAL**
- Publication approval: **NOT APPROVED**

The scoped NS-02-R1 product correction is ready for the NS-02 branch once the staged diff, evidence manifest, and independent visual review are complete. It does not authorize publication or merge into another branch.
