import type { Page } from '@playwright/test';
import { test, expect, state, act, shot } from './fixtures';

const preview = (page: Page) => page.getByRole('dialog', { name: '품의 표 복사 미리보기', exact: true });
const output = (page: Page) => page.getByRole('button', { name: '확인한 내용으로 출력', exact: true });
async function reviewed(page: Page): Promise<void> {
  for (const row of [1, 2]) await page.getByRole('button', { name: `${row}행 금액 불일치 확인`, exact: true }).click();
}
async function open(page: Page): Promise<void> {
  await page.getByRole('button', { name: '출력 미리보기', exact: true }).click();
  await expect(preview(page)).toBeVisible();
}

test('clipboard preview includes hidden selection and exact visible output row order', async ({ page }, info) => {
  await reviewed(page);
  await page.getByRole('button', { name: '1행 아래로 이동', exact: true }).click();
  await page.getByRole('button', { name: /^불일치\s*2$/ }).click();
  await open(page);
  const dialog = preview(page);
  await expect(dialog).toContainText('선택 3건 · 현재 필터에서 숨겨진 선택 1건 · 실제 출력 3행');
  const rows = dialog.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(dialog.locator('thead th')).toHaveText(['번호', '품명', '규격', '수량', '단가', '금액', '비고']);
  for (const [index, suffix] of ['B', 'A', 'C'].entries()) {
    await expect(rows.nth(index)).toContainText(`합성 품목 ${suffix}`);
    await expect(rows.nth(index).locator('td').first()).toHaveText(String(index + 1));
  }
  await expect(output(page)).toBeEnabled();
  await shot(page, info, 'clipboard-preview-hidden-selected-row-order');
});

test('no selection is explained and output remains disabled', async ({ page }, info) => {
  for (const row of [1, 2, 3]) await page.getByLabel(`${row}행 선택`, { exact: true }).uncheck();
  await open(page);
  await expect(preview(page).getByRole('alert')).toContainText('출력할 품목을 선택');
  await expect(preview(page).locator('tbody tr')).toHaveCount(0);
  await expect(output(page)).toBeDisabled();
  await shot(page, info, 'preview-no-selection-blocked');
});

test('unreviewed amount mismatch blocks preview output', async ({ page }, info) => {
  await open(page);
  await expect(preview(page).getByRole('alert')).toContainText('금액 불일치 2건');
  await expect(output(page)).toBeDisabled();
  await shot(page, info, 'preview-mismatch-blocked');
});

test('invalid selected quantity blocks preview output', async ({ page }, info) => {
  await reviewed(page);
  const input = page.getByLabel('1행 수량', { exact: true });
  await input.fill('-1');
  await input.press('Enter');
  await open(page);
  await expect(preview(page).getByRole('alert').filter({ hasText: '입력 오류' })).toHaveText('선택 품목 1건의 입력 오류를 확인해 주세요.');
  await expect(preview(page).getByRole('alert').filter({ hasText: '금액 불일치' })).toHaveText('금액 불일치 1건을 확인해 주세요.');
  await expect(output(page)).toBeDisabled();
  await shot(page, info, 'preview-invalid-amount-blocked');
});

test('owner append makes the frozen snapshot stale and disables output', async ({ page }, info) => {
  await reviewed(page);
  await open(page);
  await expect(output(page)).toBeEnabled();
  const rows = await preview(page).locator('tbody').innerText();
  await act(page, 'append');
  await expect(preview(page).getByRole('alert')).toContainText('변경되었습니다');
  await expect(output(page)).toBeDisabled();
  expect(await preview(page).locator('tbody').innerText()).toBe(rows);
  expect((await state(page)).items).toHaveLength(4);
  await shot(page, info, 'preview-stale-owner-append');
});

test('Escape and focus trap preserve the panel and restore preview trigger', async ({ page }, info) => {
  await reviewed(page);
  const trigger = page.getByRole('button', { name: '출력 미리보기', exact: true });
  await open(page);
  const close = preview(page).getByRole('button', { name: '미리보기 닫기', exact: true });
  await expect(close).toBeFocused();
  await close.press('Shift+Tab');
  await expect(output(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(preview(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('heading', { name: '품의 도우미', exact: true })).toBeVisible();
  await shot(page, info, 'preview-escape-focus-restoration');
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 980, height: 700 }]) {
  test(`preview long names and table stay reachable at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await reviewed(page);
    const name = '긴 합성 품목명 '.repeat(35);
    await page.getByRole('button', { name: '1행 품목명 전체 보기 및 수정', exact: true }).click();
    const input = page.getByLabel('1행 전체 품목명', { exact: true });
    await input.fill(name);
    await input.press('Control+Enter');
    await open(page);
    const dialog = preview(page);
    await expect(dialog.locator('tbody tr').first()).toContainText(name.trim());
    const region = dialog.getByRole('region', { name: '실제 출력 표', exact: true });
    await region.focus();
    await expect(region).toBeFocused();
    await expect(region).toBeInViewport();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
    await expect(output(page)).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await shot(page, info, 'responsive-preview-long-name');
  });
}

for (const [kind, title] of [['settlement-clipboard', '구매결과 표 복사 미리보기'], ['settlement-summary', '정산 요약 복사 미리보기']] as const) {
  test(`${kind} preview uses real settlement values without native IPC`, async ({ page }, info) => {
    await reviewed(page);
    await page.getByRole('tab', { name: '구매결과', exact: true }).click();
    await page.getByLabel('1행 실제 단가', { exact: true }).fill('15');
    await page.getByLabel('배송비', { exact: true }).fill('5');
    await page.getByLabel('정산 미리보기 출력 형식', { exact: true }).selectOption(kind);
    await page.getByRole('button', { name: '정산 출력 미리보기', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('상품 실제금액');
    await expect(dialog).toContainText('35원');
    await expect(dialog).toContainText('40원');
    if (kind === 'settlement-clipboard') {
      await expect(dialog.locator('tbody tr')).toHaveCount(3);
      await expect(dialog.locator('tbody tr').first()).toContainText('합성 품목 A');
    } else await expect(dialog.locator('tbody')).toContainText('40');
    await expect(output(page)).toBeEnabled();
    await shot(page, info, kind);
  });
}
