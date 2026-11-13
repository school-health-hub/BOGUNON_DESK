# UX-08 navigation review evidence manifest

Generated: 2026-11-13 (Asia/Seoul)<br>
Branch/HEAD: `integration/electron-feature-baseline` / `9e3ead09927aff4535aa422c3c15831dc4de6c89`

## Provenance

- Repository evidence: `DESIGN.md`, `docs/qa/TD2-*.md`, `docs/qa/SCHOOL-TD2-CANDIDATE.md`, `docs/evidence/td2-soft-rose-glass/*`, UX-07B~07F Git history, and current module/style sources listed in the review document.
- Actual Windows observation: installed `BOGUNON DESK` was observed on 2026-11-13. Dashboard, Dock, 업무 도구함, and 공문작업실 were inspected. The screen contained school-identifying and schedule data, so no raw screenshot was copied into the repository. `01-current-menu` is a privacy-safe structural reconstruction, not a screenshot.
- External source: `https://www.tdesk24.com/`, accessed 2026-11-13. Only public product-description claims were used. No third-party screenshot, icon, or asset was copied.
- Search boundary: current worktree, all local/remote Git refs available locally, and public web search were checked for `쌤보드`/`ssamboard`; no product-specific authoritative design source was identified. This is a search result, not proof that no such source exists.
- Render method: SVG sources rendered at 1440×900 with the already-installed Playwright package and system Google Chrome. No package install, product build, or product test was run.

## Interpretation

- All five boards are decision wireframes, not product implementation or native viewport QA evidence.
- `02-reference-patterns` uses a large explanatory grouping box; it does not propose an enclosing desktop panel. The verified UI contract remains independent widget objects without an outer panel.
- `03-collapsed-left-menu` is a rejected/secondary comparison. Its 980×700 region is a schematic application hypothesis, not a scale drawing or screenshot.
- `04-top-tools-newsletter` is the recommended structural direction pending user approval and actual implementation QA.

## SHA-256

```text
D7A391EC80C40940F167D2D7603473E8ADAADDD0D31ED85CD346D1F20C79E90D  01-current-menu.png
72B9AA183EDF60E6FCCC1FDA2147F5FB298DAA507DA83CE0C0843D259A4DCEB5  01-current-menu.svg
737C76FA6E198034CBE1E0EFB1ABAE49744ECD304893A867D186547B15C02471  02-reference-patterns.png
78425272786217A8DA0B63BA70AD46BFC8BF0781CE8ABBB2856C71036775CB04  02-reference-patterns.svg
24578559CF8F71F8F8FA39EBCD4B9D49D997840BB5253B6D6F3506248519552A  03-collapsed-left-menu.png
E5EA441C5D6E334C256998671C296CF8B251EFC00EF79AF3B94FE77969E6BCFC  03-collapsed-left-menu.svg
A4D28FC8522D5704881A54F1BB8B9F6F37BE5ECCA29A781C320BA8351AB0B603  04-top-tools-newsletter.png
FE2CCE62BC9896C1EAD736BCADBF88A0CFAD69C283400F0F56F1DEF57117A8DF  04-top-tools-newsletter.svg
62F3269D2136B9BA6CFF63F61773612D1D81763281BFFE7CCB52DFCC79B6652B  05-role-separation.png
E806247C1C503BB9599FBF5454B185CDC104ED4427919D41A56BB270BFF1419B  05-role-separation.svg
```
