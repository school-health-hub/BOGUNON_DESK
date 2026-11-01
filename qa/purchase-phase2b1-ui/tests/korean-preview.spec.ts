import type { Locator, Page } from '@playwright/test';
import { test, expect, state, shot } from './fixtures';

const taxCases = [
  { mode: 'unspecified', label: '세액 미지정' },
  { mode: 'included', label: '세액 포함' },
  { mode: 'excluded', label: '세액 별도' },
  { mode: 'exempt', label: '면세' },
] as const;
const output = (dialog: Locator) => dialog.getByRole('button', { name: '확인한 내용으로 출력', exact: true });
const guidance = (dialog: Locator, name: string) => dialog.locator('.purchase-output-preview-summary > div').filter({ hasText: name }).locator('dd');
async function prepareSettlement(page: Page): Promise<void> {
  for (const row of [1, 2]) await page.getByRole('button', { name: `${row}행 금액 불일치 확인`, exact: true }).click();
  await page.getByRole('tab', { name: '구매결과', exact: true }).click();
  await page.getByLabel('1행 실제 단가', { exact: true }).fill('15');
  await page.getByLabel('배송비', { exact: true }).fill('5');
}

for (const { mode, label } of taxCases) {
  test(`Korean preview tax label ${mode} preserves mode and legacy output contract`, async ({ page }, info) => {
    await prepareSettlement(page);
    const selector = page.getByLabel('부가세 처리', { exact: true });
    await selector.selectOption(mode);
    if (mode === 'included' || mode === 'excluded') await page.getByLabel('명시 세액', { exact: true }).fill('3');
    await expect(selector).toHaveValue(mode);
    await expect(selector.locator('option:checked')).toHaveText(label);
    const before = (await state(page)).items;
    await page.getByRole('button', { name: '정산 출력 미리보기', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '구매결과 표 복사 미리보기', exact: true });
    await expect(dialog).toBeVisible();
    await expect(guidance(dialog, '세액 처리')).toContainText(label);
    expect(await dialog.innerText()).not.toMatch(/\b(?:unspecified|included|excluded|exempt)\b/);
    await expect(guidance(dialog, '상품 실제금액')).toHaveText('35원');
    await expect(guidance(dialog, '기존 정산 출력 금액')).toHaveText('40원');
    await expect(guidance(dialog, '화면 최종금액')).toHaveText(mode === 'excluded' ? '43원' : '40원');
    await expect(guidance(dialog, '별도 부가세 적용액')).toHaveText(mode === 'excluded' ? '3원' : '0원');
    if (mode === 'excluded') {
      await expect(dialog.getByRole('alert')).toContainText('별도 부가세');
      await expect(output(dialog)).toBeDisabled();
      await expect(dialog.locator('tbody tr')).toHaveCount(0);
    } else {
      await expect(dialog.locator('thead th')).toHaveText(['품명', '품의수량', '실제수량', '품의단가', '실제단가', '실제금액', '비고']);
      await expect(dialog.locator('tbody tr')).toHaveCount(3);
      await expect(dialog.locator('tbody tr').first().locator('td')).toHaveText(['합성 품목 A', '1', '1', '10', '15', '15', '']);
      await expect(output(dialog)).toBeEnabled();
    }
    await shot(page, info, `korean-tax-${mode}`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '정산 출력 미리보기', exact: true })).toBeFocused();
    await expect(selector).toHaveValue(mode);
    if (mode === 'included' || mode === 'excluded') await expect(page.getByLabel('명시 세액', { exact: true })).toHaveValue('3');
    await expect(page.getByLabel('1행 실제 단가', { exact: true })).toHaveValue('15');
    await expect(page.getByLabel('배송비', { exact: true })).toHaveValue('5');
    expect((await state(page)).items).toEqual(before);
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 980, height: 700 }]) {
  test(`Korean guidance keeps words intact and table scroll/focus survives ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    for (const row of [1, 2]) await page.getByRole('button', { name: `${row}행 금액 불일치 확인`, exact: true }).click();
    const longName = '긴 한국어 품목명 화면 확인 '.repeat(60).trim();
    await page.getByRole('button', { name: '1행 품목명 전체 보기 및 수정', exact: true }).click();
    const editor = page.getByLabel('1행 전체 품목명', { exact: true });
    await editor.fill(longName);
    await editor.press('Control+Enter');
    const trigger = page.getByRole('button', { name: '출력 미리보기', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '품의 표 복사 미리보기', exact: true });
    await expect(dialog).toBeVisible();
    const explanation = guidance(dialog, '클립보드 기준');
    await expect(explanation).toHaveCSS('word-break', 'keep-all');
    await expect(explanation).toHaveCSS('overflow-wrap', 'anywhere');
    const words = await explanation.evaluate(element => {
      const node = element.firstChild;
      if (!(node instanceof Text)) throw new Error('Expected real guidance text node');
      const available = element.getBoundingClientRect().width;
      return Array.from(node.data.matchAll(/[가-힣]{3,}/g)).map(match => {
        const tops: number[] = [];
        let width = 0;
        for (let index = 0; index < match[0].length; index++) {
          const range = document.createRange();
          range.setStart(node, match.index + index);
          range.setEnd(node, match.index + index + 1);
          const bounds = range.getBoundingClientRect();
          width += bounds.width;
          tops.push(Math.round(bounds.top));
        }
        return { word: match[0], lines: new Set(tops).size, fits: width <= available };
      });
    });
    expect(words.filter(word => word.fits).length).toBeGreaterThan(0);
    for (const word of words.filter(word => word.fits)) expect(word.lines, word.word).toBe(1);
    await expect(dialog.locator('caption')).toContainText('실제 출력 3행');
    await expect(dialog.locator('tbody tr').first()).toContainText(longName);
    await expect(dialog.locator('tbody tr').first().locator('td').nth(1)).toHaveCSS('white-space', 'pre-wrap');
    const region = dialog.getByRole('region', { name: '실제 출력 표', exact: true });
    await region.focus();
    await expect(region).toBeFocused();
    expect(await region.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await dialog.locator('tbody tr').last().scrollIntoViewIfNeeded();
    await expect(dialog.locator('tbody tr').last()).toBeInViewport();
    await expect(output(dialog)).toBeInViewport();
    await expect(output(dialog)).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
    await shot(page, info, 'korean-guidance-responsive-scroll');
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  });
}
