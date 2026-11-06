#!/usr/bin/env bash
set -euo pipefail
# Container05 alias is held by the S08 integration runner; no other workspace/container is modified.
node node_modules/typescript/bin/tsc -p school-workspace/school05/build.tsconfig.json > school-workspace/school08/evidence/bff-build.log 2>&1
node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.json > school-workspace/school08/evidence/main-types.log 2>&1
node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.renderer.json > school-workspace/school08/evidence/renderer-types.log 2>&1
node node_modules/vite/bin/vite.js build --config school-workspace/school05/vite.config.ts > school-workspace/school08/evidence/web-build.log 2>&1
node node_modules/vite/bin/vite.js build --config electron-p0/vite.config.ts > school-workspace/school08/evidence/renderer-build.log 2>&1
TLS_DIR=$(mktemp -d /tmp/bogunon-school08-tls.XXXXXX)
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$TLS_DIR/key.pem" -out "$TLS_DIR/cert.pem" -days 1 -subj '/CN=localhost' >/dev/null 2>&1
SCHOOL_WORKSPACE_MODE=synthetic SCHOOL05_KEY="$TLS_DIR/key.pem" SCHOOL05_CERT="$TLS_DIR/cert.pem" node build/school05-local/school-workspace/school05/server/qa-web.js > school-workspace/school08/evidence/bff-server.log 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null||true;wait "$PID" 2>/dev/null||true;rm -rf "$TLS_DIR"' EXIT
for ((i=0;i<100;i++));do if rg -q 'loopback ready' school-workspace/school08/evidence/bff-server.log;then break;fi;sleep .25;done
node school-workspace/school08/browser-check.mjs
