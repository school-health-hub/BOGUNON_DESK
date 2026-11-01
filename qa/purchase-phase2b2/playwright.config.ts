import { defineConfig } from '@playwright/test';
import path from 'node:path';
const source = process.env['SOURCE_ROOT'];
if (!source) throw new Error('SOURCE_ROOT must identify the pinned product checkout');
const evidence = process.env['EVIDENCE_DIR'];
if (!evidence) throw new Error('EVIDENCE_DIR is required');
export default defineConfig({
  testDir: './tests', retries: 0, workers: 1, fullyParallel: false,
  outputDir: path.join(evidence, 'browser-results'),
  reporter: [['list'], ['json', { outputFile: path.join(evidence, 'playwright.json') }], ['junit', { outputFile: path.join(evidence, 'junit.xml') }],
    ['html', { outputFolder: path.join(evidence, 'browser-report'), open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:1420', browserName: 'chromium', headless: false,
    viewport: { width: 1440, height: 900 }, serviceWorkers: 'block',
    trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `node "${path.join(source, 'node_modules/vite/bin/vite.js')}" --config "${path.join(source, 'qa/purchase-phase2b2-runtime/vite.config.mjs')}" --host 127.0.0.1 --port 1420 --strictPort`,
    cwd: source, url: 'http://127.0.0.1:1420', reuseExistingServer: false,
  },
});
