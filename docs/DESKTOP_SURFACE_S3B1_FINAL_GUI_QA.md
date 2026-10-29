# S-3B-1 bounded final GUI QA

Implementation and CI results do not prove actual Windows GUI behavior. Execute only after separate approval of the exact portable artifact, source SHA and EXE hashes. Preserve existing QA profiles, backups, diagnostics and UDF directories. Do not run WorkerW or access operating data.

## Single-session budget

The Host interaction deadline is 300 seconds from Surface display, not from the first edit click. Do not spend the deadline on repeated uncertain pointer attempts. Use the actual SE handle, verify the start observation, release the pointer, then verify the stop observation and integer grid dimensions. Missing observations are NOT_VERIFIED, not PASS.

| Time after display | Action and required observation |
|---|---|
| 0–30 s | Six widgets, RendererReady, begin edit |
| 30–75 s | One unobstructed SE resize by one grid row; start/stop observation; complete and retain size |
| 75–120 s | Reenter edit, drag calendar, press Escape while drag is active; release pointer |
| 120–150 s | Compare baseline position, dimensions and visibility; no residual placeholder; inspect Main idle immediately |
| 150–180 s | Quick Launcher restores QA Main; observe Host shutdown |
| 180–240 s | Close QA Main normally; collect CleanupReceipt and process inventory |
| 240–300 s | Reserved for bounded shutdown and evidence collection; no new edit case |

Resize-in-progress Escape is a focused automated regression requirement. If repeated in GUI, substitute it for the drag case within the same budget; do not add another launch without approval. Record what was actually exercised.

## Acceptance and evidence

- Bind source SHA, CI run/attempt, manifest and binary hashes before launch.
- Capture resize start/stop and before/after grid units, completed layout, Escape baseline restoration and Main idle state. Record fixed codes and synthetic widget geometry only; no URL, token, user path or profile contents.
- A timeout remains a failed interaction even when owned-resource cleanup obtains a receipt. Record the timeout and cleanup result separately. A receipt is never inferred from absent processes.
- The cleanup deadline bounds application-controlled waits and admission of further stages. Synchronous Windows COM calls and filesystem operations cannot be preempted by that deadline. External termination or a blocked OS call can still leave cleanup unknown; no hard wall-clock cleanup guarantee is claimed.
- Missing receipt, unknown cleanup, incomplete observations or unverified rollback prevent full S-3B-1 PASS. Preserve residual QA storage; never delete old QA data to make the result appear clean.
- No actual GUI execution is included in the implementation/CI preparation step.

## Completed acceptance — 2026-10-30 (Asia/Seoul)

**S-3B-1 final Windows GUI verdict: PASS.** This section records the subsequently approved GUI sessions; the preparation-only statement above describes the earlier implementation step.

- Validated source: `36c6b13eb694318a015656d42f40488e395214c5`. A later documentation checkpoint does not change the validated binary source.
- Windows CI: [40892740111](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/40892740111), attempt 1, completed/success; artifact `12906674253`.
- ZIP SHA-256: `0f3b09927bd0ad77645b9101d8c108a109bb5807559038ed6d62fa38ef62aad1`.
- Manifest SHA-256: `d05616f6af35db845f5909ca372744773117d3f293d059f410ba8945fc419cf0`.
- Main EXE SHA-256: `2bafedcce65b56b4d25209ebe2dd1b96ea0562e218787677a76ddd173c6d66db`.
- Host EXE SHA-256: `c753618fd17c097d7bc887c78cf92d548d1cb1c5d5130ceb43afde62d0d17401`.
- Both executables are unsigned. All 16 payload hashes matched the manifest.

| Acceptance | Evidence and result |
|---|---|
| Drag, Resize, completion retention | Actual automated GUI observations PASS; calendar changed from grid 6×6 to 6×7 and retained size after completion |
| Held-button Drag followed by Escape | PASS, explicitly confirmed by the user during a separately approved manual session |
| Baseline position, size, visibility; placeholder removal | Automated GUI restoration plus final manual confirmation PASS |
| Main edit-state synchronization | Immediate automated Main observation and final manual confirmation PASS |
| Quick Launcher | Actual automated QA Main restoration PASS |
| Normal cleanup | Final manual-session Host diagnostic: outcome `success`, failureCode null, cleanupStatus `receipt` |
| Cleanup stages | Window close request, RendererSession cleanup, controller close, window destruction, BrowserProcessExited observation, event unsubscribe, cleanup evaluation and owned current-run UDF removal completed |
| Remaining processes | QA Main, Host and QA WebView2: 0 at post-exit inspection |
| Existing QA backup integrity | 316-file automated-session backup and 317-file manual-session backup: zero hash mismatches on closure inspection |

