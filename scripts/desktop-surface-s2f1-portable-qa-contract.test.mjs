import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflowPath = ".github/workflows/desktop-surface-s2f1-portable-qa.yml";
const workflow = readFileSync(workflowPath, "utf8");

test("given the S-2F-1 workflow, when trigger boundaries are inspected, then only the integration branch can build", () => {
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- integration\/desktop-surface-s2/u);
  assert.match(workflow, /github\.repository == 'school-health-hub\/BOGUNON_DESK'/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/integration\/desktop-surface-s2'/u);
  assert.match(workflow, /github\.run_attempt == 1/u);
  assert.doesNotMatch(workflow, /pull_request:|release:|schedule:|workflow_run:|environment:|secrets\./u);
});

test("given the checked out source, when provenance is established, then git HEAD and event SHA are independently bound", () => {
  assert.match(workflow, /git rev-parse HEAD/u);
  assert.match(workflow, /GITHUB_SHA/u);
  assert.match(workflow, /BOGUNON_SURFACE_QA_SOURCE_SHA/u);
  assert.match(workflow, /--source-sha\s+\$env:GITHUB_SHA/u);
  assert.match(workflow, /--checkout-head\s+\$checkoutHead/u);
  assert.doesNotMatch(workflow, /--checkout-head\s+\$env:GITHUB_SHA/u);
});

test("given completed builds, when packaging begins, then tracked source and index must still be unchanged", () => {
  const packaging = workflow.slice(workflow.indexOf("- name: Assemble and verify portable QA package"));
  assert.match(packaging, /git diff --exit-code -- \./u);
  assert.match(packaging, /git diff --cached --exit-code -- \./u);
  assert.ok(packaging.indexOf("git diff --exit-code -- .") < packaging.indexOf("node scripts/package-surface-qa-portable.mjs"));
});

test("given the build job, when commands are inspected, then dependencies and both native binaries are locked and exact", () => {
  assert.match(workflow, /npm ci/u);
  assert.match(workflow, /choco install nasm --version=2\.16\.3 --yes --no-progress --limit-output --source=https:\/\/community\.chocolatey\.org\/api\/v2\//u);
  assert.match(workflow, /\^NASM version 2\\\.16\\\.03/u);
  assert.match(workflow, /GITHUB_PATH/u);
  assert.match(workflow, /node scripts\/build-surface-qa-frontend\.mjs/u);
  assert.match(workflow, /cargo check --locked --manifest-path src-tauri\/Cargo\.toml[^\n]*--features desktop-surface-qa/u);
  assert.match(workflow, /cargo build --locked --manifest-path src-tauri\/Cargo\.toml[^\n]*--features desktop-surface-qa/u);
  assert.match(workflow, /cargo build --locked --manifest-path src-surface-host\/Cargo\.toml/u);
  assert.match(workflow, /bogunon-desk-surface-qa\.exe/u);
  assert.match(workflow, /bogunon-desktop-surface-host\.exe/u);
});

test("given a transient package feed failure, when NASM provisioning runs, then retries are bounded without changing the pinned dependency", () => {
  assert.match(workflow, /foreach \(\$attempt in 1\.\.3\)/u);
  assert.match(workflow, /if \(\$attempt -lt 3\)/u);
  assert.match(workflow, /Start-Sleep -Seconds \(10 \* \$attempt\)/u);
  assert.match(workflow, /Pinned NASM installation failed after 3 attempts/u);
  assert.doesNotMatch(workflow, /choco install nasm[^\n]*(?:--force|--ignore-checksums|--allow-unofficial)/u);
});

test("given the QA flavor, when isolation guards run, then production integrations and operating data remain outside the package", () => {
  assert.match(workflow, /kr\.sungandi\.schoolhealthdesk\.surfaceqa/u);
  assert.match(workflow, /tauri\.desktop-surface-qa\.conf\.json/u);
  assert.match(workflow, /desktop-surface-qa-contract\.test\.mjs/u);
  assert.match(workflow, /surface-qa-frontend-contract\.test\.mjs/u);
  assert.match(workflow, /package-surface-qa-portable\.test\.mjs/u);
  assert.match(workflow, /git diff --exit-code -- src-tauri\/tauri\.conf\.json/u);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\.|VITE_SUPABASE_|SUPABASE_(?:URL|KEY)|OAUTH_(?:TOKEN|SECRET)|TAURI_SIGNING_PRIVATE_KEY/iu);
});

test("given a successful build, when the artifact is uploaded, then only the portable package is retained briefly", () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: read/u);
  assert.match(workflow, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/u);
  assert.match(workflow, /retention-days: 7/u);
  assert.match(workflow, /path: artifacts\/desktop-surface-s2f1-portable-qa/u);
  assert.match(workflow, /if-no-files-found: error/u);
  const upload = workflow.slice(workflow.indexOf("- name: Upload portable QA package only"));
  assert.doesNotMatch(upload, /target\/\*\*|AppData|User Data|cookies|credentials|\.map/u);
  assert.doesNotMatch(workflow, /npm run tauri build|--bundles(?:\s|$)|bundle\/nsis|release\/upload/iu);
});

test("given this artifact workflow, when its scope is classified, then it never runs the QA executables", () => {
  assert.match(workflow, /actualWindowsWebViewRuntime[^\n]*NOT_VERIFIED/u);
  assert.doesNotMatch(workflow, /Start-Process|cargo run|\.\\bogunon-desk-surface-qa\.exe|\.\\bogunon-desktop-surface-host\.exe/u);
});

test("QA artifact requires actual generated ACL and sanitized edit regressions", () => {
  assert.match(workflow, /generated_qa_context_grants_only_three_edits_to_main_webview/u);
  assert.match(workflow, /vitest run --config vitest\.surface-qa\.config\.ts/u);
  assert.match(workflow, /Generated effective QA ACL verification failed/u);
  assert.doesNotMatch(workflow, /QA Main capabilities must remain empty/u);
});
