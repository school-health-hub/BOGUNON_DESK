// Narrow changed-file allowlist + high-confidence secret/PII patterns. Not a full DLP audit.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const git=(args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
const files=[...new Set([...git(['diff','--name-only','a765ad08570dc5513edf96bb970442026a0a31ce']),...git(['ls-files','--others','--exclude-standard'])])];
const allowed=f=>f.startsWith('src/inventory-management/connection/') || f.startsWith('inventory-management/qa/scripts/') || f.startsWith('inventory-management/qa/tests/IM-2B-1-') || f.startsWith('docs/inventory-management/IM-2B-1-');
for(const file of files) {
  assert(allowed(file),`Out-of-scope change: ${file}`);
  const s=readFileSync(resolve(root,file),'utf8');
  const forbidden=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,/sb_secret_[A-Za-z0-9_-]{24,}/,/AKIA[A-Z0-9]{16}/,/\b\d{6}-[1-4]\d{6}\b/];
  assert(!forbidden.some(p=>p.test(s)),`Secret/PII pattern found in ${file}`);
  if(file.startsWith('src/inventory-management/connection/')) {
    assert(!/from\s+['"][^'"]*(?:auth\/|supabaseClient|electron|purchase-helper)/i.test(s),`Forbidden integration import: ${file}`);
  }
}
execFileSync('git',['diff','--check'],{cwd:root,stdio:'pipe'});
console.log(`PASS: ${files.length} changed files stay within Inventory scope; no high-confidence secret/PII patterns.`);
