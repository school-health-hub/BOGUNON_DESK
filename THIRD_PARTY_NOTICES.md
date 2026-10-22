# Third-Party Notices

BOGUNON DESK includes or depends on third-party open-source software.
Those components remain subject to their respective licenses.

Key directly used components include:

| Component | License |
| --- | --- |
| Pretendard / @fontsource/pretendard | SIL Open Font License 1.1 |
| React / react-dom | MIT |
| Supabase JavaScript client | MIT |
| Tauri and Tauri plugins | MIT and/or Apache-2.0 |
| Lucide | ISC |
| react-grid-layout | MIT |
| TypeScript | Apache-2.0 |
| Vite / Vitest | MIT |
| Rust crates listed in `src-tauri/Cargo.lock` | Individual upstream licenses |

The authoritative license text and attribution for each dependency are
provided by the corresponding upstream project/package. Dependency
versions are pinned or recorded in `package-lock.json` and
`src-tauri/Cargo.lock`.

## Pretendard

Pretendard is distributed under the SIL Open Font License 1.1.
The font is consumed through the `@fontsource/pretendard` package.

## Notes for binary distribution

When distributing compiled Windows installers, preserve all notices and
license obligations required by bundled third-party software. Before a
production release, regenerate or review the dependency license inventory
against the committed lockfiles.

## Official Document Workspace provenance review (draft)

The workspace includes assets adapted from the user's own
`healthroom-document-helper` project: document options, templates, checklist
text and deterministic drafting logic. This is recorded as first-party
project migration, not as an additional third-party dependency.

IeumOffice (`pblsketch/openoffice`) and its GenOffice ancestry are under
provenance review. The user reports permission from the IeumOffice author.
The reviewed public snapshot carries Apache-2.0 and a NOTICE; however, no
specific reused file or original reuse revision has yet been established
for this workspace. This review status is not a finding of non-use and is
not an attribution that those projects are bundled with BOGUNON DESK.
They are not added to the confirmed component table on that basis alone.

See [the provenance draft](docs/OPEN_SOURCE_PROVENANCE.md) for pinned
source links, file correspondences, evidence limits and outstanding checks.
If reuse is established, preserve the applicable upstream copyright and
NOTICE material, supply the license text, and identify modifications as
required by the applicable license. Include only relevant material; do not
claim that all components in an upstream NOTICE are used here.

This source notice is not proof that notice files reach a Windows installer
or portable distribution. Verify delivery of required license texts and
notices in the actual release package before distribution. This draft does
not certify a complete dependency-license audit.
