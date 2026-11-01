# P11 supported template versions

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
