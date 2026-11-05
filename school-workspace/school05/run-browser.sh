#!/usr/bin/env bash
set -euo pipefail
node node_modules/typescript/bin/tsc -p school-workspace/school05/build.tsconfig.json
node node_modules/vite/bin/vite.js build --config school-workspace/school05/vite.config.ts > school-workspace/school05/evidence/web-build.log 2>&1
TLS_DIR=$(mktemp -d /tmp/bogunon-school05-tls.XXXXXX)
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$TLS_DIR/key.pem" -out "$TLS_DIR/cert.pem" -days 1 -subj '/CN=localhost' >/dev/null 2>&1
SCHOOL_WORKSPACE_MODE=synthetic SCHOOL05_KEY="$TLS_DIR/key.pem" SCHOOL05_CERT="$TLS_DIR/cert.pem" node build/school05-local/school-workspace/school05/server/qa-web.js > school-workspace/school05/evidence/web-server.log 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null||true;rm -rf "$TLS_DIR"' EXIT
for ((i=0;i<120;i++));do if rg -q 'loopback ready' school-workspace/school05/evidence/web-server.log;then break;fi;sleep .25;done
node school-workspace/school05/browser-check.mjs > school-workspace/school05/evidence/browser.log 2>&1
cat school-workspace/school05/evidence/browser.log
