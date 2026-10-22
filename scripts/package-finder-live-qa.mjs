import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const baseSha = '419e31e2c9e32c6a36dd6c4982572436fb96669b';
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (sourceSha !== process.env.BOGUNON_QA_SOURCE_SHA) throw new Error('Build source mismatch');
const root = 'src-tauri/target/x86_64-pc-windows-msvc/release';
const names = ['bogunon-desk-finder-live-qa.exe', 'school-health-desk.exe'];
const found = names.filter(name => existsSync(`${root}/${name}`));
if (found.length !== 1) throw new Error('Ambiguous QA executable');
const bytes = readFileSync(`${root}/${found[0]}`);
if (!bytes.includes(Buffer.from('chatgpt_search_web')) || !bytes.includes(Buffer.from('finder_live_qa_metadata'))) throw new Error('Missing QA/search command markers');
for (const marker of ['streamEventCounts', 'completedItemEvidence', 'searchParseReason', 'search-attempt-4.receipt']) {
 if (!bytes.includes(Buffer.from(marker))) throw new Error('Missing SSE diagnostics or fourth-slot gate marker');
}
const sha256 = createHash('sha256').update(bytes).digest('hex');
mkdirSync('artifacts/finder-live-qa', { recursive: true });
copyFileSync(`${root}/${found[0]}`, 'artifacts/finder-live-qa/bogunon-desk-finder-live-qa.exe');
writeFileSync('artifacts/finder-live-qa/SOURCE.json', JSON.stringify({ baseSha, sourceSha, sha256, identifier: 'kr.sungandi.schoolhealthdesk.finderliveqa', nativeFeature: 'finder-live-qa', sseDiagnosticsVersion: 2, approvedSearchSlot: 4, toolChoice: 'auto', runId: process.env.GITHUB_RUN_ID ?? null, liveQa: 'NOT RUN', credentials: 'existing local credentials read-only; no CI credentials', installation: 'portable; do not install over production' }, null, 2));
writeFileSync('artifacts/finder-live-qa/SHA256SUMS.txt', `${sha256}  bogunon-desk-finder-live-qa.exe\n`);
console.log(JSON.stringify({ baseSha, sourceSha, sha256 }));
