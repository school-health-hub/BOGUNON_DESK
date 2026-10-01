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
