import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('Finder Live QA source commit unavailable');
export default defineConfig({
 root: 'qa-finder-live', plugins: [react()], envPrefix: 'FINDER_LIVE_QA_PUBLIC_',
 define: { __FINDER_LIVE_QA_SOURCE_SHA__: JSON.stringify(sourceSha), __FINDER_LIVE_QA_BASE_SHA__: JSON.stringify('df8375a015f1868b27d7741a754e0df772837684') },
 resolve: { alias: [
  { find: '/src', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
  { find: '../auth/authService', replacement: fileURLToPath(new URL('./src/finder-live-qa/authStub.ts', import.meta.url)) },
  { find: '../auth/supabaseClient', replacement: fileURLToPath(new URL('./src/finder-live-qa/authStub.ts', import.meta.url)) },
 ] },
 build: { outDir: '../dist-finder-live-qa', emptyOutDir: true },
});
