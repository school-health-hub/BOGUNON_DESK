import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

test('Dock edits update the preview and survive restart; the clock stays readable', async ({}, testInfo) => {
  test.skip(process.platform !== 'win32', 'Windows Electron verification');
  test.setTimeout(150_000);
  const root = await mkdtemp(join(tmpdir(), 'p-'));
  const runId = randomUUID();
  const settings = join(root, 'test-runs', runId, 'user-data', 'poc-settings');
  await mkdir(settings, { recursive: true });
  await writeFile(join(settings, 'onboarding.json'), JSON.stringify({ version: 1, completed: true }));
  const baseline = process.env.DOCK_CLOCK_BASELINE_ROOT;
  const launch = () => electron.launch({
    timeout: 45_000,
    chromiumSandbox: true,
    executablePath: process.env.ELECTRON_P0_EXECUTABLE ?? createRequire(import.meta.url).resolve('electron/package.json').replace(/package\.json$/u, 'dist/electron.exe'),
    args: [...(process.env.DOCK_CLOCK_SOFTWARE_RENDERING === '1' ? ['--disable-gpu'] : []), resolve(baseline ?? 'build/electron-p0-app')],
    env: { ...process.env, RUNNER_TEMP: dirname(root), ELECTRON_P0_QA_PROFILE: '1', ELECTRON_P0_QA_ROOT: root, ELECTRON_P0_TEST_RUN: runId, ELECTRON_P0_DEV_URL: '' },
  });
  const findPalette = async (app: ElectronApplication) => {
    const hasDock = async () => {
      for (const page of app.windows()) {
        if (page.url().includes('/palette/') && await page.locator('.palette-dock-region').count()) return page;
      }
    };
    await expect.poll(async () => Boolean(await hasDock())).toBe(true);
    const palette = await hasDock();
    if (!palette) throw new Error('Palette with Dock missing');
    return palette;
  };
  const app = await launch();
  let expectedDock: string[] = [];
  try {
    const palette = await findPalette(app);
    const clock = palette.getByRole('region', { name: '현재 날짜와 시간' });
    await clock.screenshot({ path: testInfo.outputPath('clock.png') });
    if (!baseline) {
      const time = clock.locator('time');
      const initial = await time.textContent();
      await expect.poll(() => time.textContent()).not.toBe(initial);
      await expect(time).toHaveCSS('font-variant-numeric', 'tabular-nums');
      await clock.evaluate(node => { node.style.width = '112px'; });
      const width = await time.evaluate(node => ({ rendered: node.clientWidth, content: node.scrollWidth }));
      expect(width.content).toBeLessThanOrEqual(width.rendered);
      await clock.screenshot({ path: testInfo.outputPath('clock-narrow.png') });
    }
    const liveDock = palette.locator('.palette-dock-region');
    const liveIds = () => liveDock.locator('button[data-dock-item]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-dock-item') ?? ''));
    const initialDock = await liveIds();
    await palette.evaluate(() => window.electronPalette.openSettings());
    await expect.poll(() => app.windows().some(page => page.url().endsWith('/renderer/index.html'))).toBe(true);
    const workspace = app.windows().find(page => page.url().endsWith('/renderer/index.html'));
    if (!workspace) throw new Error('Workspace missing');
    await workspace.getByRole('button', { name: 'Dock', exact: true }).click();
    const editor = workspace.getByRole('complementary', { name: 'Dock 편집' });
    await editor.screenshot({ path: testInfo.outputPath('dock.png') });
    if (baseline) return;
    const preview = editor.getByRole('region', { name: 'Dock 미리보기' });
    const previewIds = () => preview.locator('[data-dock-item]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-dock-item')));
    expect(initialDock.length).toBeGreaterThan(2);
    expect(await previewIds()).toEqual(initialDock);
    const hidden = initialDock[1];
    const row = editor.locator(`[data-dock-editor-item="${hidden}"]`);
    const control = row.getByRole('switch');
    await expect(control).toBeChecked();
    await control.press('Space');
    await expect(control).not.toBeChecked();
    await expect.poll(previewIds).toEqual(initialDock.filter(id => id !== hidden));
    await expect(row).toBeVisible();
    await control.press('Space');
    await expect.poll(previewIds).toEqual(initialDock);
    const first = editor.locator(`[data-dock-editor-item="${initialDock[0]}"]`).getByRole('button');
    const target = editor.locator(`[data-dock-editor-item="${initialDock[1]}"]`);
    await first.dragTo(target);
    expectedDock = [initialDock[1], initialDock[0], ...initialDock.slice(2)];
    await expect.poll(previewIds).toEqual(expectedDock);
    await expect(workspace.getByRole('region', { name: 'Dock', exact: true }).getByText('설정 저장됨', { exact: true })).toBeVisible();
    await workspace.setViewportSize({ width: 640, height: 650 });
    await editor.screenshot({ path: testInfo.outputPath('dock-narrow.png') });
    await editor.getByRole('button', { name: 'Dock 편집 닫기' }).click();
    await expect.poll(() => liveIds()).toEqual(expectedDock);
  } finally {
    await app.close();
  }
  const restarted = await launch();
  try {
    const palette = await findPalette(restarted);
    const buttons = palette.locator('.palette-dock-region button[data-dock-item]');
    await expect.poll(() => buttons.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-dock-item')))).toEqual(expectedDock);
  } finally {
    await restarted.close();
  }
});
