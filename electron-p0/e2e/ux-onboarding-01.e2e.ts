import { expect, test, _electron as electron } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

test('first-run guide, account review, and repeat launch stay within an isolated profile', async () => {
  const base = process.env.UX_ONBOARDING_QA_TEMP;
  if (!base) throw Error('Set UX_ONBOARDING_QA_TEMP to an isolated temporary directory');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, 'profile-'));
  const evidence = join(base, 'evidence');
  await mkdir(evidence, { recursive: true });
  const id = randomUUID();
  const launch = (runId = id) => electron.launch({
    chromiumSandbox: true,
    args: [join(process.cwd(), 'build/electron-p0-app')],
    env: { ...process.env, RUNNER_TEMP: base, ELECTRON_P0_QA_PROFILE: '1', ELECTRON_P0_QA_ROOT: root, ELECTRON_P0_TEST_RUN: runId, ELECTRON_P0_DEV_URL: '' },
  });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const guide = page.getByRole('dialog', { name: 'BOGUNON DESK 시작 안내' });
    await expect(guide).toBeVisible({ timeout: 20_000 });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => !window.webContents.getURL().includes('/palette/'))?.setContentSize(980, 700));
    await page.screenshot({ path: join(evidence, 'first-run-welcome-980x700.png') });
    await guide.getByRole('button', { name: '다음' }).click();
    await page.screenshot({ path: join(evidence, 'first-run-mode-980x700.png') });
    await guide.getByRole('button', { name: /^Workspace/ }).click();
    await guide.getByRole('button', { name: '다음' }).click();
    await page.screenshot({ path: join(evidence, 'first-run-account-980x700.png') });
    await guide.getByRole('button', { name: '다음' }).click();
    await expect(guide.getByText(/준비가 끝났습니다/)).toBeVisible();
    expect(await guide.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await guide.getByRole('button', { name: 'BOGUNON DESK 시작하기' }).click();
    await expect(guide).toHaveCount(0);
    const marker = join(root, 'test-runs', id, 'user-data', 'poc-settings', 'onboarding.json');
    expect(JSON.parse(await readFile(marker, 'utf8'))).toEqual({ version: 1, completed: true });
    await page.getByRole('button', { name: '설정', exact: true }).click();
    const settings = page.getByRole('dialog', { name: '설정' });
    await settings.getByRole('button', { name: '학교 프로필' }).click();
    await expect(settings.getByText(/이 PC에서 사용할 학교 정보를 설정합니다/)).toBeVisible();
    await page.screenshot({ path: join(evidence, 'school-settings-980x700.png') });
    await app.evaluate(({ BrowserWindow }) => {
      const workspace = BrowserWindow.getAllWindows().find(window => !window.webContents.getURL().includes('/palette/'));
      workspace?.webContents.send('p2:account:review', { id: 'synthetic-review', kind: 'signIn', message: 'internal', detail: 'internal' });
    });
    const review = page.getByRole('dialog', { name: 'BOGUNON 계정 연결' });
    await expect(review).toBeVisible();
    await expect(review.getByRole('button', { name: 'Google 계정으로 연결하기' })).toBeVisible();
    expect(await review.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight; })).toBe(true);
    await page.screenshot({ path: join(evidence, 'account-review-980x700.png') });
    await page.keyboard.press('Escape');
    await expect(review).toHaveCount(0);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await expect(page.getByRole('dialog', { name: 'BOGUNON DESK 시작 안내' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '주요 기능' })).toBeVisible();
    await app.close();
    const legacyId = randomUUID();
    const existingSettings = await readFile(join(root, 'test-runs', id, 'user-data', 'poc-settings', 'layout.json'));
    const legacySettingsDir = join(root, 'test-runs', legacyId, 'user-data', 'poc-settings');
    await mkdir(legacySettingsDir, { recursive: true });
    await writeFile(join(legacySettingsDir, 'layout.json'), existingSettings);
    app = await launch(legacyId);
    page = await app.firstWindow();
    await expect(page.getByRole('dialog', { name: 'BOGUNON DESK 시작 안내' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '주요 기능' })).toBeVisible();
    expect(await readFile(join(legacySettingsDir, 'layout.json'))).toEqual(existingSettings);
    expect(JSON.parse(await readFile(join(legacySettingsDir, 'onboarding.json'), 'utf8'))).toEqual({ version: 1, completed: true });
    expect(pageErrors).toEqual([]);
  } finally { await app.close(); }
});
