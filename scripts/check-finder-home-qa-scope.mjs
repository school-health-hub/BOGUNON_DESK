import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { projectRoot } from './finder-home-qa-paths.mjs';

const git = args => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
const staged = process.argv.includes('--staged');
const paths = [...new Set((staged ? git(['diff', '--cached', '--name-only', '-z']) :
  git(['diff', '--name-only', '-z']) + git(['ls-files', '--others', '--exclude-standard', '-z']))
  .split('\0').filter(Boolean))];
const exact = new Set(['docs/FINDER_HOME_QA.md', 'vite.finder-home-qa.config.mjs',
  'vitest.finder-home-regression.config.mjs', 'src-tauri/Cargo.toml', 'src-tauri/build.rs',
  'src-tauri/src/lib.rs', 'src-tauri/src/education_video/mod.rs',
  'src-tauri/tauri.finder-home-qa.conf.json', 'src-tauri/finder_home_qa_build.rs',
  'scripts/build-finder-home-qa-frontend.mjs', 'scripts/verify-finder-home-qa.mjs',
  'scripts/check-finder-home-qa-scope.mjs', 'scripts/finder-home-qa-paths.mjs',
  'scripts/finder-home-qa-paths.test.mjs', 'scripts/finder-home-qa-boundary.test.mjs']);
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['provider-key', /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{24,}|AIza[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16})\b/],
  ['jwt', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/],
  ['credential-literal', /(?:access_token|refresh_token|service_role_key|api_key|password)\s*[=:]\s*["'][A-Za-z0-9_+/.=-]{16,}["']/i],
  ['email-review', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
];
const findings = [];
for (const path of paths) {
  if (!exact.has(path) && !/^src\/finder-home-qa\/[\w.-]+\.(?:ts|tsx|css)$/.test(path)
    && !/^src-tauri\/src\/finder_home_qa(?:_[a-z]+)?\.rs$/.test(path)
    && path !== 'qa/finder-home/index.html') throw new Error(`Out-of-scope file: ${path}`);
  const source = staged ? git(['show', `:${path}`]) : readFileSync(`${projectRoot}/${path}`, 'utf8');
  for (const [kind, pattern] of patterns) if (pattern.test(source)) findings.push({ path, kind });
}
console.log(JSON.stringify({ mode: staged ? 'staged-bytes' : 'working-files', files: paths.length,
  findings, scanner: 'best-effort patterns and human diff review; not a complete secret/PII detector' }, null, 2));
if (findings.length > 0) process.exitCode = 1;
