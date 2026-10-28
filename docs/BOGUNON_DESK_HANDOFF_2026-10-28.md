# BOGUNON DESK handoff — 2026-10-28

## Resume baseline

- Repository: `school-health-hub/BOGUNON_DESK`
- Surface source branch: `integration/desktop-surface-s2`
- Surface source SHA: `bffb5eff3fac9d92a3cf92b466afa73da45d492d`
- Handoff branch: `codex/handoff-2026-10-28`
- Actual Windows Desktop Surface runtime: **NOT_VERIFIED**
- WorkerW attachment: not implemented or executed in this work period.

The Surface UI checkpoint and its prior Native/IPC work are preserved at the source SHA above. The latest investigation changed no repository source files.

## S-2H-35 confirmed result

The repeated `module_load_error` / `RendererReady` timeout is caused by the folder string passed to WebView2 virtual-host mapping, not by `NativeHandlerRegistry`, `RendererSession::register`, diagnostic stage writes, or ownership movement.

Controlled results with the same synthetic HTML/JS/CSS, WebView2 runtime, handler bodies/order, `DENY_CORS`, and independent UDFs:

| Condition | Result | Cleanup |
|---|---|---|
| Diagnostic stage I/O enabled | timeout after HTML load; `ModuleLoadError` | `Ok(Released)` |
| Diagnostic stage I/O disabled | same timeout and observations | `Ok(Released)` |
| Session/runtime/webview moved into an AttachedRenderer-equivalent owner, raw absolute folder path | `Ready`; CSS/JS responses, projection, and RendererReady accepted | `Ok(Released)` |
| Same owner, Rust-`canonicalize()` folder path | timeout after HTML load; CSS/JS response observations absent | `Ok(Released)` |
| Fresh-UDF repeat, raw path | `Ready` | `Ok(Released)` |
| Fresh-UDF repeat, canonical path | timeout | `Ok(Released)` |

The path probe recorded:

```text
raw_verbatim_prefix=false canonical_verbatim_prefix=true canonical_unc_prefix=false
```

