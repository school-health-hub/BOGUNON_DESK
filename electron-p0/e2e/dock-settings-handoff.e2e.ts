import { expect, test, _electron as electron } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

test('Palette and Workspace Dock settings return to the invoking surface', async () => {
  const temp = process.env.DOCK_SETTINGS_QA_TEMP;
  if (!temp) throw Error('Set DOCK_SETTINGS_QA_TEMP to an isolated temporary directory');
  await mkdir(temp, { recursive: true });
  const root = await mkdtemp(join(temp, 'profile-'));
  const runId = randomUUID();
  const userData = join(root, 'test-runs', runId, 'user-data');
  const settings = join(userData, 'poc-settings');
  await mkdir(settings, { recursive: true });
  await writeFile(join(settings, 'onboarding.json'), JSON.stringify({ version: 1, completed: true }));
  const app = await electron.launch({
    chromiumSandbox: true,
    args: [process.env.DOCK_SETTINGS_APP_ROOT ?? join(process.cwd(), 'build/electron-p0-app')],
    env: { ...process.env, RUNNER_TEMP: temp, ELECTRON_P0_QA_PROFILE: '1', ELECTRON_P0_QA_ROOT: root, ELECTRON_P0_TEST_RUN: runId, ELECTRON_P0_DEV_URL: '' },
  });
  try {
    await expect.poll(() => app.windows().filter(page => page.url().includes('/palette/')).length, { timeout: 30_000 }).toBeGreaterThan(0);
    const palettes = app.windows().filter(page => page.url().includes('/palette/'));
    await expect.poll(async () => (await Promise.all(palettes.map(page => page.locator('.palette-dock-region').isVisible()))).some(Boolean)).toBe(true);
    const palette = palettes[(await Promise.all(palettes.map(page => page.locator('.palette-dock-region').isVisible()))).findIndex(Boolean)];
    const workspace = app.windows().find(page => !page.url().includes('/palette/'));
    if (!palette || !workspace) throw Error('Palette or Workspace renderer unavailable');
    expect(await workspace.evaluate(() => Object.keys(window.electronP0).sort())).toEqual(['completeOnboarding', 'desktopSurface', 'info', 'onlineHealthRoom', 'onOpenSettings', 'onSettingsCloseRequested', 'onOpenTool', 'onToolCloseRequested', 'toolRendererReady', 'toolReady', 'toolDismissed', 'readSettings', 'settingsDismissed', 'settingsReady', 'updates', 'writeSettings'].sort());
    expect(await workspace.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe('undefined');
    await expect(palette.getByRole('main', { name: 'BOGUNON DESK 바탕화면 위젯' })).toBeVisible();
    await palette.getByRole('button', { name: '위젯 편집' }).click();
    const before = await palette.evaluate(() => window.electronPalette.readSurface());
    const savedSurface = await readFile(join(settings, 'desktop-surface.json'));
    const normalBounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(value => !value.webContents.getURL().includes('/palette/'))?.getNormalBounds());
    await palette.locator('.palette-dock-region [data-dock-item="settings"]').evaluate(button => button instanceof HTMLElement && button.click());
    const dialog = workspace.getByRole('dialog', { name: '설정', exact: true });
    await expect(dialog).toBeVisible();
    await expect.poll(async () => app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(value => !value.webContents.getURL().includes('/palette/'));
      return window ? { width: window.getBounds().width, height: window.getBounds().height, menu: window.isMenuBarVisible() } : null;
    })).toMatchObject({ width: expect.any(Number), height: expect.any(Number), menu: false });
    expect(await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(value => !value.webContents.getURL().includes('/palette/'));
      return window ? window.getBounds().width <= 860 && window.getBounds().height <= 760 : false;
    })).toBe(true);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(value => value.isVisible() && !value.webContents.getURL().includes('/palette/')).length)).toBe(1);
    expect(await dialog.evaluate(element => element.closest('.settings-window-surface') !== null)).toBe(true);
    await palette.evaluate(() => window.electronPalette.openSettings());
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(value => !value.webContents.getURL().includes('/palette/')).length)).toBe(1);
    await workspace.screenshot({ path: join(temp, process.env.DOCK_SETTINGS_APP_ROOT ? 'palette-dock-settings-before.png' : 'palette-dock-settings-new.png') });
    await expect(workspace.locator('.workspace-dashboard')).toBeHidden();
    await expect(workspace.locator('.dock-zone')).toBeHidden();
    await expect(palette.locator('.palette-dock-region')).toBeHidden();
    await expect(palette.locator('.palette-edit-controls')).toBeHidden();
    await workspace.screenshot({ path: join(temp, 'palette-dock-settings-after.png') });
    await dialog.getByRole('button', { name: '화이트', exact: true }).click();
    await expect.poll(async () => {
      const saved = await workspace.evaluate(() => window.electronP0.readSettings());
      return (saved?.dashboard as { appearance?: { background?: string } })?.appearance?.background;
    }).toBe('white');
    await workspace.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => !window.webContents.getURL().includes('/palette/'))?.isVisible())).toBe(false);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(value => !value.webContents.getURL().includes('/palette/'))?.getNormalBounds())).toEqual(normalBounds);
    await expect(palette.locator('.palette-dock-region')).toBeVisible();
    await expect(palette.getByRole('button', { name: '완료' })).toBeVisible();
    expect(await palette.evaluate(() => window.electronPalette.readSurface())).toEqual(before);
    expect(await readFile(join(settings, 'desktop-surface.json'))).toEqual(savedSurface);
    await palette.locator('.palette-dock-region [data-dock-item="settings"]').evaluate(button => button instanceof HTMLElement && button.click());
    await expect(workspace.getByRole('dialog', { name: '설정', exact: true })).toHaveCount(1);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => !window.webContents.getURL().includes('/palette/'))?.setContentSize(980, 700));
    expect(await dialog.evaluate(element => { const bounds = element.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight; })).toBe(true);
    await dialog.getByRole('button', { name: '학교 프로필' }).click();
    await expect(dialog.getByRole('region', { name: '학교 프로필', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: '앱 정보' }).click();
    await expect(dialog.getByRole('region', { name: '앱 업데이트' })).toBeVisible();
    await workspace.screenshot({ path: join(temp, 'palette-dock-settings-980x700.png') });
    await dialog.getByRole('button', { name: '설정 닫기' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(palette.locator('.palette-dock-region')).toBeVisible();
    await palette.getByRole('button', { name: '취소' }).click();
    await palette.evaluate(() => window.electronPalette.openWorkspace());
    await expect(workspace.locator('.workspace-dashboard')).toBeVisible();
    await expect(workspace.getByRole('dialog', { name: '학교 초기 설정' })).toHaveCount(0);
    await workspace.locator('.dock-zone [data-dock-item="settings"]').click();
    await expect(dialog).toBeVisible();
    await expect(workspace.locator('.workspace-dashboard')).toBeHidden();
    await expect(palette.locator('.palette-dock-region')).toBeHidden();
    await workspace.screenshot({ path: join(temp, 'workspace-dock-settings-after.png') });
    await dialog.getByRole('button', { name: '설정 닫기' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(workspace.locator('.workspace-dashboard')).toBeVisible();
    await expect(palette.locator('.palette-dock-region')).toBeVisible();
    await palette.evaluate(() => window.electronPalette.openSettings());
    await expect(dialog).toBeVisible();
    await palette.evaluate(() => window.electronPalette.openWorkspace());
    await expect(dialog).toHaveCount(0);
    await expect(workspace.locator('.workspace-dashboard')).toBeVisible();
    await workspace.locator('.dock-zone [data-dock-item="settings"]').click();
    await expect(workspace.getByRole('dialog', { name: '설정' })).toHaveCount(1);
    await workspace.keyboard.press('Escape');
    await expect(workspace.getByRole('dialog', { name: '설정' })).toHaveCount(0);
    await workspace.locator('.dock-zone [data-dock-item="settings"]').click();
    await expect(dialog).toBeVisible();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => !window.webContents.getURL().includes('/palette/'))?.close());
    await expect(dialog).toHaveCount(0);
    await expect(workspace.locator('.workspace-dashboard')).toBeVisible();
    const secondary = palettes.find(page => page !== palette);
    if (secondary) {
      await secondary.evaluate(() => window.electronPalette.setDockMonitor());
      await expect(secondary.locator('.palette-dock-region')).toBeVisible();
      const position = await secondary.evaluate(() => ({ x: window.screenX, y: window.screenY, width: innerWidth, height: innerHeight }));
      await secondary.evaluate(() => window.electronPalette.openSettings());
      await expect(dialog).toBeVisible();
      const bounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(value => !value.webContents.getURL().includes('/palette/'))?.getBounds());
      if (!bounds) throw Error('Settings window unavailable');
      expect(bounds.x).toBeGreaterThanOrEqual(position.x);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(position.x + position.width);
      expect(bounds.y).toBeGreaterThanOrEqual(position.y);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(position.y + position.height);
      await workspace.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
    expect(JSON.parse(await readFile(join(settings, 'onboarding.json'), 'utf8'))).toEqual({ version: 1, completed: true });
  } finally { await app.close(); }
});
