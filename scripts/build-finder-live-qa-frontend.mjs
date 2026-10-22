import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { build } from 'vite';
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const baseSha = 'f0981bf965b191ca380d5a97afe9aa61f9a1c3d8';
if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('Finder Live QA source commit unavailable');
await build({ configFile: 'vite.finder-live-qa.config.ts' });
for (const file of await readdir('dist-finder-live-qa/assets')) {
 if (!file.endsWith('.js')) continue;
 const source = await readFile(`dist-finder-live-qa/assets/${file}`, 'utf8');
 if (/supabase\.co|bogunon\.vercel\.app|plugin:updater|downloadAndInstall|plugin:deep-link/.test(source)) throw new Error('Unrelated production integration in Finder Live QA frontend');
}
await mkdir('dist-finder-live-qa', { recursive: true });
await writeFile('dist-finder-live-qa/qa-build.json', JSON.stringify({ sourceSha, baseSha, identifier: 'kr.sungandi.schoolhealthdesk.finderliveqa' }, null, 2));
