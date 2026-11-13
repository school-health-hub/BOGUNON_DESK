# UX-08-1 portable review and validation receipt

## Scope and provenance

- Repository: `school-health-hub/BOGUNON_DESK`
- Source SHA: `e2f5df7b9a6b3f31a35d79c39f061228b0a0c92e` (BRAND-01)
- UX-08-1 implementation commit: `ee54f6e90fc67ce7a88f2ce2fdff8575169aec6a`
- Branch: `codex/ux-08-1-workspace-navigation`
- Evidence manifest: [`manifest.json`](./manifest.json)

Approved implementation scope was limited to the shared `WorkspaceHeader`, the Official Document Workspace adoption of that header while preserving its dirty/busy close ownership, small-window regression QA for Toolbox/Settings/Dock, and a disconnected presentation-only `WorkspaceStepBar`. The Newsletter production editor, keep-alive, revision flow, NS-05 AI integration, Dock/Palette runtime, multimonitor logic, user profiles, main merge, deployment, and PR creation were deferred or prohibited.

The screenshots were created by the dedicated UX-08-1 Playwright harness with a fresh random Electron test-run identifier and an isolated test profile. The manifest records the source SHA, run identifier, requested content sizes, native outer bounds, layout geometry, file names, SHA-256 values, renderer errors, icon state, and synthetic-data declaration.

## Validation commands and outcomes

Commands were executed from the repository root on Windows with Node `v22.23.3` and npm `10.9.9`. Temporary directories and caches were directed to the isolated F: worktree where supported.

```powershell
npx vitest run electron-p0/tests/td2-workspace-ui.test.tsx electron-p0/tests/official-document-files-ui.test.tsx electron-p0/tests/file-drop-ui.test.tsx electron-p0/tests/official-ai-workflow.test.tsx src/components/workspace/WorkspaceStepBar.test.tsx --no-file-parallelism --maxWorkers=1
npx vitest run electron-p0/tests/soft-rose-surface.test.tsx electron-p0/tests/brand-assets.test.ts src/dock/AppDock.test.tsx src/components/desktop/ToolboxPanel.test.tsx src/newsletter/NewsletterStudio.test.tsx --no-file-parallelism --maxWorkers=1
npx tsc --noEmit
npx tsc -p electron-p0/tsconfig.renderer.json --noEmit
npm run build
npm run electron:p0:build
npx playwright test --config electron-p0/playwright.config.ts electron-p0/e2e/ux08-1-workspace-navigation.e2e.ts --workers=1
git diff --check
```

Recorded outcomes:

- UX-08-1 focused tests: **5 files / 34 tests PASS**.
- Protected-surface regression: **5 files / 28 tests PASS**.
- Root TypeScript and Electron renderer TypeScript: **PASS**.
- Root and Electron production builds: **PASS**.
- Windows Playwright harness: **1 test PASS**, 12 captures written.
- `git diff --check`: **PASS**.
- Official Document dirty-close cancellation preserved the synthetic input and kept the Workspace open; accepting close then returned to Dock. Busy-state close disabling also passed focused regression.
- `WorkspaceStepBar` production callers: **0**; Newsletter connection remains **NOT RUN**.

The first GUI attempt failed before product-window validation because the new QA harness supplied a prefixed run id where the existing product contract required a raw UUID. Only the new harness was corrected to use `randomUUID()` directly; the final command above passed. This was not recorded as a product-runtime failure.

## Windows and visual review findings

The manifest contains Dashboard + Dock, Toolbox, Settings, and Official Document captures at all three content sizes:

| Content size | Native outer bounds | Captures | Result |
| --- | --- | --- | --- |
| 1440×900 | 1456×965 | 4 | PASS |
| 980×700 | 996×765 | 4 | PASS |
| 900×680 | 916×745 | 4 | PASS |

Two independent reviewers evaluated all 12 captures:

1. **Visual-fidelity reviewer:** 12/12 PASS. Checked common header composition, official BRAND identity, CJK typography/clipping, compact-window wrapping and reflow, absence of global horizontal overflow, and continuity with the UX-08 direction.
2. **Context-and-constraint reviewer:** 12/12 PASS. Checked Dock as the module launcher, no invented global left navigation, Settings-only internal navigation, Toolbox accessibility, Official Document action availability, and that the Newsletter step bar was not presented as connected production UI.

Both reviews used role labels only; no reviewer personal identifier is part of this receipt. The manifest independently reports `rendererErrors: []` and `scrollWidth <= innerWidth` for every capture. Official Document's larger vertical `scrollHeight` is expected document flow, not horizontal clipping.

