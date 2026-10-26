import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { build } from 'vite';
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const worktreeState = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { encoding: 'utf8' }).trim();
const baseSha = 'eed15c31a27e983a36fea2434fcf26dfbbebf4d1';
const receiptSha256 = '6966c048a8110b1bf38787a09f2d40c8e3cb00e6ac5c81046ef36fff00da3d02';
const receiptPaths = ['search-attempt.receipt', 'search-attempt-2.receipt', 'search-attempt-3.receipt', 'search-attempt-4.receipt'].map(name => `docs/education-video/handoff-2026-10-23/evidence/runtime/${name}`);
if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('Finder Live QA source commit unavailable');
if (worktreeState !== '') throw new Error('Finder Live QA build requires a clean source worktree');
for (const receipt of receiptPaths) {
 const hash = createHash('sha256').update(await readFile(receipt)).digest('hex');
 if (hash !== receiptSha256) throw new Error(`Preserved QA receipt mismatch: ${receipt}`);
}
await build({ configFile: 'vite.finder-live-qa.config.ts' });
for (const file of await readdir('dist-finder-live-qa5/assets')) {
 if (!file.endsWith('.js')) continue;
 const source = await readFile(`dist-finder-live-qa5/assets/${file}`, 'utf8');
 if (/supabase\.co|bogunon\.vercel\.app|plugin:updater|downloadAndInstall|plugin:deep-link/.test(source)) throw new Error('Unrelated production integration in Finder Live QA frontend');
}
await mkdir('dist-finder-live-qa5', { recursive: true });
await writeFile('dist-finder-live-qa5/qa-build.json', JSON.stringify({ sourceSha, baseSha, identifier: 'kr.sungandi.schoolhealthdesk.finderliveqa5', priorEvidenceReceiptsVerified: true, receiptSha256 }, null, 2));
