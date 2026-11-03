# OPTION C Soft Rose Surface usability checkpoint

Base: `integration/electron-feature-baseline` at `195f3375e91348d2bbc7145b0e3743ca5f54385f`.
Work branch: `codex/soft-rose-option-c-polish`.

## Scope

- Keep all 13 widget definitions, persisted coordinates/sizes/visibility, appearance IDs and existing task/memo/settings contracts.
- Compact the Electron header reservation; reserve an independent Dock row at all window heights. The workspace scrolls above the Dock, including its final row.
- Restore Soft Rose translucent card/Dock material with 12px internal backdrop blur. Existing Flat appearance, unsupported backdrop filtering and reduced-transparency preference have opaque fallbacks. This does not provide wallpaper transparency or Native attachment.
- Reduce the calendar's excessive minimum height; wrap long Korean labels; prevent the current-day upcoming row's negative margins from causing horizontal scroll.
- Keep Settings above ordinary work panels, contain modal focus and route Escape only to the active modal. Existing invoker restoration and Newsletter handoff remain.
- No changes to Main, preload, protocol, Finance, Tauri, Native branches, dependency manifests, workflows or data stores.

## Focused verification

Commands (from this checkout, using existing local dependencies):

```text
node scripts/electron-p0/build.mjs
node node_modules/vitest/vitest.mjs run electron-p0/tests/soft-rose-surface.test.tsx electron-p0/tests/widget-state-notices.test.tsx
node node_modules/@playwright/test/cli.js test --config electron-p0/playwright.config.ts soft-rose-usability.e2e.ts
git diff --check
```

The build includes Electron Main, renderer and test TypeScript checks and production Vite output. Existing large export-worker/font bundle warnings remain; no Portable packaging is performed.

The focused unit suite covers modal focus/Tab/Escape, nonmodal behavior, hidden invokers and P0 weather/meal disconnected-vs-error states (20 tests). The Electron test covers 1440×900 and 980×700 content sizes, 125%/150% zoom, a long synthetic Korean task, no workspace/upcoming horizontal overflow, bottom scrolling, Dock separation and Settings close/focus restoration. Every launch has a fresh UUID test profile; existing Portable/user profiles are not used.

Final results: **20/20 focused unit tests PASS; Electron usability scenario PASS across all five size/zoom combinations; all three Electron TypeScript configurations and production renderer build PASS; diff check PASS.** Visual inspection additionally found and fixed summary-heading overlap with long D-Day content and narrow modal intrinsic-width overflow. The final scenario asserts summary separation and the entire modal viewport bounds. The latest build retains only existing bundle-size warnings.

An earlier existing INT-EL-05C run failed its bottom-scroll assertion at the base. The dedicated test records the fix. One intermediate run remained on the startup loading screen; it is not counted as a pass. Subsequent results must be read from the final test output, not inferred from this note.

## Local evidence and limits

`artifacts/option-c/` contains local before/after screenshots and build output; these ignored artifacts are not committed or uploaded. Before screenshots use empty data, after screenshots use the explicitly synthetic task. They demonstrate layout, not identical content or pixel-diff equivalence.

125%/150% Electron zoom is renderer accessibility coverage, not an OS DPI transition test. Windows system DPI changes, latest Portable execution, and low-end-device performance remain NOT VERIFIED. WorkerW/SetParent/Explorer manipulation remain NOT RUN under OPTION C.

No installed app/profile is replaced. QA test profiles and evidence are retained. Source review and best-effort secret-pattern inspection cover the intended commit; no dedicated secret scanner is installed. No confidential evidence or profile data belongs in this checkpoint.
