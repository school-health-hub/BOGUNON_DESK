# P11 supported template versions

## Bundled home-v1 approval (2026-11-01, supersedes private/manual-only guidance below)

The repository owner explicitly authorized publishing the exact reviewed home-v1
at `resources/templates/official-document/home-v1.odt`. Its bytes/SHA and existing
structure contract are unchanged. Static XML inspection found no populated author,
personal/school identifiers, hidden content or external file links. This exception
applies only to that pinned resource; other private templates and real documents
must not be uploaded.

The default `K-에듀파인용 ODT 저장` action now uses compile-time embedded home-v1
and asks only for the destination. `다른 승인 서식 선택 후 저장` preserves the old
manual picker. Both pass the same SHA selector, transformer and staged/atomic save.
See `docs/handoffs/DOC_V2_P11_SCHOOL_HANDOFF_2026-11-01.md` for current restoration.
The private harness instructions below describe the earlier non-bundled phase;
repeating that already completed validation is unnecessary.

The original approved template remains supported without changing its contract.
The separately authorized `home-v1` template is selected by exact file SHA-256,
not by filename or inferred structure.

| Version | Template SHA-256 | Style-reference SHA-256 |
| --- | --- | --- |
| original | 15217AE983DEE30575C86CE9573B38568404985CA9C1CF2CF4E2DBA905A3FF36 | 1926FEAEAD668395F2A79731AFEEC9F369CFFAF91D96D911B684043E47C63503 |
| home-v1 | 8BC0FD240B1BEA06758794D9F07A75ABF7FAF13BAC1FBDBCDD3556BE3FF6C285 | 95162FDFF6196124FB6A01108DFFD13178A18261F2B581996B565D5FB465F028 |

Both pin the same 43 bookmark names/types/paths/order, four tables, four frames,
255 style references and original ZIP local-header contract. Unknown or modified
files remain blocked. The Hancom-edited 71F49707... file is not supported.

The existing ODT save command selects the contract before transformation and the
save dialog. It keeps the existing staged validation and atomic replacement.
This does not establish Hancom rendering or actual K-education import success.

## Private offline product-output verification

Dispatch the existing official-document workflow with full `p11_source_sha`,
`p11_supported_template=true`, `p11_contract_only=true`, `runtime_only=true`.
Only four new synthetic tests run; a private-template harness is explicitly ignored.
The resulting artifact contains a console test executable and its SHA-256, not
private ODT inputs or outputs. Verify the artifact/source hashes before using it.

On the authorized local PC, run the console validator (not the GUI app) with
`P11_PRIVATE_TEMPLATE` pointing to the exact authorized private ODT and
`P11_PRIVATE_OUTPUT` pointing to a new dedicated directory's output file.
The parent of that dedicated directory must already exist; the harness exclusively
creates the new directory and refuses to reuse it. Route TEMP/TMP to E: for this
process. Run only:

```
p11-offline-validator.exe --ignored --exact official_document_odt::tests::supported_template::export_private_home_template_with_product_functions --nocapture
```

The harness invokes the same contract selector, transformer, staged validator and
atomic saver as the app. It generates synthetic content, reads back saved bytes,
and reports only the resulting SHA-256. Keep the private template and output on
the local disk; never upload them to Git or Actions artifacts. No local compilation,
authentication, GUI initialization, or external service is needed. Record actual
execution results separately; availability of the harness alone is not a PASS.

## Authoring and file-selection flow (2026-11-01)

Create a local draft, then expand `제목·본문 수정` to edit its title and body.
The preview, title/body/full copy actions and ODT request share the same draft.
The preview shows the fixed export recipient `내부결재` and blank route.
Paragraphs, numbering, indentation and line breaks are passed through unchanged.
The frontend requires one final `끝.` and never silently rewrites the manuscript.
Choose `K-에듀파인용 ODT 저장`, select the private home-v1 source file (or original
approved version), then select the output location. No template path is remembered,
and no private template is bundled. Cancellation and failure retain the manuscript.
During saving, the manuscript editor is disabled to keep preview and request aligned.

The user reports actual K-education import success for the previously generated
home-v1 output. This does not constitute GUI testing of these authoring changes.
The authoring-only CI mode runs TypeScript and targeted jsdom tests, without Rust
compilation, GUI startup, AI requests, or private ODT uploads.
