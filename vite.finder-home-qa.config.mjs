import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { finderHomeQaPaths, projectRoot } from './scripts/finder-home-qa-paths.mjs';

const paths = finderHomeQaPaths();
export default defineConfig({
  root: resolve(projectRoot, 'qa/finder-home'),
  envDir: paths.environment,
  cacheDir: resolve(paths.cache, 'vite'),
  plugins: [react()],
  define: {
    __FINDER_HOME_QA_SOURCE_SHA__: JSON.stringify(process.env.BOGUNON_FINDER_HOME_QA_SOURCE_SHA ?? 'NOT_BUILT'),
    __FINDER_HOME_QA_DIRTY__: JSON.stringify(process.env.BOGUNON_FINDER_HOME_QA_SOURCE_DIRTY === 'true'),
  },
  resolve: { alias: [
    { find: /.*\/auth\/supabaseClient$/, replacement: resolve(projectRoot, 'src/finder-home-qa/inertSupabase.ts') },
    { find: /^@tauri-apps\/api\/core$/, replacement: resolve(projectRoot, 'src/finder-home-qa/qaIpc.ts') },
    { find: /.*\/ai\/AiConnectionContext$/, replacement: resolve(projectRoot, 'src/finder-home-qa/inertConnections.ts') },
    { find: /.*\/chatgpt\/ChatGptConnectionContext$/, replacement: resolve(projectRoot, 'src/finder-home-qa/inertConnections.ts') },
    { find: '/src', replacement: resolve(projectRoot, 'src') },
  ] },
  build: { outDir: paths.dist, emptyOutDir: false, sourcemap: false },
  test: { root: projectRoot, include: ['src/finder-home-qa/**/*.test.{ts,tsx}'],
    environment: 'jsdom', maxWorkers: 2, fileParallelism: false },
});
