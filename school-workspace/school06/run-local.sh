#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
DOCKER=(docker --host=unix:///var/run/docker.sock)
NAME=bogunon-school06-pg
IMAGE='postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
if "${DOCKER[@]}" inspect "$NAME" >/dev/null 2>&1;then echo 'Existing container: refusing' >&2;exit 1;fi
"${DOCKER[@]}" pull "$IMAGE" >/dev/null
ID=$("${DOCKER[@]}" run -d --name "$NAME" --network none --label bogunon.scope=school06-local --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=256m -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=school01a "$IMAGE" -c listen_addresses='' -c log_statement=none -c log_min_error_statement=panic -c log_error_verbosity=terse)
trap '"${DOCKER[@]}" rm -f "$ID" >/dev/null' EXIT
ready=no
for ((i=0;i<120;i++));do if "${DOCKER[@]}" logs "$ID" 2>&1|rg -q 'init process complete'&&"${DOCKER[@]}" exec "$NAME" pg_isready -U postgres -d school01a >/dev/null 2>&1;then ready=yes;break;fi;sleep .25;done
[[ "$ready" == yes ]]||exit 1
mkdir -p school-workspace/school06/evidence
"${DOCKER[@]}" inspect "$NAME" --format '{{json .HostConfig.NetworkMode}} {{json .HostConfig.PortBindings}}' > school-workspace/school06/evidence/isolation.txt
for f in school-workspace/local/tests/auth_fixture.sql school-workspace/school06/tests/bootstrap.sql;do "${DOCKER[@]}" exec -i "$NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d school01a < "$f";done > school-workspace/school06/evidence/bootstrap.log
python3 school-workspace/school06/tests/run.py