This provides a toggle proof: `Path::canonicalize()` adds the Windows verbatim `\\?\` prefix; passing that string to `SetVirtualHostNameToFolderMapping` reproduces the failure. Passing the original absolute non-verbatim path removes it.

Relevant production location:

- `src-surface-host/src/windows_host.rs`: the `bundle_dir.canonicalize()` result near the start of `attach_surface_renderer`
- The same value is passed to `SetVirtualHostNameToFolderMapping` shortly afterward.

Selected raw evidence and its SHA-256 inventory are under `docs/qa/s2h35/` on this branch.

## Next approved development step

1. Add a failing Windows path-contract test for a canonical local-drive path producing `\\?\...`.
2. Keep the canonical path for identity, containment, and bundle-file validation.
3. Derive a separate WebView2 mapping argument that is absolute but non-verbatim:
   - local drive: `\\?\C:\...` → `C:\...`
   - UNC: `\\?\UNC\server\share\...` → `\\server\share\...`
4. Do not weaken origin, generation, sequence, IPC, UDF, RendererSession, or cleanup checks.
5. Run the focused Rust tests and Windows compile/package checks.
6. Only after a new disposable artifact is verified, perform one approved Windows GUI run and require actual widget rendering plus RendererReady evidence.

Static success must not be reported as actual WebView2 runtime PASS.

## Repository/worktree inventory at handoff

Remote equality was checked against `git ls-remote --heads origin`. Except where noted, each listed worktree was clean, had no in-progress Git operation, and its HEAD matched its same-named remote branch.

| Branch | HEAD |
|---|---|
| `feature/desktop-surface-probe-9b1` | `160eec4e3082f7477e5c6a515f2979eed2f1f773` |
| `fix/desktop-surface-c2d2-cleanup-receipt` | `8cf151f4921d6479a522f82938fc49d89210e2dd` |
| `feature/desktop-surface-c2d2-renderer-session` | `1574e463f0c69a12507a726590971f334834bc44` |
| `feature/dashboard-mint-ivory-v2` | `b37c24740d3fbc436806d20d8411cdadf140e33f` |
| `feature/official-document-enhancement` | `344cf66d1839ddbadcf5f29b025c27922a1d509d` |
| `feature/education-video-finder` | `00e213eb30816f22ac7b51f5acd5abe9d13a4b99` |
| `integration/education-video-finder-f10` | `b452ed2ac0fed2d900677b494f5ab02afbf89bb8` |
| `integration/education-video-finder` | `5e157f0e62678cb68050fb3c46536a4732b5557f` |
| `feature/my-finance-2-redesign` | `dc6772c996cad0d8dbfba5f6f7afb505f817fdb8` |
| `docs/project-governance` | `db9aef64df73bc8cfe4d7dd91c75430b54951dbd` |
| `integration/desktop-design-review` | `1db93a701a74e0ddbe44f122ca91b10274cdf51b` |
| `feature/inventory-management` | `613837eabc37b8c4f9484ac3fec19607f84bc178` |
| `feature/newsletter-studio` | `1843c52c803949e586ef267502adf62d30cda5fc` |
| `feature/purchase-helper-enhancement` | `7263ef568fed3eea6da5dd108d8bc046bf926d34` |
| `integration/desktop-surface-s2` | remote `bffb5eff3fac9d92a3cf92b466afa73da45d492d` |
| `qa/desktop-surface-s2h20` | `bffb5eff3fac9d92a3cf92b466afa73da45d492d`; no same-named remote branch, but commit is preserved by `origin/integration/desktop-surface-s2` |
| `feature/desktop-surface-widget-ui` | `2c50e45b1d6704548b58d39d9be08cf482b5f990` |
| `codex/desktop-surface-c2c2-registration` | `160ced03ca5b45a52f663b979f31a4dee5944739` |
| `fix/my-finance-backup-size-limit` | `392b3dc0089eaa30de94ea886e8dd38e470be1dc` |
| `feature/my-finance-phase2` | `1b6a1383d93c649d448097991ffa2f86a467bde0` |
| `ci/my-finance-phase2-testable-controller` | `d332f6c36677cbba86ea385564647300594237fd` |
| `fix/my-finance-isolated-windows-qa` | `39b4834c2421c78fa6cb5a30d69bfa72a61a86f2` |
| `ci/my-finance-qa-diagnostic-entrypoint` | `799d01bbb311e6064422a8c6336006fe97cf1251` |
| `fix/my-finance-testable-publish-gate` | `e4453706f0a14f4fd92282e593e1375b4052ab24` |
| `feature/my-finance-ui-2` | `a1be5531c383aeb90dce110109bf45539df986a1` |
| `ci/v1-integrated-testable-controller` | `9779b4ea87ad11cb42a234ecdc9b29f1c638f550` |
| `fix/windows-clean-install-evidence-only` | `183fb6f0ff0375490af5367745b0f34324e3b4d7` |

Special local state that must not be cleaned automatically:

- An older `integration/desktop-surface-s2` worktree remains at local SHA `2d29064e5395dbcaf6717c9d3ed43570ba59e2a1`, behind its remote by 12 commits. Four files show `M`, but index and working-file blob hashes are equal; no content diff exists. It also contains generated `dist-surface-qa-main/`, `src-surface-protocol/target/`, and `src-tauri/permissions/autogenerated/` directories.
- The `qa/desktop-surface-s2h20` worktree contains the preserved untracked `dist-surface-qa-main/` bundle.
- No stash, Git lock, merge, rebase, cherry-pick, revert, bisect, staged change, or conflict was found.

Open PRs observed at handoff:

- PR #30, project governance: open, not draft; reported check SUCCESS.
- PR #29, Desktop Surface static workflow: not present in the current open-PR query and must not be assumed open.
- PR #26, MY FINANCE redesign: open draft; one isolated-Windows check is FAILURE while the other listed checks are SUCCESS.

## Local-only evidence

The complete temporary reproducer and selected fixture are preserved on the school PC under:

`%USERPROFILE%\Documents\BOGUNON_DESK-Handoffs\S2H35-bffb5ef-20261028`

That folder excludes build targets, UDFs, browser profiles, cookies, credentials, and operating data. It contains a SHA-256 manifest. A best-effort secret/PII scan found only source-code uses of the word `token`; no secret scanner was installed, so residual scanner risk remains documented.

## Safe restore on another PC

Inspect the destination PC before changing it:

```powershell
git -C <repo> status --short
git -C <repo> worktree list --porcelain
git -C <repo> branch -vv
git -C <repo> ls-remote --heads origin integration/desktop-surface-s2 codex/handoff-2026-10-28
```

Then fetch only the needed branches:

```powershell
git -C <repo> fetch origin integration/desktop-surface-s2 codex/handoff-2026-10-28
```

If no existing worktree owns the target branch, create a new worktree from the verified remote source without resetting another checkout:

```powershell
git -C <repo> worktree add -b fix/desktop-surface-webview-mapping <new-worktree-path> origin/integration/desktop-surface-s2
```

If that branch or worktree already exists, inspect and safely reuse it instead of overwriting it. Do not run unconditional reset, clean, stash, checkout, or pull commands.

## Validation status

- S-2H-35 root-cause toggle: PASS, reproduced twice per raw/canonical condition.
- Temporary reproducer `cargo fmt --check`, `cargo check --bins`, `cargo clippy --bins -- -D warnings`: PASS.
- Source fix: NOT IMPLEMENTED.
- Windows production compile after fix: NOT RUN.
- Actual six-widget WebView2 rendering after fix: NOT_VERIFIED.
- WorkerW attachment: NOT IMPLEMENTED / NOT RUN.
