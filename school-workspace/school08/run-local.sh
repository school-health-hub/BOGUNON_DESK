#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
D=(docker --host=unix:///var/run/docker.sock);NAME=bogunon-school08-pg
if "${D[@]}" inspect "$NAME" >/dev/null 2>&1;then echo 'Existing container: refusing' >&2;exit 1;fi
ID=$("${D[@]}" run -d --name "$NAME" --network none --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=256m -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=school01a postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3 -c listen_addresses='' -c log_statement=none -c log_min_error_statement=panic)
trap '"${D[@]}" rm -f "$ID" >/dev/null' EXIT
for ((i=0;i<120;i++));do if "${D[@]}" logs "$ID" 2>&1|rg -q 'init process complete'&&"${D[@]}" exec "$NAME" pg_isready -U postgres -d school01a >/dev/null 2>&1;then break;fi;sleep .25;done
for f in school-workspace/local/tests/auth_fixture.sql school-workspace/school06/tests/bootstrap.sql;do "${D[@]}" exec -i "$NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d school01a < "$f";done
python3 school-workspace/school08/tests/install.py
