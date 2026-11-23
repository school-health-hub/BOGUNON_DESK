import { expect, test, _electron as electron, type ElectronApplication } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';

test('first-run guide and Dock settings never stack, then return to Palette', async () => {
  const temp = process.env.UX_FINAL_QA_TEMP;
  if (!temp) throw Error('Set UX_FINAL_QA_TEMP to an isolated temporary directory');
  await mkdir(temp, { recursive: true });
  const root = await mkdtemp(join(temp, 'profile-'));
  const runId = randomUUID();
  const launch = (): Promise<ElectronApplication> => electron.launch({
    chromiumSandbox: true,
    args: [join(process.cwd(), 'build/electron-p0-app')],
    env: { ...process.env, RUNNER_TEMP: temp, ELECTRON_P0_QA_PROFILE: '1', ELECTRON_P0_QA_ROOT: root, ELECTRON_P0_TEST_RUN: runId, ELECTRON_P0_DEV_URL: '' },
  });
  let app = await launch();
  try {
    let workspace = app.windows().find(page => !page.url().includes('/palette/')) ?? await app.firstWindow();
    const guide = workspace.getByRole('dialog', { name: 'BOGUNON DESK 시작 안내' });
    await expect(guide).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => app.windows().filter(page => page.url().includes('/palette/')).length).toBeGreaterThan(0);
    let palette = app.windows().find(page => page.url().includes('/palette/'))!;
    await palette.evaluate(() => window.electronPalette.openSettings());
    await expect(guide).toBeVisible();
    await expect(workspace.getByRole('dialog', { name: '설정', exact: true })).toHaveCount(0);
    await expect(palette.locator('.palette-dock-region')).toBeVisible();
    await workspace.screenshot({ path: join(temp, 'first-run-no-settings-overlap.png') });
    await guide.getByRole('button', { name: '다음' }).click();
    await guide.getByRole('button', { name: '다음' }).click();
    await guide.getByRole('button', { name: '다음' }).click();
    await guide.getByRole('button', { name: 'BOGUNON DESK 시작하기' }).click();
    await expect(guide).toHaveCount(0);
    const marker = join(root, 'test-runs', runId, 'user-data', 'poc-settings', 'onboarding.json');
    expect(JSON.parse(await readFile(marker, 'utf8'))).toEqual({ version: 1, completed: true });
    await palette.locator('.palette-dock-region [data-dock-item="settings"]').click();
    const settings = workspace.getByRole('dialog', { name: '설정', exact: true });
    await expect(settings).toBeVisible();
    await expect(workspace.getByRole('dialog', { name: 'BOGUNON DESK 시작 안내' })).toHaveCount(0);
    await expect(workspace.locator('.workspace-dashboard')).toBeHidden();
    await workspace.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);
    await expect(palette.locator('.palette-dock-region')).toBeVisible();
    await app.close();
    app = await launch();
    workspace = app.windows().find(page => !page.url().includes('/palette/')) ?? await app.firstWindow();
    await expect(workspace.getByRole('dialog', { name: 'BOGUNON DESK 시작 안내' })).toHaveCount(0);
    await expect.poll(() => app.windows().filter(page => page.url().includes('/palette/')).length).toBeGreaterThan(0);
    palette = app.windows().find(page => page.url().includes('/palette/'))!;
    await expect(palette.locator('.palette-dock-region')).toBeVisible();
  } finally { await app.close(); }
});
