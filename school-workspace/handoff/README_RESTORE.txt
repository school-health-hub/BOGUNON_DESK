SCHOOL-01A result preservation / SCHOOL-01B handoff

Status: CONDITIONAL accepted. 34 PASS / 0 FAIL applies ONLY to PostgreSQL 17.6
with synthetic Auth fixtures. It is not a hosted Supabase compatibility PASS.

Package-relative layout:
  school-workspace/local/supabase/migrations/  exact original SQL
  school-workspace/local/tests/               exact original test sources
  school-workspace/local/evidence/            exact original run logs/catalog/hashes
  school-workspace/local/SCHOOL_01A_RESULT.txt original final report
  school-workspace/local/run.sh               local-only reproducible execution
  school-workspace/handoff/                   new preservation and audit entry docs
  MANIFEST_SHA256.json                        hashes of every payload file
  VERIFY_PACKAGE.py                          verify hashes before execution

Restore without a Git repository:
1. Extract the ZIP into a NEW empty folder. Do not overlay existing product data.
2. Change into that extracted folder (it contains school-workspace/).
3. Run: python3 VERIFY_PACKAGE.py
4. Review: school-workspace/local/README.txt and SCHOOL_01A_RESULT.txt.
5. To reproduce DB tests, when explicitly desired:
     bash school-workspace/local/run.sh
   Docker local daemon, Python3 and Bash are required. Internet is needed only to
   pull the digest-pinned public PostgreSQL image if not already cached.
   The DB has no external network or host port, uses tmpfs and is removed after
   execution. No remote DB URL/key is accepted. Existing same-name containers are
   not reused or silently deleted. It overwrites local evidence with a NEW run;
   keep the original extracted evidence or use a separate second extraction.

Restore over the correct source checkout (optional, no automatic Git commands):
- Obtain school-health-hub/BOGUNON_DESK at exact commit
  38b45c2a762224f0af976026519b3d47463e4454 in a separate clean checkout.
- Create a separate feature branch by normal local procedure if needed.
- Copy ONLY this package's school-workspace/ subtree to that checkout.
- No runtime depends on the old cloud workspace's absolute path. Historical
  reports/manifests retain original paths only as provenance, not required paths.
- Do not rebase/reset/merge or apply this SQL to hosted Supabase automatically.

Original Git context:
  feature/school-01a-local-rls
  HEAD 38b45c2a762224f0af976026519b3d47463e4454
  predecessor af52921c96b9b24b5dd5f49cc133471e634d2420
  source commit: fix(electron): preserve Finder and window services across tray hide
Source/tracked product files have no uncommitted changes. All prototype files are
untracked; commit/push/PR/merge/deploy remain unapproved and were not performed.

Preservation notes:
- Original 21-file ZIP passed CRC, manifest hash and byte-for-byte source checks.
- The two *.log evidence files are ignored by the source repository's inherited
  ignore rules. They are intentionally included here and MUST NOT be lost during
  a later approved Git preservation step. No ignore rule or index was changed now.
- __pycache__, .git, npm cache, node_modules, credentials, .env and actual users'
  data are excluded. supabase/.temp/cli-latest is just the public CLI version;
  retained to preserve all original 21 entries, not needed to execute tests.
- Synthetic user IDs/claims are explicit test fixtures, not real login credentials.
- pre_fix_results.json records 33 PASS / 1 FAIL before the bootstrap RLS fix.
  The final fresh-container run is evidence/results.json (34 PASS / 0 FAIL).

Fresh DB evidence already preserved:
- run.sh refuses an existing container and creates a new tmpfs DB, applies Auth
  fixture then migration, executes tests, captures catalog, and removes its DB.
- image-digest.txt, isolation.txt, auth-fixture-apply.log, migration-apply.log,
  test-output.txt, results.json, catalog.json and their hashes support that run.
- This is reproducibility/recorded evidence, not an independent signed attestation.
  A before-schema catalog snapshot/container ID was not captured in that run;
  none is invented now. No new DB tests were run just to repackage the results.

SCHOOL-01B entry condition:
- Read SCHOOL_01B_READONLY_SCOPE.txt.
- Only project xxownwxxajzrviuvvfiu is a permitted hosted audit target.
- Current connector still returns permission denied for a minimal read.
- Do not substitute another project. Prepare the audit now; hosted execution
  requires legitimate read access. Do not change Auth settings or apply migration.