## Evidence integrity

`manifest.json` is the authoritative mapping from each relative screenshot path to its SHA-256. At final preservation time:

- 12/12 screenshot SHA-256 values recomputed exactly.
- 12/12 files had a valid PNG signature.
- `rendererErrors` contained 0 entries.
- BRAND-01 product manifest verification matched all 26 listed files and byte sizes; no BRAND product asset was changed by UX-08-1.

The receipt deliberately does not add its own hash to `manifest.json`: doing so would change the established capture-only schema, while self-hashing this receipt would be circular. Git object integrity protects this tracked receipt; screenshot integrity remains anchored in the manifest.

## Privacy and security review

The intended tracked package was scanned with best-effort pattern checks for private-key headers, AWS-style access keys, GitHub tokens, JWTs, generic secret assignments, Korean resident-registration-number patterns, and email addresses. No high-confidence match was found. Captures came from an isolated synthetic profile; the only entered document text was synthetic QA text.

Limitations are explicit:

- `gitleaks`, `trufflehog`, and `detect-secrets` were not installed.
- `exiftool` was not installed.
- No OCR or EXIF metadata scan was performed on the PNGs.
- Binary review therefore relied on SHA-256, PNG signatures, isolated-profile provenance, and the two independent visual reviews.

No secret value or operating/user profile data is recorded in this receipt.

## Cleanup and local exclusions

- The only QA-owned Electron PID was re-identified by executable and worktree command line before it was stopped.
- The final scan found **0** Electron, Node, Playwright, Chrome, or Chromium processes whose command line referenced this worktree.
- Four ownership-unresolved files under `docs/evidence/brand01/` remained modified locally. They were not restored, edited, staged, or included in UX-08-1 commits.
- `.qa-temp/` remained local and untracked (2,750 files at the preservation check). It contains caches and prior verifier temporary directories and is not required to review the committed evidence.
- Local `.omo/` receipts were not used as the portable source of truth; this tracked receipt contains the required review facts.
- The concurrently active NS-05 worktree was observed by status count only and was not read, staged, cleaned, or changed.

## Fresh-clone reproduction and audit

Use a disposable path with sufficient disk space. These commands reproduce the static audit and validation; `npm ci` is for a fresh clone only and may run package lifecycle hooks defined by the repository.

```powershell
git clone https://github.com/school-health-hub/BOGUNON_DESK.git BOGUNON_DESK-ux08-review
Set-Location BOGUNON_DESK-ux08-review
git checkout codex/ux-08-1-workspace-navigation
git rev-parse HEAD
npm ci
npx vitest run electron-p0/tests/td2-workspace-ui.test.tsx electron-p0/tests/official-document-files-ui.test.tsx electron-p0/tests/file-drop-ui.test.tsx electron-p0/tests/official-ai-workflow.test.tsx src/components/workspace/WorkspaceStepBar.test.tsx --no-file-parallelism --maxWorkers=1
npx vitest run electron-p0/tests/soft-rose-surface.test.tsx electron-p0/tests/brand-assets.test.ts src/dock/AppDock.test.tsx src/components/desktop/ToolboxPanel.test.tsx src/newsletter/NewsletterStudio.test.tsx --no-file-parallelism --maxWorkers=1
npx tsc --noEmit
npx tsc -p electron-p0/tsconfig.renderer.json --noEmit
npm run build
npm run electron:p0:build
npx playwright test --config electron-p0/playwright.config.ts electron-p0/e2e/ux08-1-workspace-navigation.e2e.ts --workers=1
```

To audit the committed screenshots without regenerating them:

```powershell
$manifest = Get-Content -Raw docs/evidence/ux08-1-workspace-navigation/manifest.json | ConvertFrom-Json
$root = 'docs/evidence/ux08-1-workspace-navigation'
$failures = foreach ($capture in $manifest.captures) {
  $path = Join-Path $root $capture.file
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
  if ($actual -ne $capture.sha256) { $path }
}
if ($failures) { throw "Evidence hash mismatch count: $($failures.Count)" }
"Verified $($manifest.captures.Count) screenshot hashes; renderer errors: $($manifest.rendererErrors.Count)"
```

Fresh-clone execution on a second PC was **not performed** during UX-08-1. The repository and portable evidence are remotely preserved, but Windows/Electron prerequisites, available disk space, and runtime behavior must be confirmed on the receiving PC before treating its local environment as validated.
