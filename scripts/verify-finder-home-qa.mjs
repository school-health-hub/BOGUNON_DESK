import { spawnSync } from 'node:child_process';
import { openSync, closeSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { finderHomeQaPaths, prepareFinderHomeQaPaths, finderHomeQaEnvironment, projectRoot } from './finder-home-qa-paths.mjs';

const paths = prepareFinderHomeQaPaths(finderHomeQaPaths());
const env = finderHomeQaEnvironment(paths);
const selected = process.argv[2] ?? 'all';
const tasks = [
  ['paths', ['--test', 'scripts/finder-home-qa-paths.test.mjs', 'scripts/finder-home-qa-boundary.test.mjs']],
  ['unit', ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vite.finder-home-qa.config.mjs', '--configLoader', 'runner']],
  ['regression', ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.finder-home-regression.config.mjs', '--configLoader', 'runner']],
  ['regression-focus', ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.finder-home-regression.config.mjs', '--configLoader', 'runner', 'src/education-video/AiVideoFinder.autoSearch.test.tsx']],
  ['types', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']],
  ['frontend', ['scripts/build-finder-home-qa-frontend.mjs']],
];
if (selected !== 'all' && !tasks.some(([name]) => name === selected)) throw new Error('Unknown verification task.');
const results = [];
for (const [name, args] of tasks) {
  if (selected !== 'all' && selected !== name) continue;
  const log = join(paths.logs, `${name}-${Date.now()}.log`);
  const descriptor = openSync(log, 'wx');
  let result;
  try {
    result = spawnSync(process.execPath, args, { cwd: projectRoot, env,
      stdio: ['ignore', descriptor, descriptor], timeout: 240000, windowsHide: true });
  } finally { closeSync(descriptor); }
  const status = result.status === 0 && !result.error ? 'PASS' : 'FAIL';
  results.push({ name, status, exitCode: result.status, log });
  console.log(JSON.stringify(results.at(-1)));
  if (status === 'FAIL') break;
}
writeFileSync(join(paths.logs, `verification-${Date.now()}.json`), `${JSON.stringify(results, null, 2)}\n`, { flag: 'wx' });
if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
