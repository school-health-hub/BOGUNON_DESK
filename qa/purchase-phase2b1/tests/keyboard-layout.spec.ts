import { test, expect, state, act, review, shot, undo } from './fixtures';
for (const key of ['Enter', 'Tab', 'Shift+Tab', 'Escape']) {
  test(`inline ${key} has real focus and commit behavior`, async ({ page }, info) => {
    const input = page.getByLabel('1행 구매처', { exact: true });
    await input.fill('키보드 구매처');
    const before = (await state(page)).revision;
    await input.press(key);
    await expect(input).toHaveValue(key === 'Escape' ? '구매처 A' : '키보드 구매처');
    expect((await state(page)).revision).toBe(before + (key === 'Escape' ? 0 : 1));
    if (key === 'Tab') await expect(page.getByLabel('1행 비고', { exact: true })).toBeFocused();
    if (key === 'Shift+Tab') await expect(page.getByRole('button', { name: '1행 금액 불일치 확인', exact: true })).toBeFocused();
    if (key === 'Enter' || key === 'Escape') await expect(input).toBeFocused();
    await shot(page, info, `inline-${key.replace('+', '-')}`);
  });
}
test('long name Enter inserts newline and Ctrl Enter saves with focus restoration', async ({ page }, info) => {
  const trigger = page.getByRole('button', { name: '1행 품목명 전체 보기 및 수정', exact: true });
  await trigger.click();
  const input = page.getByLabel('1행 전체 품목명', { exact: true });
  await expect(input).toBeFocused();
  await input.fill('긴 합성 품목명 '.repeat(20));
  await input.press('End');
  await input.press('Enter');
  await input.press('X');
  await expect(input).toHaveValue(/\nX$/);
  const expected = await input.inputValue();
  await shot(page, info, 'long-name-multiline');
  await input.press('Control+Enter');
  await expect(page.getByRole('dialog', { name: '품목명 전체 보기 및 수정', exact: true })).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect((await state(page)).items[0]?.name).toBe(expected.trim());
});
for (const cancel of ['Escape', 'button']) {
  test(`long name ${cancel} cancels and restores focus`, async ({ page }) => {
    const trigger = page.getByRole('button', { name: '1행 품목명 전체 보기 및 수정', exact: true });
    await trigger.click();
    const input = page.getByLabel('1행 전체 품목명', { exact: true });
    await input.fill('저장하지 않을 이름');
    if (cancel === 'Escape') await input.press('Escape');
    else await page.getByRole('dialog', { name: '품목명 전체 보기 및 수정', exact: true }).getByRole('button', { name: '취소', exact: true }).click();
    await expect(page.getByLabel('1행 품명', { exact: true })).toHaveValue('합성 품목 A');
    await expect(trigger).toBeFocused();
  });
}
test('bulk dialog traps Tab and Shift Tab and Escape restores trigger', async ({ page }, info) => {
  const trigger = page.getByRole('button', { name: '선택 품목 일괄 편집', exact: true });
  await trigger.click();
  const first = page.getByLabel('구매처 처리 방식');
  await expect(first).toBeFocused();
  const close = page.getByRole('button', { name: '일괄 편집 취소', exact: true });
  await close.focus();
  await close.press('Shift+Tab');
  await expect(page.getByRole('dialog', { name: '선택 품목 일괄 편집', exact: true }).getByRole('button', { name: '취소', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await shot(page, info, 'bulk-cancel-restored-focus');
});
for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 980, height: 700 }]) {
  test(`layout and last-row controls remain reachable at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await act(page, 'many');
    await expect(page.getByLabel('30행 품명', { exact: true })).toHaveCount(1);
    const original = (await state(page)).items;
    const last = page.getByRole('button', { name: '30행 삭제', exact: true });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await expect(last).toBeEnabled();
    const table = page.locator('.purchase-helper-table-wrap');
    if (viewport.width <= 1024) expect(await table.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    const hint = page.locator('tbody tr').last().locator('small').first();
    await hint.scrollIntoViewIfNeeded();
    await expect(hint).toBeInViewport();
    await expect(hint).not.toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await shot(page, info, 'last-row-horizontal-scroll');
    await review(page);
    const dialog = page.getByRole('dialog', { name: '선택 품목 일괄 편집', exact: true });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
    await expect(dialog.getByRole('button', { name: /개 품목에 적용$/ })).toBeInViewport();
    await shot(page, info, 'responsive-review-dialog');
    await dialog.getByRole('button', { name: /개 품목에 적용$/ }).click();
    expect((await state(page)).items.map(item => item.vendor)).toEqual(Array(30).fill('공통 구매처'));
    expect((await state(page)).items.map(item => item.budgetItem)).toEqual(original.map(item => item.budgetItem));
    await expect(undo(page)).toBeInViewport();
    await undo(page).click();
    expect((await state(page)).undo).toBeNull();
    expect((await state(page)).items).toEqual(original);
    await shot(page, info, 'responsive-undo-accessible');
  });
}
