import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { finderHomeQaPaths, prepareFinderHomeQaPaths, finderHomeQaEnvironment, identifier, projectRoot } from './finder-home-qa-paths.mjs';

const paths = prepareFinderHomeQaPaths(finderHomeQaPaths());
// Never erase or overwrite an existing frontend/evidence bundle.
if (readdirSync(paths.dist).length !== 0) throw new Error('Use a fresh dedicated Finder QA output root.');
Object.assign(process.env, finderHomeQaEnvironment(paths));
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('Finder QA source SHA unavailable.');
const sourceDirty = execFileSync('git', ['status', '--porcelain'], { cwd: projectRoot, encoding: 'utf8' }).trim() !== '';
process.env.BOGUNON_FINDER_HOME_QA_SOURCE_SHA = sourceSha;
process.env.BOGUNON_FINDER_HOME_QA_SOURCE_DIRTY = String(sourceDirty);
const { build } = await import('vite');
await build({ configFile: join(projectRoot, 'vite.finder-home-qa.config.mjs'), configLoader: 'runner' });
const forbidden = /supabase\.co|api\.openai\.com|chatgpt\.com\/backend|generativelanguage\.googleapis|plugin:(?:updater|deep-link|autostart|opener)|chatgpt_(?:get|start|disconnect|list|generate|search)|generate_ai_text|validate_ai_connection|education_video_search/;
let inert = false;
for (const file of readdirSync(join(paths.dist, 'assets'))) {
  if (!file.endsWith('.js')) continue;
  const source = readFileSync(join(paths.dist, 'assets', file), 'utf8');
  if (forbidden.test(source)) throw new Error(`Production transport found in Finder QA bundle: ${file}`);
  inert ||= source.includes('격리 QA에서는 인증·AI·모델 조회·외부 연결을 사용할 수 없습니다.');
}
if (!inert || !existsSync(join(paths.dist, 'index.html'))) throw new Error('Finder QA isolation boundary missing.');
const stamp = { sourceSha, sourceDirty, identifier, externalConnections: false, frontendDist: paths.dist.replaceAll('\\', '/'), projectRoot: projectRoot.replaceAll('\\', '/') };
writeFileSync(join(paths.dist, 'qa-build.json'), `${JSON.stringify(stamp, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ ...stamp, nativeBuild: 'NOT RUN', appExecution: 'NOT RUN' }, null, 2));
