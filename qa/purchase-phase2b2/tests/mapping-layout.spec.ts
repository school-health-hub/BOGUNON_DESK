import { test, expect, shot, dialog, openMapping, applyMapping } from './mapping-helpers';

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 980, height: 700 }]) {
  test(`mapping Korean reasons details keyboard and controls stay reachable at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await openMapping(page);
    const mapping = dialog(page);
    const close = mapping.getByRole('button', { name: '열 지정 닫기', exact: true });
    await expect(close).toBeFocused();
    await close.press('Shift+Tab');
    await expect(applyMapping(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    const details = mapping.locator('details');
    expect(await details.count()).toBeGreaterThan(0);
    for (const entry of await details.all()) {
      const summary = entry.locator('summary');
      await summary.focus();
      await summary.press('Enter');
      await expect(entry).toHaveAttribute('open', '');
      for (const reason of await entry.locator('li').all()) expect(await reason.innerText()).toMatch(/[가-힣]/u);
    }
    await mapping.getByLabel('원본 데이터 미리보기', { exact: true }).focus();
    await expect(mapping.getByLabel('원본 데이터 미리보기', { exact: true })).toBeFocused();
    await mapping.getByLabel('원본 데이터 미리보기', { exact: true }).press('ArrowRight');
    await shot(page, info, 'mapping-expanded-korean-reasons-original-data');
    await applyMapping(page).scrollIntoViewIfNeeded();
    await expect(applyMapping(page)).toBeInViewport();
    await expect(applyMapping(page)).toBeEnabled();
    const bounds = await mapping.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await shot(page, info, 'mapping-expanded-footer-reachable');
    await page.keyboard.press('Escape');
    await expect(mapping).toHaveCount(0);
    await expect(page.getByRole('button', { name: '열 지정', exact: true })).toBeFocused();
    await expect(page.getByRole('heading', { name: '품의 도우미', exact: true })).toBeVisible();
  });
}
