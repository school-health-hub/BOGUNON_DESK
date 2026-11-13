# Newsletter NS-03 Design Reconstruction QA

## Result

- Product source commit: `137938ee8c7b8ecbd0d86fd0e2684addc7b8189e`
- Baseline: `6f3ba0b6bd1162fe3f4ae0d7ee99939314b96683`
- Branch: `codex/ns02-integrated-visual-qa`
- Functional layout verdict: **PASS**
- September-reference structural fidelity: **CONDITIONAL**
- Publication status: **NOT APPROVED**

NS-03 establishes the editable September-style composition without copying a reference screenshot. It does not claim equality with the approved September artwork because the student illustrations and mascot remain unavailable for publication.

## Layout reconstruction

### Cover

- Replaced the sparse NS-02/R1 composition with a large monthly title, a central representative-scene region, and four bottom teaser panels.
- Each teaser carries its title, canonical one-line introduction, and a semantic icon region.
- Missing representative art is shown as `삽화 미지정 / 검수용 미리보기`; an unrelated generic image is no longer rendered as finished artwork.

### Body cards

- Rebuilt all six cards as title and lead, left representative-scene region, four right-side action rows, and a closing banner.
- Each action has a separate number badge and semantic icon region.
- Added title sizing and larger text bounds for long Korean titles and multi-line actions.
- Preserved the canonical closing sentence instead of replacing it with an empty design field.

## Data and approval protection

- The September card preset no longer mutates A4 layout data or includes `a4-page` in its changed-page revision record.
- Existing project content, revision history, card IDs, output dimensions, and schema remain unchanged.
- No pending student illustration or mascot was selected, modified, approved, or embedded.
- A missing cover scene still creates a publication-blocking issue. Final-source Electron evidence confirms the export action remains blocked; the earlier generated R3/R4 files are layout-review artifacts only and are not publication-approved outputs.
- Existing NS-02 reports and evidence were preserved. The pre-existing untracked NS-02 integrated report was not staged.

## Verification

### Focused tests

- `27 PASS / 0 FAIL`: NS-03 layout, September master preset, editor action, and editorial layout suites.
- Coverage includes A4 layout equality, six-card application, long Korean title/action fit, explicit missing-art state, and missing-art publication blocking.
- Broader Newsletter rendering/output run: `195 PASS`, one pre-existing 1 px editorial overflow failure and one timeout; the editorial overflow was corrected and its focused suite now passes. The timeout passed when rerun alone.

### Builds

- Electron product build: **PASS** at final product source commit.
- Root TypeScript/Vite build: **BLOCKED by pre-existing test-source TypeScript configuration/errors** (Node test types, ES library level, Testing Library option types). The only NS-03 type error found during that run was corrected before the final Electron build.
- `git diff --check`: **PASS**.

### Windows Electron

- Final source SHA shown by Electron: `137938ee8c7b8ecbd0d86fd0e2684addc7b8189e`.
- Isolated synthetic QA profile: **PASS**.
- 1440×835, 1200×800, and 900×680 captures: **PASS** for access and layout.
- Renderer/page errors: none before the intentional publication-gate stop.
- Final-source missing-art export gate: **PASS** (export blocked).
- Layout-review candidate generated A4 PNG 2480×3508, A4 PDF 1 page, seven card PNGs 1800×1800, and card PDF 7 pages before the gate correction. These files prove renderer/output geometry only and are not approved publication files.
- A4 PNG remained byte-identical across the two final layout-review reruns: `3d6f25b2f4c98f93f5f812af5494b48985542521881dc1c369d0bc452c719c0c`.

## Independent visual review

Two read-only reviews agreed that:

- the cover and body information architecture is materially closer to the September reference than NS-02/R1;
- all seven cards show no visible Korean clipping, element overlap, or frame overflow;
- action scanning, hierarchy, and series consistency improved;
- the missing approved scene art and mascot leave a large visual-density gap, so September-level design equivalence remains conditional;
- publication must remain not approved.

## Evidence

External QA evidence is stored outside the repository:

- `NS03_DESIGN_RECONSTRUCTION_FINAL_R5_20261113`: final-source captures, publication-gate result, and SHA-256 inventory.
- `NS03_DESIGN_RECONSTRUCTION_FINAL_R3_20261113`: seven layout-review PNGs/PDF and three-way September/NS-02-R1/NS-03 comparisons.

Key comparisons:

- `comparison/01-cover-september-r1-ns03.png`
- `comparison/02-body-september-r1-ns03.png`

## Remaining gaps

1. Approved topic-specific art and an approved mascot are required before publication-quality equivalence can be reviewed.
2. Real topic copy should be rechecked because the synthetic fixture makes several icons resolve to the generic checklist symbol.
3. Native Windows Save As was not rerun; output destinations used the existing QA main-process destination stub.
4. Root build baseline TypeScript issues remain outside this scoped card-layout change.

## Final decision

The editable September-style card composition is **PASS** for structure and layout behavior. Visual equivalence is **CONDITIONAL**, and publication remains **NOT APPROVED** until approved assets are supplied and the final publication gate is intentionally satisfied.
