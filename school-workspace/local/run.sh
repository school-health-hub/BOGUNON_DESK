#!/usr/bin/env bash
# Reproducible local-only PostgreSQL harness. No remote DB URL accepted.
set -euo pipefail
cd "$(dirname "$0")"
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
DOCKER=(docker --host=unix:///var/run/docker.sock)
CONTAINER=bogunon-school01a-pg
IMAGE='postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
if "${DOCKER[@]}" inspect "$CONTAINER" >/dev/null 2>&1; then
  echo 'Refusing to reuse or delete an existing container; inspect school01a-local label first.' >&2
  exit 1
fi
"${DOCKER[@]}" pull "$IMAGE"
CREATED_ID=$("${DOCKER[@]}" run --detach --name "$CONTAINER" --network none --label bogunon.scope=school01a-local \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=256m \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=school01a "$IMAGE" -c listen_addresses='' -c log_statement=none)
trap '"${DOCKER[@]}" rm --force "$CREATED_ID" >/dev/null' EXIT
ready=no
for ((i=0;i<120;i++)); do
  if "${DOCKER[@]}" exec "$CONTAINER" pg_isready -U postgres -d school01a >/dev/null 2>&1; then ready=yes; break; fi
  sleep .25
done
[[ "$ready" == yes ]] || { echo 'Local PostgreSQL did not start' >&2; exit 1; }
mkdir -p evidence
"${DOCKER[@]}" inspect "$CONTAINER" --format '{{json .HostConfig.NetworkMode}} {{json .HostConfig.PortBindings}}' > evidence/isolation.txt
"${DOCKER[@]}" image inspect "$IMAGE" --format '{{json .RepoDigests}}' > evidence/image-digest.txt
"${DOCKER[@]}" exec -i "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d school01a < tests/auth_fixture.sql > evidence/auth-fixture-apply.log
for sql_file in supabase/migrations/*.sql; do
  "${DOCKER[@]}" exec -i "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d school01a < "$sql_file" > evidence/migration-apply.log
done
python3 tests/run.py | tee evidence/test-output.txt
"${DOCKER[@]}" exec -i "$CONTAINER" psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d school01a < tests/catalog.sql > evidence/catalog.json
python3 tests/static_check.py | tee evidence/static-check.txt
