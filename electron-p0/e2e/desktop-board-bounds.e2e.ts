import { _electron as electron, expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

test('fits the Palette window to the connected Windows work area', async ({}, testInfo) => {
  test.skip(process.platform !== 'win32', 'Windows Palette verification');
  test.setTimeout(120_000);
  const root = await mkdtemp(join(process.cwd(), 'artifacts', 'p-'));
  const runId = randomUUID();
  const settingsDir = join(root, 'test-runs', runId, 'user-data', 'poc-settings');
  await mkdir(settingsDir, { recursive: true });
  await writeFile(join(settingsDir, 'onboarding.json'), JSON.stringify({ version: 1, completed: true }));
  const started = performance.now();
  const app = await electron.launch({
    timeout: 70_000,
    executablePath: createRequire(import.meta.url).resolve('electron/package.json').replace(/package\.json$/u, 'dist/electron.exe'),
    chromiumSandbox: true,
    args: [join(process.cwd(), 'build/electron-p0-app')],
    env: { ...process.env, RUNNER_TEMP: dirname(root), ELECTRON_P0_QA_PROFILE: '1', ELECTRON_P0_QA_ROOT: root, ELECTRON_P0_TEST_RUN: runId, ELECTRON_P0_DEV_URL: '' },
  });
  try {
    const connectedMs = Math.round(performance.now() - started);
    const display = await app.evaluate(({ screen }) => ({
      count: screen.getAllDisplays().length,
      primary: screen.getPrimaryDisplay(),
    }));
    await expect.poll(() => app.windows().some(page => page.url().includes('/renderer/palette/'))).toBe(true);
    const paletteWindowMs = Math.round(performance.now() - started);
    const pages = app.windows().filter(candidate => candidate.url().includes('/renderer/palette/'));
    await Promise.all(pages.map(candidate => candidate.getByRole('main', { name: 'BOGUNON DESK 바탕화면 위젯' }).waitFor()));
    const candidates = await Promise.all(pages.map(async page => ({
      page,
      surface: await page.evaluate(() => globalThis.window.electronPalette.readSurface()),
    })));
    const page = candidates.find(candidate => candidate.surface.dockVisible)?.page;
    if (!page) throw new Error('Primary Palette window unavailable');
    await page.getByRole('main', { name: 'BOGUNON DESK 바탕화면 위젯' }).waitFor();
    const window = await app.browserWindow(page);
    const bounds = await window.evaluate(palette => palette.getBounds());
    const { workArea, scaleFactor } = display.primary;
    const inset = display.count === 1 ? Math.round(workArea.width * 0.22) : 0;
    expect(bounds).toEqual({ ...workArea, x: workArea.x + inset, width: workArea.width - inset });
    await testInfo.attach('work-area.json', {
      body: JSON.stringify({ bounds, workArea, scaleFactor, displayCount: display.count, connectedMs, paletteWindowMs, readyMs: Math.round(performance.now() - started) }),
      contentType: 'application/json',
    });
    await page.screenshot({ path: testInfo.outputPath('palette.png') });
    const workspace = app.windows().find(candidate => !candidate.url().includes('/renderer/palette/'));
    if (!workspace) throw new Error('Workspace window unavailable');
    const previous = await workspace.evaluate(() => globalThis.window.electronP0.desktopSurface.read());
    await page.evaluate(() => globalThis.window.electronPalette.openSettings());
    const placement = workspace.getByRole('region', { name: '화면 배치', exact: true });
    const width = placement.getByLabel('바탕화면 아이콘 공간 너비');
    await width.selectOption('25');
    await placement.getByRole('button', { name: '취소', exact: true }).click();
    await expect(width).toHaveValue('22');
    await width.selectOption('25');
    await placement.getByRole('button', { name: '기본 배치 복원', exact: true }).click();
    await expect(width).toHaveValue('22');
    await placement.getByRole('radio', { name: '바탕화면과 함께 사용' }).check();
    await width.selectOption('25');
    await workspace.screenshot({ path: testInfo.outputPath('board-settings.png') });
    await placement.getByRole('button', { name: '적용', exact: true }).click();
    await expect(placement.getByRole('status')).toHaveText('화면 배치를 적용했습니다.');
    const saved = await workspace.evaluate(() => globalThis.window.electronP0.desktopSurface.read());
    expect(saved.profiles).toEqual(previous.profiles);
    expect(saved.dockProfileKey).toEqual(previous.dockProfileKey);
    const sharedInset = Math.round(workArea.width * 0.25);
    expect(await window.evaluate(palette => palette.getBounds())).toEqual({
      ...workArea, x: workArea.x + sharedInset, width: workArea.width - sharedInset,
    });
    await page.screenshot({ path: testInfo.outputPath('palette-shared.png') });
  } finally {
    await app.close();
  }
  const persisted: unknown = JSON.parse(await readFile(join(settingsDir, 'desktop-surface.json'), 'utf8'));
  expect(persisted).toMatchObject({ boardPlacement: { preset: 'shared', target: null, iconSpace: 25 } });
});
