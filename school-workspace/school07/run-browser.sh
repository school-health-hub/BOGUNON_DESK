#!/usr/bin/env bash
set -euo pipefail
D=(docker --host=unix:///var/run/docker.sock)
if "${D[@]}" inspect bogunon-school05-pg >/dev/null 2>&1;then echo 'Refusing existing SCHOOL05 container' >&2;exit 1;fi
"${D[@]}" rename bogunon-school07-pg bogunon-school05-pg
TLS_DIR=$(mktemp -d /tmp/bogunon-school07-tls.XXXXXX)
PID=''
cleanup(){ if [[ -n "$PID" ]];then kill "$PID" 2>/dev/null||true;wait "$PID" 2>/dev/null||true;fi;rm -rf "$TLS_DIR";"${D[@]}" rename bogunon-school05-pg bogunon-school07-pg;}
trap cleanup EXIT
node node_modules/typescript/bin/tsc -p school-workspace/school05/build.tsconfig.json > school-workspace/school07/evidence/bff-build.log 2>&1
node node_modules/vite/bin/vite.js build --config school-workspace/school05/vite.config.ts > school-workspace/school07/evidence/web-build.log 2>&1
node node_modules/vite/bin/vite.js build --config electron-p0/vite.config.ts > school-workspace/school07/evidence/renderer-build.log 2>&1
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$TLS_DIR/key.pem" -out "$TLS_DIR/cert.pem" -days 1 -subj '/CN=localhost' >/dev/null 2>&1
SCHOOL_WORKSPACE_MODE=synthetic SCHOOL05_KEY="$TLS_DIR/key.pem" SCHOOL05_CERT="$TLS_DIR/cert.pem" node build/school05-local/school-workspace/school05/server/qa-web.js > school-workspace/school07/evidence/bff-server.log 2>&1 &
PID=$!
for ((i=0;i<100;i++));do if rg -q 'loopback ready' school-workspace/school07/evidence/bff-server.log;then break;fi;sleep .25;done
node school-workspace/school07/browser-check.mjs
