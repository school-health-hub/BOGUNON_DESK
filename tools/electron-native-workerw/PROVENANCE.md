# WorkerW boundary provenance

The following files are byte-preserved copies, not a merge of a historical feature branch:

- `src/legacy/{model,machine,mock,tests,identity_tests,observation,observation_reader,read_only_process,read_only_topology,read_only_windows,worker_evidence,topology_evidence}.rs`: commit `c67f5bf1338b3f41c48c17d58ea57d956b48a82a`, `src-tauri/src/desktop_surface/lifecycle/`.
- `src/lifecycle.rs` and the ownership state transitions in `src/ownership.rs`: commit `e4dfcbf7b987039b093d3d1dbb8bed69a3bfcc6e`, `src-surface-host/src/`.

Only new module assembly, admission, write planning and Windows adapter files are formatted or extended. Original Tauri/S-3 sources are unchanged. Historical modules contain unused entry points and test-only unwrap/panic calls: their bytes are retained rather than broadly cleaning them up. `allow(dead_code)` is restricted to these private historical module trees (apart from the memory-backed DryRun facade); library Clippy remains enabled for all other diagnostics.

The copied 9B model's `main` field means the **Native Host-owned Surface window** in this crate. It never authorizes reparenting the privileged Electron Main window. The real query implementation requires the current Host PID/creator thread, full process identity and an owned-window generation tag.

This crate exposes no public live activation API. NATIVE-05A adds a headless query-only binary; it cannot attach. NATIVE-04B adds a public memory-backed DryRun facade consumed by a separate headless channel Host. The `windows-adapter-skip-miri` feature only makes private FFI code available for compile review; it does not connect a live Host route or issue an execution permit. Default tests use mocks and pure write plans only. Do not execute a desktop experiment based on this checkpoint.

Full cleanup receipts remain the existing S-3/NATIVE-01 authority. A restored parent, closed Host process, released registration lease or successful Win32 return is not a full Native cleanup receipt. The new TypeScript contracts reuse the existing ledger to issue/consume **contract-only** receipts using synthetic runtime/browser evidence; no Windows receipt is synthesized here.

NATIVE-05A adds one query-only `Ledger::reservation_matches` method to the local ownership copy. Original S-3 transitions, lease identity, Drop/quarantine behavior and original source worktrees remain unchanged. Other listed historical files remain byte-preserved. The new read-only feature does not enable the private NativeAdapter/write modules.
