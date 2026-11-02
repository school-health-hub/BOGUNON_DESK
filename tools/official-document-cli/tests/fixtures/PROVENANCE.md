# Synthetic fixture provenance

All fixtures contain synthetic text only and originate from
`feature/official-document-enhancement` commit
`6f26310d9d36db6b54ef63870838aa42fe347774`, under
`qa/official-document/fixtures/`.

| File | Source blob | Stored SHA-256 | Bytes | Note |
|---|---|---|---:|---|
| `synthetic-document.hwpx` | `e591f80d93cd12309571337ced32b3da56dffc7b` | `1262247391DCED1B11DB62C25ADD4AA0836B5E82878B72F4CED567377E724821` | 226 | Raw blob bytes. |
| `synthetic-document.odt` | `f38077e1676fbb4f482bd1ae6c2e29301cbb01b2` | `5E0A1B54AA2ECD6F3267E078EB52E234568697B6DFBE5C149B07D8F1586D1D6D` | 400 | Raw blob bytes. |
| `synthetic-document.pdf` | `125f67fa922bfee5b18e9cc8b92580a531d5842b` | `DE48C4BB8EA49EEF7BAD8C77B090426CE99EFBE7D69C4BC48A52A5097EC3FADA` | 593 | Source generator text normalized from LF to CRLF so its authored xref byte offsets are valid; equivalent to the source worktree checkout. |
| `unsupported-document.txt` | `fb4e82d53277eb4f96c3e0cc2ca80fadc5695a38` | `45803F7834B466E89D7130BCE15BF8239EDE91F02C28D0C293D1EC871B7A9C57` | 60 | Raw UTF-8 blob bytes. |

The source fixture inventory was inspected in T1. No credentials, private keys,
student/patient identifiers, creator metadata, JavaScript, or forms were found.

