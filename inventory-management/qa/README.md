# Inventory Management local QA

This directory is an isolated, synthetic-only preparation surface for IM-1B.

## Safety boundary

- Project ID: `inventory_qa`
- API: `http://127.0.0.1:56321`
- Database: `127.0.0.1:56322`
- Studio: `http://127.0.0.1:56323`
- Mail UI: `http://127.0.0.1:56324`
- Analytics: `127.0.0.1:56327`
- No remote project link, production URL, production key, dump, or real school data is allowed.
- The existing `bogunon` local stack and its 5432x ports, network, and volumes are out of scope.

The PREP baseline database was intentionally empty. IM-1B-1 adds tenancy, IM-1B-2 adds ledger/audit/idempotency, IM-1B-3 adds FEFO use, and IM-1B-4 adds teacher-only receive, dispose, adjustment, and latest-movement reversal RPCs.

## Commands

```powershell
./scripts/Test-Prep.ps1
./scripts/Invoke-LocalSupabase.ps1 start
./scripts/Invoke-LocalSupabase.ps1 status
./scripts/Test-Prep.ps1 -RequireRunning
./scripts/Invoke-IM1B1Tests.ps1
./scripts/Invoke-IM1B2Tests.ps1
./scripts/Invoke-IM1B3Tests.ps1
./scripts/Invoke-IM1B3HttpE2E.ps1
```

`Invoke-LocalSupabase.ps1 stop` stops only the `inventory_qa` stack. It does not remove volumes or reset data.

The contract manifest contains every unique Test ID from the committed IM-1A QA contract. Although earlier prose says 33 tests, the source document contains 34 unique IDs; none were discarded.

The IM-1B-1 suite uses real PostgreSQL roles (`authenticated`, `anon`) and local `request.jwt.claims` so `auth.uid()` and RLS execute inside PostgreSQL. It does not claim a browser JWT session; the anonymous Data API denial is checked separately against the live local gateway.

The original 34 contracts remain in `contracts/qa-contracts.json`. The 17 IM-1B-2 schema, RLS, and transaction-foundation checks use separate IDs in `contracts/IM-1B-2-contracts.json`; they do not replace or renumber the original contracts.

IM-1B-3 adds 20 sequential and 4 real multi-session concurrency checks in `contracts/IM-1B-3-contracts.json`. The HTTP E2E script creates only a reserved `.invalid` local Auth identity, obtains its token without logging it, and calls the live local REST RPC endpoint.


