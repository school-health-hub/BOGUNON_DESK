# NS-01-R1 — cover title fit handoff

## Verdict
CONDITIONAL. Render-only title P2 fixed; Windows cover preview and standalone synthetic PNG/PDF visual comparison PASS. Full in-app PNG/PDF export is NOT VERIFIED: the existing rasterizer invoked inside the product page returned `EncodingError: The source image cannot be decoded.` No output engine or CSP change was made. Do not interpret standalone artifacts as successful native export.

## Cause and scope
The reproduced 285px measurement was required text **height**, exceeding a 260px title frame (620px wide), not a 285px width versus 260px width. Existing wrapping at font 76 produced three lines. `fitCoverTitle.ts` reuses the existing line breaker and measurer; keeps the original style when it fits, otherwise tries integer sizes downward to max(32, half the original size), capped by original size. Extreme text still reports overflow at this readability floor. Saved frames never grow; title strings are never rewritten.

`renderDocument.ts` applies fitting only to cover project-title blocks, including official/editorial cover paths. No A4, body-card, teaser, asset, recommendation, revision, approval or monitor lifecycle changes.

## Verification
- Focused cover/render/official-template tests: 19 PASS; added space-free cover validation regression: 1 PASS (9 skipped in that targeted invocation).
- TypeScript and Electron production build PASS; git diff --check PASS.
- Five titles: short; default year/month/coeducational; extended Korean; unspaced Korean; explicit two lines.
- Actual Windows Electron: all five title bounding boxes inside saved frames; source documents unchanged. One native Windows card-mode click; subsequent fixture navigation used Playwright input. Do not label all input native.
- Actual font sizes: 76 / 76 / 57 / 69 / 76. Estimated fallback sizes: 76 / 69 / 52 / 68 / 76. Measurer-dependent wrapping is expected.
- Baseline comparison: A4 and six body cards identical for all cases; short cover identical; four teasers and seven cards preserved. An existing A4 orphan warning for the unspaced fixture is unchanged and outside this cover-only fix.
- Five actual Scene SVGs, same existing rasterizer/font and PDF composer generated standalone synthetic PNGs and a five-page cover-comparison PDF. Two independent visual reviewers inspected all ten PNG/PDF-render images: title fit and wrapping PASS. PDF rasterization rounded width to 1801 versus PNG 1800; no pixel/byte equality claim.
- No pending student art in output fixtures; approval gate unchanged. Placeholder art is QA-only.
- An initial QA import mapping error was corrected; it is not evidence of a product font defect. Remaining in-product decoding error cause NOT VERIFIED.

## Evidence and disk
Local-only: `E:\BOGUNON_DEV\qa-output\NS01_R1_20261113`.
Contains fixture-results.json, windows-results.json, case-*-window.png, actual-cover-*.svg, QA-cover-*.png, QA-title-cases.pdf, PDF-cover-*.png, product-output-limit.json, logs and SHA256 manifest. Originals are not uploaded; no claim of remote evidence availability or receiving-PC readiness.
C: before ~0.78GiB, after ~0.73GiB; E: before ~832.88GiB, after ~832.79GiB. Process TEMP/TMP and isolated profiles on E:. No user/cache deletion or permanent environment change. Electron normal close completed; scoped process inventory found no matching QA Electron/Chrome processes.

## Provenance and Git
Start: b84cd4962a773d954900b61be82ec392255b5222.
Product Source: 0d44489939b955d434d1cd2e1ccb654d4bcac499 (build metadata matched; dirty includes preserved untracked documents/test-only follow-up).
Branch: codex/electron-h6-design-renewal. Final report/checkpoint commit is the commit containing this note, a descendant of the product source. Verify remote HEAD and divergence after normal push; never infer evidence completeness from Git sync.
Four pre-existing untracked audit/plan documents preserved, not staged; overall working tree therefore intentionally not clean, tracked scope clean after checkpoint.
Best-effort scoped text secret inspection only; no secret-scanner assurance. No raw QA data/images included in Git. UX-07E/F remain CONDITIONAL.

## Remaining
Reproduce and diagnose the existing in-product image decode/export path in a separately approved output task; native complete save and full app PNG/PDF agreement remain NOT VERIFIED. No main merge, deployment, portable build or unrelated regression performed.
