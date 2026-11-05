SCHOOL-03 shared operational tasks — LOCAL ONLY implementation
Base: 166df05dd45402cb1a7526c9ae824ec11fcdb579
Branch: feature/school-03-shared-tasks. Uncommitted; never deploy this harness.

Restore into a separate exact product base using package root RESTORE_INTO_REPO.py.
From repository root:
 npm ci --ignore-scripts --no-audit --no-fund
 node node_modules/typescript/bin/tsc -p school-workspace/school03/tsconfig.json
 SCHOOL03_BROWSER=1 bash school-workspace/school03/run-local.sh
Dependencies: Node22+, npm, Python3, Bash, local Docker Unix socket, ripgrep,
OpenSSL, Chromium. Default /usr/bin/chromium; SCHOOL03_CHROMIUM may override.
The runner creates only its own pinned PG17.6 network-none/tmpfs/no-port container,
applies original A + C + 02 and additive03 SQL, runs tests/catalog, resets synthetic
fixtures, builds a static UI, starts HTTPS on127.0.0.1:5193, runs Chromium, then removes
its own server/container/temp TLS keys. Existing container causes refusal.
Without SCHOOL03_BROWSER it runs DB/React/MOCK tests only. No remote DB URL accepted.

Regression from the SAME restored code:
 SCHOOL02_BROWSER=1 bash school-workspace/school02/run-local.sh
 node node_modules/vitest/vitest.mjs run --config school-workspace/auth/vitest.config.ts
 npm run electron:p0:build
Existing selected regression command is recorded in evidence/commands.json.
Root npm run build fails13 unchanged baseline errors. No npm lint/typecheck scripts
exist; explicit strict tsc is the source-scope check. No Portable is built.

Architecture: actual B Main/BFF auth classes -> C coordinator/02 enrollment controller
-> task controller ->8 task RPCs -> nonowner NOBYPASSRLS runtime/reader -> real local
RLS/FK/version/receipt/history/audit. Auth provider, JWT gateway and Windows cipher
are MOCK. Windows real DPAPI/OS callback/application runtime are NOT RUN.
Task UI/Main integration is real React+DB in jsdom with mock IPC events and sender
checks. Desktop980x700 Chromium is the BFF path, not Windows Electron.
SCHOOL-02 default behavior is preserved via optional DB/sql/origin injection seams;
its enrollment suite and browser flows were rerun. No existing personal tools change.

Product entry: DEV + ELECTRON_P0_PUBLIC_SCHOOL03_LOCAL=1. Optional window.school02
and window.school03Tasks must come from an isolated local Main harness using existing
school02/server/ipc.ts and school03/server/ipc.ts. Production Main/Preload do not
register synthetic auth or Docker DB access. Without bridges actions are disabled.
Original Dashboard/Dock remains intact. Production renderer excludes the03 dev UI.

RPCs: ws_v1_list_tasks/get_task/create_task/edit_task/assign_task/
change_assigned_task_status/close_task/list_task_history. All writes require request_id;
all existing-object writes require expected_version. Client actor/time/epoch is never
accepted. Creation assigns multiple members atomically; body edit and reassignment
are separate explicit versioned commands. Last editor metadata is derived by trigger.
Assistant status only TODO->IN_PROGRESS->DONE, current valid assignment epoch only.
No hard delete; teachers/admins may archive. History stores structural action/version/
actor/status metadata, never title/body snapshots. Receipts store SHA256 payload only.
Live membership, account/session and individual task.read denial override UI cache.
All tables private/FORCE RLS; no client table grants. Eight public wrappers INVOKER;
private entry functions run as limited nonowner runtime, metadata readers as reader.

Privacy: title100 characters, description400 and at most3 newlines, no attachments.
Conservative keyword/contact/credential checks plus UI guidance/confirmation are NOT
complete sensitive-data detection. False positives and unmarked-name false negatives
remain possible. Rejected text returns a safe structured error before any persistence.
No AI/log/audit/history/receipt receives rejected text. Runner suppresses error SQL
statement logging; tests verify synthetic blocked text is absent from Docker logs.
Operational host request/DB logging requires independent review before deployment.

Sync: explicit refresh + window focus/online/visibility refresh, server reread after
successful writes. No Realtime channel/publication changes. Offline writes disabled,
no automatic queue/replay. An ambiguous retry can reuse the one in-memory request id;
no disk/shared-data cache. School/epoch keyed views, generation invalidation and expected
school guards discard stale/cross-tab scope responses. Editor retains draft/version
through background reads; conflicts require explicit review/reload, no silent overwrite.
Lists/history capped100, assignments10. Members are minimal school codes/IDs/roles.
Assistants initially see MINE; ALL remains an explicit read option. Due dates are calendar dates; TODAY uses Asia/Seoul and excludes done/cancelled.

Hosted Supabase Auth/providers/redirect/JWT/PostgREST/auth.sessions grants, operational
first-admin verification, real Windows/Electron mounting, backup/retention and full
privacy controls are NOT VERIFIED. No real school/user/student records used.
SCHOOL-04 may begin isolated work, not production deployment.
