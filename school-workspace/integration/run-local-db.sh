#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
DOCKER=(docker --host=unix:///var/run/docker.sock)
CONTAINER=bogunon-school01c-pg
IMAGE='postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
if "${DOCKER[@]}" inspect "$CONTAINER" >/dev/null 2>&1;then echo 'Refusing an existing container' >&2;exit 1;fi
"${DOCKER[@]}" pull "$IMAGE"
ID=$("${DOCKER[@]}" run -d --name "$CONTAINER" --network none --label bogunon.scope=school01c-local --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=256m -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=school01a "$IMAGE" -c listen_addresses='' -c log_statement=none)
trap '"${DOCKER[@]}" rm -f "$ID" >/dev/null' EXIT
for ((i=0;i<120;i++));do if "${DOCKER[@]}" exec "$CONTAINER" pg_isready -U postgres -d school01a >/dev/null 2>&1;then break;fi;sleep .25;done
mkdir -p school-workspace/integration/evidence
for file in school-workspace/local/tests/auth_fixture.sql school-workspace/local/supabase/migrations/*.sql school-workspace/integration/sql/local-status.sql;do
 "${DOCKER[@]}" exec -i "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d school01a < "$file"
done > school-workspace/integration/evidence/db-apply.log
"${DOCKER[@]}" inspect "$CONTAINER" --format '{{json .HostConfig.NetworkMode}} {{json .HostConfig.PortBindings}}' > school-workspace/integration/evidence/db-isolation.txt
node node_modules/vitest/vitest.mjs run --config school-workspace/integration/vitest.config.ts --reporter=verbose --reporter=json --outputFile=school-workspace/integration/evidence/integration-tests.json > school-workspace/integration/evidence/integration-tests.log 2>&1
cat school-workspace/integration/evidence/integration-tests.log
