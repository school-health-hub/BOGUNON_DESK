#!/usr/bin/env bash
# Called only by run-local.sh while its isolated synthetic DB is alive.
set -euo pipefail
node node_modules/typescript/bin/tsc -p school-workspace/school02/build.tsconfig.json
node node_modules/vite/bin/vite.js build --config school-workspace/school02/vite.config.ts > school-workspace/school02/evidence/ui-build.log 2>&1
TLS_DIR=$(mktemp -d /tmp/bogunon-school02-tls.XXXXXX)
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$TLS_DIR/key.pem" -out "$TLS_DIR/cert.pem" -days 1 -subj '/CN=localhost' >/dev/null 2>&1
SCHOOL02_KEY="$TLS_DIR/key.pem" SCHOOL02_CERT="$TLS_DIR/cert.pem" node build/school02-local/school-workspace/school02/server/local-server.js > school-workspace/school02/evidence/local-server.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true; rm -rf "$TLS_DIR"' EXIT
# Wait for the explicit ready marker; no insecure curl or remote endpoint is used.
for ((i=0;i<120;i++));do if rg -q 'listening on loopback' school-workspace/school02/evidence/local-server.log;then break;fi;sleep .25;done
node school-workspace/school02/browser-check.mjs > school-workspace/school02/evidence/browser-check.log 2>&1
cat school-workspace/school02/evidence/browser-check.log
