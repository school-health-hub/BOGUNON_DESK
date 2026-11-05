#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p school-workspace/auth/evidence
node node_modules/typescript/bin/tsc -p school-workspace/auth/tsconfig.json > school-workspace/auth/evidence/auth-typecheck.log 2>&1
node node_modules/typescript/bin/tsc -p school-workspace/auth/tsconfig.build.json > school-workspace/auth/evidence/auth-build.log 2>&1
node --input-type=module -e "const m=await import('./build/school-workspace-auth/school-workspace/auth/electron/main-adapter.js'); const w=await import('./build/school-workspace-auth/school-workspace/auth/web/bff-adapter.js'); if(!m.ElectronMainAuthAdapter||!w.WebBffAuthAdapter)process.exit(1); console.log('PASS compiled Main/BFF module import; no Auth instantiation/network');" > school-workspace/auth/evidence/auth-build-smoke.log 2>&1
node node_modules/vitest/vitest.mjs run --config school-workspace/auth/vitest.config.ts --reporter=verbose --reporter=json --outputFile=school-workspace/auth/evidence/auth-tests.json > school-workspace/auth/evidence/auth-tests.log 2>&1
node --input-type=module -e "import{readFileSync}from'node:fs';const r=JSON.parse(readFileSync('school-workspace/auth/evidence/auth-tests.json','utf8'));console.log(JSON.stringify({tests:r.numTotalTests,passed:r.numPassedTests,failed:r.numFailedTests,scope:'local adapters + MOCK Auth/RPC HTTP only'}));if(!r.success)process.exit(1);"
