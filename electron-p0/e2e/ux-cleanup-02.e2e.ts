import { expect, test, _electron as electron } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('settings and newsletter copy stay usable in compact Windows windows', async () => {
  test.setTimeout(180000);
  const evidence = process.env.UX_CLEANUP_EVIDENCE;
  if (!evidence) throw Error('UX_CLEANUP_EVIDENCE is required');
  await mkdir(evidence, { recursive: true });
  const root = await mkdtemp(join(tmpdir(), 'bogunon-ux-cleanup-02-'));
  const runId = randomUUID();
  const settings = join(root, 'test-runs', runId, 'user-data', 'poc-settings');
  await mkdir(settings, { recursive: true });
  await writeFile(join(settings, 'onboarding.json'), JSON.stringify({ version: 1, completed: true }));
  const app = await electron.launch({
    chromiumSandbox: true,
    args: [join(process.cwd(), 'build/electron-p0-app')],
    env: { ...process.env, ELECTRON_P0_QA_PROFILE: '1', ELECTRON_P0_QA_ROOT: root, ELECTRON_P0_TEST_RUN: runId, ELECTRON_P0_DEV_URL: '' },
  });
  try {
    await expect.poll(() => app.windows().some(page => page.url().includes('/palette/'))).toBe(true);
    const palette = app.windows().find(page => page.url().includes('/palette/'));
    const workspace = app.windows().find(page => !page.url().includes('/palette/'));
    if (!palette || !workspace) throw Error('Expected Palette and Workspace windows');
    await palette.locator('.palette-dock-region [data-dock-item="settings"]').evaluate(button => (button as HTMLElement).click());
    const dialog = workspace.getByRole('dialog', { name: '설정', exact: true });
    await expect(dialog).toBeVisible();
    for (const [width, height] of [[980, 700], [900, 680]] as const) {
      await workspace.setViewportSize({ width, height });
      for (const name of ['화면', '위젯', 'Dock', '앱 정보', '학교 프로필', 'AI 연결']) {
        await dialog.getByRole('button', { name, exact: true }).click();
        await expect(dialog).toBeVisible();
        await workspace.screenshot({ path: join(evidence, `settings-${name.replaceAll(' ', '-')}-${width}x${height}.png`) });
      }
      await expect(dialog.getByText('설정 준비됨')).toHaveCount(0);
      await expect(dialog.getByRole('button', { name: '합성 텍스트 요청 · 전송 전 확인' })).toHaveCount(0);
    }
    await dialog.getByRole('button', { name: '설정 닫기' }).click();
    await palette.locator('.palette-dock-region [data-dock-item="toolbox"]').evaluate(button => (button as HTMLElement).click());
    await palette.getByRole('button', { name: '보건소식지 제작소 열기' }).evaluate(button => (button as HTMLElement).click());
    await expect(workspace.getByRole('region', { name: '보건소식지 제작소' })).toBeVisible();
    await workspace.getByRole('button', { name: '새 소식지 작성' }).click();
    await workspace.getByLabel('작성 월').fill('2026-11');
    await workspace.getByRole('button', { name: '새 소식지 만들기' }).click();
    await expect(workspace.getByRole('heading', { name: '보건소식지 디자인 편집기' })).toBeVisible();
    await workspace.screenshot({ path: join(evidence, 'newsletter-editor-900x680.png') });
    await workspace.getByRole('heading', { name: '보건소식지 디자인 편집기' }).scrollIntoViewIfNeeded();
    await workspace.screenshot({ path: join(evidence, 'newsletter-design-900x680.png') });
    await workspace.getByText('PNG·PDF 출력', { exact: true }).scrollIntoViewIfNeeded();
    await workspace.screenshot({ path: join(evidence, 'newsletter-output-900x680.png') });
    await expect(workspace.getByText('NEWSLETTER STUDIO · NS-3E')).toHaveCount(0);
    await expect(workspace.getByText('조판 검증')).toHaveCount(0);

  } finally {
    await app.close();
  }
});