The manual Escape also stopped the Computer Use helper. No post-Escape screenshot was obtained for that manual session; its input/result evidence is the user's explicit confirmation, not an automated observation. Final cleanup was then verified using read-only diagnostics and process enumeration. The Main diagnostic is startup-only and still says `running`; it is not used as proof of process liveness or successful cleanup.

### Evidence inventory and preservation

The following is a **local home-PC evidence root only**, not a portable path or a claim that it exists on another PC:

`E:\BOGUNON-S3B1-FINAL-FIX-QA-40892740111`

| Relative record | SHA-256 |
|---|---|
| `S3B1-FINAL-GUI-PASS.md` | `e0005098081bc0c2de8f89e07f04ea3cf828c1b77c23acf92f3032c4ad8e62b5` |
| `S3B1-GUI-RESULT.md` | `0dff08a6a6ffa0e88b05f314e3ffc454ad08dac2b58d5cfca664ba3416746abf` |
| `VERIFICATION.json` | `d4b4193efe11d1bad30a8d35bb04a46beebd3799aea2c999ce84c9945d13114d` |
| `manual-evidence/FINAL-RESULT.json` | `9a7d2904e5ead2a4ab0fe64d4fa0f48503de794c5fa5e1eddbcf78dcd433b29b` |
| `manual-evidence/after-bogunon-desktop-surface-qa-diagnostic.json` | `6a6acc5b2535d392218427a4682d1ded18275899df7a8346312612dcf135c2f1` |

`S3B1-GUI-RESULT.md` preserves the earlier PARTIAL verdict; the later final record resolves its remaining manual condition. `VERIFICATION.json` remains the original pre-GUI package verification, not a rewritten final GUI result.

Preserved dependencies include `artifact.zip`, `package/ARTIFACT-MANIFEST.json`, `package/SHA256SUMS.txt`, every manifest payload, `gui-evidence/` screenshots and diagnostics, `GUI-EVIDENCE-SHA256.json`, `manual-evidence/` diagnostics and its `EVIDENCE-SHA256.json`, and both profile backups with their pre-run hash inventories. These files were not modified by this documentation closure. Existing old UDF directories were not deleted. Do not automatically transfer browser profiles, UDFs, raw logs or screenshots; one captured window was occluded by other desktop content and needs review before sharing.

The binary artifact is remotely available subject to GitHub retention; the original GUI evidence and profile backups are local-only. A full cross-PC evidence handoff is **PARTIAL**, not HANDOFF READY: no approved transfer or receiving-PC restoration of those local dependencies has been verified. Source and this completion summary can be preserved in Git independently. No extra copy package is required for resuming on this same home PC.

Only this non-sensitive completion document is intended for Git. A dedicated secret scanner was unavailable; scoped pattern and content inspection is best-effort. No profile contents, credentials, operating Finance data or raw runtime logs are included. Operating-data byte comparison was not performed and is not claimed by this PASS.

### S-3B-2 handoff — not implemented

- S-3B-1 session editing is complete. Main owns permanent settings; Renderer owns draft editing; Host owns Windows resources and authenticated IPC.
- Persist only a successfully completed layout. Escape/cancel must leave permanent settings unchanged. Keep existing Main caller/lifetime Guard, ACL, generation, attempt, capability and sequence boundaries.
- Start by inspecting `src-tauri/src/surface_runtime.rs`, `src-tauri/src/surface_edit_feedback.rs`, `src-surface/SurfaceApp.tsx`, `src-surface/layout.ts`, and `src-surface-host/src/edit_control.rs`, plus their existing tests. Do not reinterpret the current synthetic/session storage adapter as production permanent persistence.
- Reuse checked-in `package-lock.json` and Cargo lockfiles. The validated CI used Node 22.23.4, Rust 1.99.1 MSVC and windows-2022. Receiving-PC prerequisites must be checked locally before any new test or build.
- Non-destructive resume checks: `git status --short`, `git rev-parse HEAD`, `git rev-list --left-right --count HEAD...origin/integration/desktop-surface-s2`, and `git show 36c6b13:docs/DESKTOP_SURFACE_S3B1_FINAL_GUI_QA.md`. After future implementation approval, focused commands are `node node_modules/vitest/vitest.mjs run --config vitest.surface.config.ts --maxWorkers=1`, the corresponding `vitest.surface-qa.config.ts` suite, and `cargo test --locked --manifest-path src-surface-host/Cargo.toml --lib`; none were rerun for this closure.
- No S-3B-2 code, WorkerW, permanent production storage, real-data connection, main merge, release or deployment is authorized by this completion record.

This documentation-only checkpoint uses `[skip ci]` because this branch's existing push workflow would otherwise rebuild. It adds no new build/GUI validation claim.
