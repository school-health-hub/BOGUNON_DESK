# SCHOOL WORKSPACE + TD2 B integration candidate

Candidate branch: `integration/school-workspace-td2-candidate`.
Base: `15b2c6d2e92d40da7614dadcdcbc1c984c2f2f88`.
No formal integration/main update, deployment, user data migration or Portable build/replacement.

## Selected source

- SCHOOL06/07/08 frozen packages and inventory integration: source `da1737589329b3c62647f926827839765adf12cd`, as preserved in Windows branch `838cc0b1a7dc50129aebda75cf18b73386ed9bf7`.
- Electron workspace purpose IPC/Preload/protocol, School04 Inventory entry and School05 provider/bridges/UI/Web API: selected files only, never full Main/Preload/P0App replacement.
- Idempotent awaited Workspace disposal and existing boundary regression from the validated Windows lineage; add the single quit-chain await to current Main.
- SCHOOL09D0 and H3 frozen installer/assertions plus only their pinned verifier dependencies: supported Auth, exact54 CLOSED, atomic recovery tests. No operating configuration or `.codex` connection copied.
- QA support selected from the same Windows lineage: native loopback PostgreSQL, external synthetic provider, actual Electron GUI controller. Candidate mode builds an unpackaged runtime only.

`school-td2-scope.mjs` rejects changes to TD2 B/CSS imports/QuickMemoSurface/P0App, Instructor subtree, all personal `src`, Rust/native sources and the lockfile against the base.

## Installation policy — two explicitly different test environments

1. SCHOOL08 cumulative installation is exercised only in a new loopback Windows PostgreSQL `school01a` database with synthetic Auth fixtures and explicit local capabilities. Verify54 CLOSED before local activation. The inherited Instructor SQL is a **separate local-only two-RPC extension**, added only to this synthetic DB. No production install claim.
2. SCHOOL09D0 is the preserved supported-Auth **fresh CLOSED review candidate**, exercised in a different isolated local PostgreSQL cluster. Verify original hashes, exact54 public/private pairs, restricted Auth boolean helpers, RLS/ACL, live revocation, atomic rollback and emergency closure. Its local fixtures are not Hosted Auth or HTTP/JWT signature verification.
3. D0 deliberately excludes Instructor two RPCs. Do not append the local Instructor SQL to an operating D0 install, change54 to56, remove its local guard or weaken the release fingerprint. A compatible CLOSED Instructor operating addon is **not approved/implemented here**. Hosted activation and actual accounts remain NOT RUN; operating installation remains blocked pending its own approvals and prerequisites.
4. Neither test path activates production Workspace. The existing packaged/production CLOSED gate and separate personal AccountService remain intact.

## New candidate validation

Use the existing `electron-cloud-g0.yml` manual entry on this candidate branch. Only the candidate Windows2025 job runs. No Docker, global installation, Rust rebuild, Portable packaging, or operating secrets.

- Build current SHA: Main/Preload/renderer, workspace strict/Web; verify metadata clean/source.
- Focused lifecycle/boundary, Inventory, Instructor contracts/XLSX/UI and TD2 tests; real native PG tests are separate from jsdom/Mock.
- Real Windows Electron GUI: production disabled state, synthetic teacher/assistant/pending/admin, tasks/events/handovers/Inventory, school switch, logout, DPAPI, offline personal data and normal process cleanup.
- Instructor: real purpose IPC + local DB seed, original attendance preview19/31 rows, actual Electron PDF1/2 pages, stamps default OFF; original Main worker XLSX wages/media regression. Physical print/native save dialog/Excel application remain NOT RUN.
- TD2: existing default/custom layout and restart, unforced Home clicks with memo open at100/125/150, small/maximized windows. OS DPI125/150 and meal-ready binding remain NOT RUN.
- Evidence contains synthetic PNG/PDF/XLSX and JSON summaries, source SHA and SHA256SUMS. Never upload profiles/DB files/vaults.

Historical PASS is not relabeled as this source's PASS. The Actions evidence is authoritative for the final candidate result.
