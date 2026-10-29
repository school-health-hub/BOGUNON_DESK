import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { finderHomeQaPaths } from './scripts/finder-home-qa-paths.mjs';
const paths = finderHomeQaPaths();
export default defineConfig({
  envDir: paths.environment, cacheDir: `${paths.cache}/regression`, plugins: [react()],
  test: { maxWorkers: 2, fileParallelism: false, include: [
    'src/education-video/**/*.test.{ts,tsx}',
    'src/official-document/documentGenerator.test.ts',
    'src/official-document/officialDocumentSession.test.ts',
  ] },
});
