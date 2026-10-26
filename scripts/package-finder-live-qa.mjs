import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const baseSha = 'eed15c31a27e983a36fea2434fcf26dfbbebf4d1';
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const worktreeState = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { encoding: 'utf8' }).trim();
if (worktreeState !== '') throw new Error('Finder Live QA package requires a clean source worktree');
if (sourceSha !== process.env.BOGUNON_QA_SOURCE_SHA) throw new Error('Build source mismatch');
const root = 'src-tauri/target/x86_64-pc-windows-msvc/release';
const names = ['bogunon-desk-finder-live-qa5.exe', 'school-health-desk.exe'];
const found = names.filter(name => existsSync(`${root}/${name}`));
if (found.length !== 1) throw new Error('Ambiguous QA executable');
const bytes = readFileSync(`${root}/${found[0]}`);
if (!bytes.includes(Buffer.from('chatgpt_search_web')) || !bytes.includes(Buffer.from('finder_live_qa_metadata'))) throw new Error('Missing QA/search command markers');
for (const marker of ['streamEventCounts', 'completedItemEvidence', 'completedItemShapes', 'linkedContentEvents', 'searchParseReason', 'search-attempt-5.receipt', 'qa5-live-search.approved']) {
 if (!bytes.includes(Buffer.from(marker))) throw new Error('Missing SSE diagnostics or QA5 gate marker');
}
const sha256 = createHash('sha256').update(bytes).digest('hex');
mkdirSync('artifacts/finder-live-qa5', { recursive: true });
copyFileSync(`${root}/${found[0]}`, 'artifacts/finder-live-qa5/bogunon-desk-finder-live-qa5.exe');
writeFileSync('artifacts/finder-live-qa5/SOURCE.json', JSON.stringify({ baseSha, sourceSha, sha256, identifier: 'kr.sungandi.schoolhealthdesk.finderliveqa5', nativeFeature: 'finder-live-qa', sseDiagnosticsVersion: 3, preparedSearchSlot: 5, slotApproved: false, slotUsed: false, maximumSearchRequests: 1, automaticRetries: 0, recommendationRequests: 0, toolChoice: 'auto', runId: process.env.GITHUB_RUN_ID ?? null, liveQa: 'NOT RUN', credentials: 'existing local credentials read-only; no CI credentials', installation: 'portable; do not install over production' }, null, 2));
writeFileSync('artifacts/finder-live-qa5/SHA256SUMS.txt', `${sha256}  bogunon-desk-finder-live-qa5.exe\n`);
console.log(JSON.stringify({ baseSha, sourceSha, sha256 }));
