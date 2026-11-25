import { expect, test, _electron as electron } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { createNewsletterProject } from '../../src/newsletter/project';
import { createNewsletterDesignState } from '../../src/newsletter/rendering/designSchema';
import { upgradeNewsletterDesignStateV2 } from '../../src/newsletter/rendering/designState';

test('synthetic newsletter creates actual A4 PNG and PDF', async () => {
  test.setTimeout(240000);
  const evidence = process.env.UX_CLEANUP_EVIDENCE;
  if (!evidence) throw Error('UX_CLEANUP_EVIDENCE is required');
  await mkdir(evidence, { recursive: true });
  const root = await mkdtemp(join(tmpdir(), 'bogunon-ux-cleanup-03-'));
  const runId = randomUUID();
  const settings = join(root, 'test-runs', runId, 'user-data', 'poc-settings');
  await mkdir(settings, { recursive: true });
  await writeFile(join(settings, 'onboarding.json'), JSON.stringify({ version: 1, completed: true }));
  const app = await electron.launch({
    ...(process.platform === 'win32' ? {
      executablePath: createRequire(import.meta.url).resolve('electron/package.json').replace(/package\.json$/u, 'dist/electron.exe'),
    } : {}),
    chromiumSandbox: true,
    args: [join(process.cwd(), 'build/electron-p0-app')],
    env: { ...process.env, ELECTRON_P0_QA_PROFILE: '1', ELECTRON_P0_QA_ROOT: root, ELECTRON_P0_TEST_RUN: runId, ELECTRON_P0_DEV_URL: '' },
  });
  try {
    await expect.poll(() => app.windows().some(page => page.url().includes('/palette/'))).toBe(true);
    const palette = app.windows().find(page => page.url().includes('/palette/'));
    const workspace = app.windows().find(page => !page.url().includes('/palette/'));
    if (!palette || !workspace) throw Error('Expected Palette and Workspace windows');
    await palette.locator('.palette-dock-region [data-dock-item="toolbox"]').evaluate(button => (button as HTMLElement).click());
    await palette.getByRole('button', { name: '보건소식지 제작소 열기' }).evaluate(button => (button as HTMLElement).click());
    await expect(workspace.getByRole('region', { name: '보건소식지 제작소' })).toBeVisible();
    const contentSize=await app.evaluate(({BrowserWindow},url)=>{const owner=BrowserWindow.getAllWindows().find(window=>window.webContents.getURL()===url);owner?.setContentSize(900,680);return owner?.getContentSize();},workspace.url());
    expect(contentSize).toEqual([900,680]);

    const now = '2026-11-25T00:00:00.000Z';
    const project = await createNewsletterProject({ projectId: 'ux-cleanup-03-output', title: '합성 보건소식지', now });
    const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now);
    const pngBase64 = await workspace.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 2; canvas.height = 2;
      const context = canvas.getContext('2d');
      if (!context) throw Error('Canvas unavailable');
      context.fillStyle = '#286c60'; context.fillRect(0, 0, 2, 2);
      return canvas.toDataURL('image/png').split(',')[1] ?? '';
    });
    const png = Buffer.from(pngBase64, 'base64');
    const sha = createHash('sha256').update(png).digest('hex');
    const asset = { id: 'synthetic-approved', sha256: sha, mediaType: 'image/png' as const, approvalStatus: 'approved' as const, exportApproval: 'approved' as const, originalName: 'synthetic-approved.png', localReference: `asset:${sha}`, registry: { classification: 'USER_CREATED' as const, purpose: 'illustration' as const, usageScope: 'newsletter-output' as const } };
    const cardLayouts = design.cardLayouts.map((card, index) => index === 0 ? { ...card, image: { ...card.image, assetId: asset.id } } : card);
    const approved = { ...design, assetManifest: [asset], cardLayouts, revisionHistory: design.revisionHistory.map(entry => entry.revision === design.designRevision ? { ...entry, snapshot: { ...entry.snapshot, assetManifest: [asset], cardLayouts } } : entry) };
    await workspace.getByLabel('원고·디자인 작업 파일 열기').setInputFiles({ name: 'synthetic-approved.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ project, design: approved })) });
    await workspace.getByLabel('이미지 원본 연결').setInputFiles({ name: 'synthetic-approved.png', mimeType: 'image/png', buffer: png });
    const exportButton = workspace.getByRole('button', { name: '출력 위치 선택·저장' });
    await expect(exportButton).toBeEnabled();
    const canceledDestination=join(evidence,`newsletter-canceled-${runId}.png`);
    await app.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});},canceledDestination);
    const confirmation = async () => {
      await expect.poll(() => app.windows().some(page => page.url().startsWith('data:text/html')),{timeout:120000}).toBe(true);
      const page=app.windows().find(page => page.url().startsWith('data:text/html'));
      if (!page) throw Error('Expected Main-owned confirmation window');
      await expect(page.getByRole('dialog',{name:'보건소식지 저장'})).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/synthetic-approved|SHA|revision|scene/i);
      return page;
    };
    await workspace.getByLabel('출력 형식').selectOption('a4-png');
    await exportButton.click();
    const canceled=await confirmation();
    await canceled.screenshot({path:join(evidence,'newsletter-confirmation-before-save.png')});
    await expect(canceled.getByRole('button',{name:'취소'})).toBeFocused();
    await canceled.keyboard.press('Shift+Tab');
    await expect(canceled.getByRole('button',{name:'닫기'})).toBeFocused();
    await canceled.keyboard.press('Shift+Tab');
    await expect(canceled.getByRole('button',{name:'저장하기'})).toBeFocused();
    await canceled.keyboard.press('Tab');
    await expect(canceled.getByRole('button',{name:'닫기'})).toBeFocused();
    await canceled.keyboard.press('Tab');
    await expect(canceled.getByRole('button',{name:'취소'})).toBeFocused();
    await canceled.keyboard.press('Escape').catch(error=>{if(!canceled.isClosed())throw error;});
    await expect.poll(async()=>app.windows().some(page=>page.url().startsWith('data:text/html'))).toBe(false);
    expect(await stat(canceledDestination).then(()=>true,()=>false)).toBe(false);
    await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getFocusedWindow()?.webContents.getURL())).toBe(workspace.url());
    await exportButton.click();
    const closed=await confirmation();
    await closed.getByRole('button',{name:'닫기'}).click();
    await expect.poll(async()=>app.windows().some(page=>page.url().startsWith('data:text/html'))).toBe(false);
    expect(await stat(canceledDestination).then(()=>true,()=>false)).toBe(false);
    for (const selection of ['a4-png', 'a4-pdf'] as const) {
      const destination = join(evidence, selection === 'a4-png' ? `newsletter-output-${runId}.png` : `newsletter-output-${runId}.pdf`);
      await app.evaluate(({ dialog }, path) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
      }, destination);
      await workspace.getByLabel('출력 형식').selectOption(selection);
      await exportButton.click();
      const review=await confirmation();
      await review.getByRole('button',{name:'저장하기'}).focus();
      await review.keyboard.press('Enter').catch(error=>{if(!review.isClosed())throw error;});
      await expect(workspace.locator('[data-export-status]')).toContainText('출력물을 저장했습니다.', { timeout: 120000 });
      const bytes = await readFile(destination);
      if (selection === 'a4-png') {
        expect(bytes.readUInt32BE(16)).toBe(2480);
        expect(bytes.readUInt32BE(20)).toBe(3508);
      } else {
        const pdf = await PDFDocument.load(bytes);
        expect(pdf.getPageCount()).toBe(1);
      }
      await writeFile(join(evidence, `${selection}-sha256.txt`), `${selection} ${bytes.length} ${createHash('sha256').update(bytes).digest('hex')}\n`);
    }
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
