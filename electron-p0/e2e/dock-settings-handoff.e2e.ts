import { expect, test, _electron as electron, type Page } from '@playwright/test';
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
    const palette = app.windows().find(page => page.url().includes('/palette/')) as Page;
    const workspace = app.windows().find(page => !page.url().includes('/palette/')) as Page;
    expect(await workspace.evaluate(() => Object.keys(window.electronP0).sort())).toEqual(['completeOnboarding', 'desktopSurface', 'info', 'onOpenSettings', 'readSettings', 'settingsDismissed', 'settingsReady', 'writeSettings'].sort());
    expect(await workspace.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe('undefined');
    await expect(palette.getByRole('main', { name: 'BOGUNON DESK 바탕화면 위젯' })).toBeVisible();
    await palette.getByRole('button', { name: '위젯 편집' }).click();
    const before = await palette.evaluate(() => window.electronPalette.readSurface());
    const savedSurface = await readFile(join(settings, 'desktop-surface.json'));
    await palette.locator('.palette-dock-region [data-dock-item="settings"]').click();
    const dialog = workspace.getByRole('dialog', { name: '설정', exact: true });
    await expect(dialog).toBeVisible();
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
    await expect(palette.locator('.palette-dock-region')).toBeVisible();
    await expect(palette.getByRole('button', { name: '완료' })).toBeVisible();
    expect(await palette.evaluate(() => window.electronPalette.readSurface())).toEqual(before);
    expect(await readFile(join(settings, 'desktop-surface.json'))).toEqual(savedSurface);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => !window.webContents.getURL().includes('/palette/'))?.setContentSize(980, 700));
    await palette.locator('.palette-dock-region [data-dock-item="settings"]').click();
    await expect(workspace.getByRole('dialog', { name: '설정', exact: true })).toHaveCount(1);
    expect(await dialog.evaluate(element => { const bounds = element.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight; })).toBe(true);
    await workspace.screenshot({ path: join(temp, 'palette-dock-settings-980x700.png') });
    await dialog.getByRole('button', { name: '설정 닫기' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(palette.locator('.palette-dock-region')).toBeVisible();
    await palette.getByRole('button', { name: '취소' }).click();
    await palette.evaluate(() => window.electronPalette.openWorkspace());
    await expect(workspace.locator('.workspace-dashboard')).toBeVisible();
    const schoolSetup = workspace.getByRole('dialog', { name: '학교 초기 설정' });
    await expect(schoolSetup).toBeVisible();
    await schoolSetup.getByRole('button', { name: '나중에 설정' }).click();
    await workspace.locator('.dock-zone [data-dock-item="settings"]').click();
    await expect(dialog).toBeVisible();
    await expect(workspace.locator('.workspace-dashboard')).toBeVisible();
    await expect(palette.locator('.palette-dock-region')).toBeHidden();
    await workspace.screenshot({ path: join(temp, 'workspace-dock-settings-after.png') });
    await dialog.getByRole('button', { name: '설정 닫기' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(workspace.locator('.workspace-dashboard')).toBeVisible();
    await expect(palette.locator('.palette-dock-region')).toBeVisible();
    await workspace.locator('.dock-zone [data-dock-item="settings"]').click();
    await expect(workspace.getByRole('dialog', { name: '설정' })).toHaveCount(1);
    await workspace.keyboard.press('Escape');
    await expect(workspace.getByRole('dialog', { name: '설정' })).toHaveCount(0);
    expect(JSON.parse(await readFile(join(settings, 'onboarding.json'), 'utf8'))).toEqual({ version: 1, completed: true });
  } finally { await app.close(); }
});
