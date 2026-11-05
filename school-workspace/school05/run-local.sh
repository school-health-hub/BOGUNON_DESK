#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
DOCKER=(docker --host=unix:///var/run/docker.sock)
CONTAINER=bogunon-school05-pg
IMAGE='postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
if "${DOCKER[@]}" inspect "$CONTAINER" >/dev/null 2>&1;then echo 'Refusing an existing container' >&2;exit 1;fi
"${DOCKER[@]}" pull "$IMAGE"
ID=$("${DOCKER[@]}" run -d --name "$CONTAINER" --network none --label bogunon.scope=school05-local --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=256m -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=school01a "$IMAGE" -c listen_addresses='' -c log_statement=none -c log_min_error_statement=panic -c log_error_verbosity=terse)
trap '"${DOCKER[@]}" rm -f "$ID" >/dev/null' EXIT
ready=no
for ((i=0;i<120;i++));do if "${DOCKER[@]}" logs "$ID" 2>&1|rg -q 'init process complete'&&"${DOCKER[@]}" exec "$CONTAINER" pg_isready -U postgres -d school01a >/dev/null 2>&1;then ready=yes;break;fi;sleep .25;done
[[ "$ready" == yes ]]||exit 1
mkdir -p school-workspace/school05/evidence
for file in school-workspace/local/tests/auth_fixture.sql school-workspace/local/supabase/migrations/*.sql school-workspace/integration/sql/local-status.sql school-workspace/school02/sql/extension.sql school-workspace/school03/sql/extension.sql school-workspace/school04/sql/extension.sql school-workspace/instructors/sql/candidate.sql;do "${DOCKER[@]}" exec -i "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d school01a < "$file";done > school-workspace/school05/evidence/db-apply.log
"${DOCKER[@]}" inspect "$CONTAINER" --format '{{json .HostConfig.NetworkMode}} {{json .HostConfig.PortBindings}}' > school-workspace/school05/evidence/db-isolation.txt
node node_modules/vitest/vitest.mjs run --config school-workspace/school05/vitest.config.ts --reporter=verbose --reporter=json --outputFile=school-workspace/school05/evidence/new-tests.json > school-workspace/school05/evidence/new-tests.log 2>&1
if [[ "${SCHOOL05_REGRESSION:-0}" == 1 ]];then
 for stage in school04 school03 school02;do
  TARGET="bogunon-${stage}-pg";if "${DOCKER[@]}" inspect "$TARGET" >/dev/null 2>&1;then echo 'Regression name already used' >&2;exit 1;fi
  "${DOCKER[@]}" rename "$ID" "$TARGET"
  node node_modules/vitest/vitest.mjs run --config "school-workspace/$stage/vitest.config.ts" --reporter=verbose --reporter=json --outputFile="school-workspace/school05/evidence/$stage-regression.json" > "school-workspace/school05/evidence/$stage-regression.log" 2>&1
  "${DOCKER[@]}" rename "$ID" "$CONTAINER"
 done
fi
if [[ "${SCHOOL05_BROWSER:-0}" == 1 ]];then
 for f in school-workspace/local/tests/fixtures.sql school-workspace/integration/sql/multi-school-fixture.sql school-workspace/school02/sql/fixtures.sql school-workspace/school03/sql/fixtures.sql;do "${DOCKER[@]}" exec -i "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d school01a < "$f";done > school-workspace/school05/evidence/browser-fixtures.log
 bash school-workspace/school05/run-browser.sh
fi
