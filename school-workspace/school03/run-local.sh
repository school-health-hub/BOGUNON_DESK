#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
DOCKER=(docker --host=unix:///var/run/docker.sock)
CONTAINER=bogunon-school03-pg
IMAGE='postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
if "${DOCKER[@]}" inspect "$CONTAINER" >/dev/null 2>&1;then echo 'Refusing an existing container' >&2;exit 1;fi
"${DOCKER[@]}" pull "$IMAGE"
ID=$("${DOCKER[@]}" run -d --name "$CONTAINER" --network none --label bogunon.scope=school03-local --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=256m -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=school01a "$IMAGE" -c listen_addresses='' -c log_statement=none -c log_min_error_statement=panic -c log_error_verbosity=terse)
trap '"${DOCKER[@]}" rm -f "$ID" >/dev/null' EXIT
ready=no
for ((i=0;i<120;i++));do if "${DOCKER[@]}" logs "$ID" 2>&1 | rg -q 'init process complete' && "${DOCKER[@]}" exec "$CONTAINER" pg_isready -U postgres -d school01a >/dev/null 2>&1;then ready=yes;break;fi;sleep .25;done
[[ "$ready" == yes ]] || { echo "Local DB readiness failed" >&2;exit 1; }
mkdir -p school-workspace/school03/evidence
for file in school-workspace/local/tests/auth_fixture.sql school-workspace/local/supabase/migrations/*.sql school-workspace/integration/sql/local-status.sql school-workspace/school02/sql/extension.sql school-workspace/school03/sql/extension.sql;do
 "${DOCKER[@]}" exec -i "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d school01a < "$file"
done > school-workspace/school03/evidence/db-apply.log
"${DOCKER[@]}" inspect "$CONTAINER" --format '{{json .HostConfig.NetworkMode}} {{json .HostConfig.PortBindings}}' > school-workspace/school03/evidence/db-isolation.txt
node node_modules/vitest/vitest.mjs run --config school-workspace/school03/vitest.config.ts --reporter=verbose --reporter=json --outputFile=school-workspace/school03/evidence/integration-tests.json > school-workspace/school03/evidence/integration-tests.log 2>&1
cat school-workspace/school03/evidence/integration-tests.log
"${DOCKER[@]}" exec -i "$CONTAINER" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d school01a < school-workspace/school03/sql/catalog.sql > school-workspace/school03/evidence/catalog.json

if [[ "${SCHOOL03_BROWSER:-0}" == 1 ]];then
 for file in school-workspace/local/tests/fixtures.sql school-workspace/integration/sql/multi-school-fixture.sql school-workspace/school02/sql/fixtures.sql school-workspace/school03/sql/fixtures.sql;do
  "${DOCKER[@]}" exec -i "$CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d school01a < "$file"
 done > school-workspace/school03/evidence/browser-fixture-reset.log 2>&1
 bash school-workspace/school03/run-browser.sh
fi
