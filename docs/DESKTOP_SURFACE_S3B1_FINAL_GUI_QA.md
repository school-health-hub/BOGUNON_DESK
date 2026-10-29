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
