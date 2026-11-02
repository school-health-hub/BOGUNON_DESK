# OD Cloud handoff recovery (2026-11-02)

## Checkpoint scope

- Repository: `school-health-hub/BOGUNON_DESK`
- Branch: `codex/electron-official-document-files`
- Base: `8f0044cd00bdcfe219a2d9ff0decaf4b4b2bede4`
- Scope: WIP sources under `tools/official-document-cli/**` only
- Status: **WIP / incomplete**. This checkpoint does not claim Electron IPC/UI integration or Windows product validation.

The 24 pre-existing local files are inventoried in
`OD_CLOUD_HANDOFF_RECOVERY_2026-11-02.sha256`. The added CLI-local
`.gitattributes` marks package fixtures as binary so Git preserves their
working-tree bytes when `core.autocrlf=true`.

## Implemented WIP

- Rust CLI command and library skeleton for PDF, HWPX, and ODT import.
- Package inspection, limits, document-contract conversion, ODT transformation,
  and explicit-path writing.
- Synthetic import/ODT contract fixtures and focused Rust tests.
- Approved `home-v1.odt` template copied from the verified official-document
  source branch.

Not implemented or not validated here:

- Electron typed IPC and renderer integration.
- Native file-dialog behavior and cancellation preservation in the product.
- Windows packaged-app file processing.
- Full original formatting/table preservation.
- Independent final review and product integration gates.

## Fixture discrepancy (unresolved WIP)

The canonical Git blob at
`feature/official-document-enhancement@6f26310:qa/official-document/fixtures/synthetic-document.pdf`
is 562 bytes with SHA-256
`ac28c49217a4294b44ba20784add814dee54d0ff10e8f44e24e32890bb6f2f2c`.

The Windows checkout and this WIP copy are 593 bytes with SHA-256
`de48c4bb8ea49eef7bad8c77b090426ce99efbe7d69c4bc48a52a5097ec3fada`.
The 31-byte increase is exactly the conversion of 31 LF bytes to CRLF by the
Windows checkout (`core.autocrlf=true`; no source `.gitattributes`). The WIP
fixture has not been normalized or otherwise edited during recovery. Cloud must
decide which representation is canonical before treating the fixture contract
as final.

## Validation state

- Focused Rust tests: previously recorded PASS (18 passed; one explicitly
  ignored manual artifact test). Re-run results for this checkpoint belong in
  the commit/push report, not as a product-level PASS.
- Clippy with warnings denied: previously recorded PASS.
- TypeScript, Electron production build, IPC/UI integration, Windows packaged
  execution: **NOT RUN** for this checkpoint.
- The ignored manual test writes only to an explicitly provided private
  temporary path; manual artifact QA remains **NOT RUN**.

## Security and provenance review

- Text source, manifests, tests, and text fixtures were inspected for common
  credentials, private keys, tokens, personal/student/patient data, and local
  absolute paths; no matches were found.
- Binary inventory was limited to the approved ODT template and synthetic
  HWPX/ODT/PDF fixtures. No operating data or real school document is included.
- No dedicated secret scanner was installed; this is a documented best-effort
  review with residual risk.
- Raw `.omo/**`, local evidence, `target/**`, build caches, logs, and machine
  state are intentionally excluded from Git.

## Cloud Gate 0

1. Fetch and verify this branch and its full checkpoint SHA.
2. Verify the 24-file SHA-256 inventory before making changes.
3. Resolve and document the 562B-vs-593B PDF fixture canonical-byte decision
   without silently rewriting evidence.
4. Run `cargo test --locked --manifest-path tools/official-document-cli/Cargo.toml`.
5. Run `cargo clippy --locked --manifest-path tools/official-document-cli/Cargo.toml --all-targets -- -D warnings`.
6. Review the WIP contracts before beginning separately approved Electron IPC/UI integration.
