import { _electron as electron, expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

test('fits the Palette window to the connected Windows work area', async ({}, testInfo) => {
  test.skip(process.platform !== 'win32', 'Windows Palette verification');
  test.setTimeout(240_000);
  const root = await mkdtemp(join(tmpdir(), 'p-'));
  const runId = randomUUID();
  const settingsDir = join(root, 'test-runs', runId, 'user-data', 'poc-settings');
  await mkdir(settingsDir, { recursive: true });
  await writeFile(join(settingsDir, 'onboarding.json'), JSON.stringify({ version: 1, completed: true }));
  const started = performance.now();
  const launch = () => electron.launch({
    timeout: 70_000,
    executablePath: createRequire(import.meta.url).resolve('electron/package.json').replace(/package\.json$/u, 'dist/electron.exe'),
    chromiumSandbox: true,
    args: [resolve(process.env.BOARD_QA_APP_ROOT ?? 'build/electron-p0-app')],
    env: { ...process.env, RUNNER_TEMP: dirname(root), ELECTRON_P0_QA_PROFILE: '1', ELECTRON_P0_QA_ROOT: root, ELECTRON_P0_TEST_RUN: runId, ELECTRON_P0_DEV_URL: '' },
  });
  const app = await launch();
  let expectedTarget: string | null = null;
  let expectedProfiles: unknown;
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
    const qaEvent = await workspace.evaluate(async id => {
      const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
      const events = globalThis.window.electronWork.events;
      if (!events) throw new Error('Calendar bridge unavailable');
      return events.save({
        event: { id, title: '응급 대응 절차 점검', startDate: today, endDate: today,
          startTime: null, endTime: null, allDay: true, description: '', location: '', category: '교육' },
        expectedRevision: 0, expectedUpdatedAt: null,
      });
    }, randomUUID());
    expect(qaEvent.ok).toBe(true);
    await window.evaluate(palette => palette.webContents.reload());
    await expect(page.getByRole('main', { name: 'BOGUNON DESK 바탕화면 위젯' })).toBeVisible();
    await page.evaluate(async () => {
      for (const widgetId of ['widget-monthly-calendar', 'widget-meal', 'widget-notifications']) {
        await globalThis.window.electronPalette.updateWidget({ action: 'claim', widgetId });
      }
    });
    const calendar = page.locator('[data-widget-id="widget-monthly-calendar"]');
    await expect(calendar.locator('.calendar-cell.is-today')).toBeVisible();
    await expect(calendar.getByText('응급 대응 절차 점검', { exact: !process.env.BOARD_QA_APP_ROOT })).toBeVisible();
    await calendar.screenshot({ path: testInfo.outputPath('monthly-calendar.png') });
    await page.screenshot({ path: testInfo.outputPath('palette-populated.png') });
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
    const secondary = await app.evaluate(({ screen }) =>
      screen.getAllDisplays().find(candidate => candidate.id !== screen.getPrimaryDisplay().id));
    if (secondary) {
      const target = Object.entries(saved.profiles).find(([, profile]) => profile.monitor.lastDisplayId === secondary.id)?.[0];
      if (!target) throw new Error('Secondary profile unavailable');
      await placement.getByRole('radio', { name: '한쪽 모니터를 업무용으로 사용' }).check();
      await placement.getByLabel('배치 대상 모니터').selectOption(target);
      await placement.getByRole('button', { name: '적용', exact: true }).click();
      await expect.poll(() => workspace.evaluate(() => globalThis.window.electronP0.desktopSurface.read()))
        .toMatchObject({ boardPlacement: { preset: 'dedicated', target } });
      await expect.poll(async () => {
        for (const candidate of app.windows()) {
          if (!candidate.url().includes('/renderer/palette/')) continue;
          if (await candidate.locator('.palette-dock-region').count())
            return (await app.browserWindow(candidate)).evaluate(palette => palette.getBounds());
        }
        return null;
      }).toEqual(secondary.workArea);
      for (const candidate of app.windows()) {
        if (candidate.url().includes('/renderer/palette/') && await candidate.locator('.palette-dock-region').count()) {
          await candidate.screenshot({ path: testInfo.outputPath('palette-dedicated.png') });
          break;
        }
      }
      expectedTarget = target;
    }
    expectedProfiles = JSON.parse(JSON.stringify(saved.profiles));
  } finally {
    await app.close();
  }
  const persisted: unknown = JSON.parse(await readFile(join(settingsDir, 'desktop-surface.json'), 'utf8'));
  const boardPlacement = { preset: expectedTarget ? 'dedicated' : 'shared', target: expectedTarget, iconSpace: 25 };
  expect(persisted).toMatchObject({ boardPlacement, profiles: expectedProfiles });
  const restarted = await launch();
  try {
    await expect.poll(async () => {
      const workspace = restarted.windows().find(candidate => candidate.url().endsWith('/renderer/index.html'));
      return workspace?.evaluate(() => globalThis.window.electronP0.desktopSurface.read());
    }).toMatchObject({ boardPlacement, profiles: expectedProfiles });
  } finally {
    await restarted.close();
  }
});
