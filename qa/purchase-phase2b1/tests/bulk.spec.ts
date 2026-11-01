import { test, expect, state, act, apply, review, undo, shot } from './fixtures';
for (const mode of ['keep', 'set', 'clear'] as const) {
  test(`bulk vendor ${mode} and budget clear when all rows selected`, async ({ page }, info) => {
    const before = await state(page);
    await page.getByRole('button', { name: '선택 품목 일괄 편집', exact: true }).click();
    await page.getByLabel('구매처 처리 방식').selectOption(mode);
    if (mode === 'set') await page.getByLabel('일괄 구매처', { exact: true }).fill('새 구매처');
    await page.getByLabel('예산항목 처리 방식').selectOption('clear');
    await shot(page, info, `bulk-${mode}-edit`);
    await page.getByRole('button', { name: '적용 내용 확인' }).click();
    await shot(page, info, `bulk-${mode}-review`);
    await page.getByRole('button', { name: '3개 품목에 적용', exact: true }).click();
    for (let i = 0; i < 3; i++) {
      await expect(page.getByLabel(`${i + 1}행 예산항목`, { exact: true })).toHaveValue('');
      await expect(page.getByLabel(`${i + 1}행 구매처`, { exact: true })).toHaveValue(
        mode === 'keep' ? before.items[i]?.vendor ?? '' : mode === 'set' ? '새 구매처' : '');
    }
    await shot(page, info, `bulk-${mode}-applied`);
    await undo(page).click();
    expect((await state(page)).items).toEqual(before.items);
    await expect(undo(page)).toHaveCount(0);
    await shot(page, info, 'undo-complete-second-undo-unavailable');
  });
}
test('blank set and unchanged modes cannot proceed', async ({ page }) => {
  await page.getByRole('button', { name: '선택 품목 일괄 편집', exact: true }).click();
  await expect(page.getByRole('button', { name: '적용 내용 확인' })).toBeDisabled();
  await page.getByLabel('구매처 처리 방식').selectOption('set');
  await page.getByLabel('일괄 구매처', { exact: true }).fill('   ');
  await expect(page.getByRole('button', { name: '적용 내용 확인' })).toBeDisabled();
});
test('filter includes hidden selected row and preserves undo across selection order tabs', async ({ page }, info) => {
  await page.getByRole('button', { name: /^불일치\s*2$/ }).click();
  await expect(page.getByLabel('3행 구매처', { exact: true })).toHaveCount(0);
  await review(page);
  await expect(page.getByRole('dialog', { name: '선택 품목 일괄 편집', exact: true })).toContainText('숨겨진 선택 1개');
  await expect(page.getByRole('dialog', { name: '선택 품목 일괄 편집', exact: true })).toContainText('선택 3개 · 숨겨진 선택 1개 · 실제 변경 3개');
  await shot(page, info, 'hidden-selected-confirmation');
  await page.getByRole('button', { name: '3개 품목에 적용', exact: true }).click();
  await page.getByRole('button', { name: /^전체\s*3$/ }).click();
  await expect(page.getByLabel('3행 구매처', { exact: true })).toHaveValue('공통 구매처');
  await page.getByLabel('1행 선택', { exact: true }).uncheck();
  await page.getByRole('button', { name: '1행 아래로 이동', exact: true }).click();
  await page.getByRole('tab', { name: '품의문 작성', exact: true }).click();
  await page.getByRole('tab', { name: '품목내역', exact: true }).click();
  await expect(undo(page)).toBeVisible();
  await undo(page).click();
  await expect(page.getByLabel('1행 구매처', { exact: true })).toHaveValue('구매처 B');
  await expect(page.getByLabel('2행 선택', { exact: true })).not.toBeChecked();
  await shot(page, info, 'preserved-selection-order-after-undo');
});
test('review becomes stale when owner imports', async ({ page }, info) => {
  await review(page);
  const before = (await state(page)).items.map(item => item.vendor);
  await act(page, 'import');
  await expect(page.getByRole('button', { name: '3개 품목에 적용', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('대상 품목이 변경');
  expect((await state(page)).items.slice(0, 3).map(item => item.vendor)).toEqual(before);
  await shot(page, info, 'stale-review-blocked');
});
for (const fault of ['corrupt-value', 'corrupt-id', 'corrupt-duplicate']) {
  test(`undo is atomic when ${fault}`, async ({ page }, info) => {
    await apply(page);
    await act(page, fault);
    const before = (await state(page)).items;
    await undo(page).click();
    expect((await state(page)).items).toEqual(before);
    await expect(page.getByText('품목이 변경되어 실행 취소할 수 없습니다. 어떤 품목도 복원하지 않았습니다.', { exact: true })).toBeVisible();
    await shot(page, info, fault);
  });
}
for (const action of ['edit', 'add', 'delete', 'replace', 'import', 'reset', 'close']) {
  test(`undo invalidates after ${action}`, async ({ page }, info) => {
    await apply(page);
    switch (action) {
      case 'edit': await page.getByLabel('1행 구매처', { exact: true }).fill('직접 수정'); await page.getByLabel('1행 구매처', { exact: true }).press('Enter'); break;
      case 'add': await page.getByRole('button', { name: '품목 추가', exact: true }).click(); break;
      case 'delete': await page.getByRole('button', { name: '1행 삭제', exact: true }).click(); break;
      case 'reset': page.once('dialog', dialog => void dialog.accept()); await page.getByRole('button', { name: '새 작업', exact: true }).click(); break;
      case 'close': await page.getByRole('button', { name: '품의 도우미 닫기', exact: true }).click(); await act(page, 'open'); break;
      default: await act(page, action);
    }
    expect((await state(page)).undo).toBeNull();
    await expect(undo(page)).toHaveCount(0);
    await shot(page, info, `invalidated-${action}`);
  });
}
test('budget set trims value while vendor keep and deselected row remain unchanged', async ({ page }, info) => {
  const before = (await state(page)).items;
  await page.getByLabel('3행 선택', { exact: true }).uncheck();
  await page.getByRole('button', { name: '선택 품목 일괄 편집', exact: true }).click();
  await page.getByLabel('예산항목 처리 방식').selectOption('set');
  await page.getByLabel('일괄 예산항목', { exact: true }).fill('  새 예산  ');
  await page.getByRole('button', { name: '적용 내용 확인' }).click();
  await page.getByRole('button', { name: '2개 품목에 적용', exact: true }).click();
  await expect(page.getByLabel('1행 예산항목', { exact: true })).toHaveValue('새 예산');
  await expect(page.getByLabel('2행 예산항목', { exact: true })).toHaveValue('새 예산');
  await expect(page.getByLabel('3행 예산항목', { exact: true })).toHaveValue('예산 C');
  await expect(page.getByLabel('1행 구매처', { exact: true })).toHaveValue('구매처 A');
  await shot(page, info, 'budget-set-deselected-preserved');
  await undo(page).click();
  expect((await state(page)).items.map(item => [item.vendor, item.budgetItem])).toEqual(before.map(item => [item.vendor, item.budgetItem]));
});

test('zero-change set preserves revision and previous undo; active filter survives undo', async ({ page }, info) => {
  await page.getByRole('button', { name: /^불일치\s*2$/ }).click();
  await apply(page);
  const before = await state(page);
  await page.getByRole('button', { name: '선택 품목 일괄 편집', exact: true }).click();
  await page.getByLabel('구매처 처리 방식').selectOption('set');
  await page.getByLabel('일괄 구매처', { exact: true }).fill('공통 구매처');
  await expect(page.getByText('실제 변경 품목 0개', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '적용 내용 확인' })).toBeDisabled();
  await page.getByRole('button', { name: '일괄 편집 취소', exact: true }).click();
  expect((await state(page)).revision).toBe(before.revision);
  expect((await state(page)).undo).toEqual(before.undo);
  await undo(page).click();
  await expect(page.getByRole('button', { name: /^불일치\s*2$/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('3행 구매처', { exact: true })).toHaveCount(0);
  expect((await state(page)).items.map(item => item.vendor)).toEqual(['구매처 A', '구매처 B', '구매처 C']);
  await shot(page, info, 'filter-preserved-undo-hidden-row');
});

test('clearing already-empty fields is a disabled no-op and retains undo', async ({ page }) => {
  await page.getByRole('button', { name: '선택 품목 일괄 편집', exact: true }).click();
  await page.getByLabel('예산항목 처리 방식').selectOption('clear');
  await page.getByRole('button', { name: '적용 내용 확인' }).click();
  await page.getByRole('button', { name: '3개 품목에 적용', exact: true }).click();
  const before = await state(page);
  await page.getByRole('button', { name: '선택 품목 일괄 편집', exact: true }).click();
  await page.getByLabel('예산항목 처리 방식').selectOption('clear');
  await expect(page.getByRole('button', { name: '적용 내용 확인' })).toBeDisabled();
  await page.getByRole('button', { name: '일괄 편집 취소', exact: true }).click();
  expect((await state(page)).revision).toBe(before.revision);
  expect((await state(page)).undo).toEqual(before.undo);
});
test('vendor set preserves budget keep values', async ({ page }) => {
  await apply(page);
  await expect(page.getByLabel('1행 예산항목', { exact: true })).toHaveValue('예산 A');
  await expect(page.getByLabel('2행 예산항목', { exact: true })).toHaveValue('예산 B');
  await expect(page.getByLabel('3행 예산항목', { exact: true })).toHaveValue('예산 C');
});

test('second successful batch replaces undo with immediately preceding values', async ({ page }, info) => {
  await apply(page);
  await review(page, '두 번째 구매처');
  await page.getByRole('button', { name: '3개 품목에 적용', exact: true }).click();
  await expect(page.getByLabel('1행 구매처', { exact: true })).toHaveValue('두 번째 구매처');
  await undo(page).click();
  for (const row of [1, 2, 3]) await expect(page.getByLabel(`${row}행 구매처`, { exact: true })).toHaveValue('공통 구매처');
  await expect(undo(page)).toHaveCount(0);
  await shot(page, info, 'second-batch-undo');
});

test('confirmation distinguishes selected count from actual changed count', async ({ page }) => {
  await page.getByRole('button', { name: /^불일치\s*2$/ }).click();
  await review(page, '구매처 A');
  await expect(page.getByRole('dialog', { name: '선택 품목 일괄 편집', exact: true })).toContainText('선택 3개 · 숨겨진 선택 1개 · 실제 변경 2개');
  await page.getByRole('button', { name: '2개 품목에 적용', exact: true }).click();
  expect((await state(page)).items.map(item => item.vendor)).toEqual(['구매처 A', '구매처 A', '구매처 A']);
});
