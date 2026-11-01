import { test, expect, state, shot, dialog, fixture, openMapping, chooseFixtureMapping, startMapping, complete, applyMapping, owner } from './mapping-helpers';

for (const [kind, label] of [['automatic', '자동 인식 가능'], ['review', '확인 권장'], ['manual', '직접 지정 필요']] as const) {
  test(`actual Rust ${kind} recommendation stays provisional with Korean indexed evidence`, async ({ page }, info) => {
    const before = (await state(page)).items;
    await openMapping(page, kind);
    const data = await fixture(page, kind);
    await expect(dialog(page).locator('.purchase-mapping-summary strong')).toHaveText(label);
    await expect(dialog(page)).toContainText('추천은 아직 확정되지 않았습니다');
    expect((await state(page)).items).toEqual(before);
    const options = data.candidate.headerOptions[0];
    if (options === undefined) throw new Error('Actual Rust header missing');
    for (const [index, header] of options.headers.entries()) await expect(page.getByLabel('품명에 연결할 원본 열', { exact: true }).locator('option').nth(index + 1)).toHaveText(`${index + 1}열 · ${header || '이름 없는 열'}`);
    for (const details of await dialog(page).locator('details').all()) await details.locator('summary').click();
    expect(await dialog(page).innerText()).not.toMatch(/\b(?:exact_header|alias_header|saved_template|valid_template|numeric_values|text_values|missing_required|ambiguous_header|invalid_template|duplicate_column)\b/);
    for (const reason of await dialog(page).locator('details li').all()) expect(await reason.innerText()).toMatch(/[가-힣]/u);
    await shot(page, info, `rust-${kind}-recommendation-evidence`);
  });
}

test('manual override survives recommendation reapply and missing/duplicate columns cannot apply', async ({ page }, info) => {
  await openMapping(page);
  const name = page.getByLabel('품명에 연결할 원본 열', { exact: true });
  const quantity = page.getByLabel('수량에 연결할 원본 열', { exact: true });
  await name.selectOption('');
  await expect(dialog(page).getByRole('alert')).toContainText('품명');
  await expect(applyMapping(page)).toBeDisabled();
  await dialog(page).getByRole('button', { name: '추천 다시 적용', exact: true }).click();
  await expect(name).toHaveValue('');
  await chooseFixtureMapping(page);
  const nameIndex = await name.inputValue();
  await expect(quantity.locator(`option[value="${nameIndex}"]`)).toBeDisabled();
  await quantity.selectOption('');
  await dialog(page).getByRole('button', { name: '추천 다시 적용', exact: true }).click();
  await expect(quantity).toHaveValue('');
  await expect(dialog(page)).toContainText('직접 수정');
  expect((await state(page)).requests).toHaveLength(0);
  await shot(page, info, 'manual-reapply-missing-and-duplicate-protection');
});

test('actual Rust mapping result appends once and saves template only after current acceptance', async ({ page }, info) => {
  await openMapping(page, 'manual');
  await chooseFixtureMapping(page, 'manual');
  const data = await fixture(page, 'manual');
  const before = (await state(page)).items;
  await page.getByLabel('이 열 구성을 기억하기', { exact: true }).check();
  await page.getByLabel('가져오기 템플릿 이름', { exact: true }).fill('합성 확인된 열 설정');
  const id = await startMapping(page);
  expect((await state(page)).items).toEqual(before);
  expect((await state(page)).mapping.templates).toHaveLength(0);
  await complete(page, id);
  await expect(dialog(page)).toHaveCount(0);
  const after = await state(page);
  expect(after.items).toEqual([...before, ...data.result.items]);
  expect(after.mapping.candidates).toEqual(data.result.candidates);
  expect(after.mapping.templates).toHaveLength(1);
  expect(after.mapping.templates[0]?.mapping).toEqual(data.mapping);
  await shot(page, info, 'rust-result-accepted-template-saved-once');
});

test('transport failure keeps owner state and mapping; cancel and retry accepts only retry', async ({ page }, info) => {
  await openMapping(page);
  await chooseFixtureMapping(page);
  const before = await owner(page);
  const id = await startMapping(page);
  await complete(page, id, true);
  expect((await state(page)).items).toEqual(before.items);
  expect((await state(page)).mapping.candidates).toEqual(before.mapping.candidates);
  expect((await state(page)).mapping.templates).toEqual(before.mapping.templates);
  await expect(page.getByLabel('QA 알림', { exact: true })).toContainText('다시 적용');
  await expect(applyMapping(page)).toBeEnabled();
  await dialog(page).getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole('button', { name: '열 지정', exact: true }).click();
  await chooseFixtureMapping(page);
  const retry = await startMapping(page);
  await complete(page, retry);
  const data = await fixture(page);
  expect((await state(page)).items).toEqual([...before.items, ...data.result.items]);
  await shot(page, info, 'transport-failure-cancel-retry');
});

test('rapid duplicate apply starts one transport and appends one actual Rust result', async ({ page }) => {
  await openMapping(page);
  await chooseFixtureMapping(page);
  const before = (await state(page)).items;
  await applyMapping(page).dblclick();
  await expect.poll(async () => (await state(page)).requests.length).toBe(1);
  const request = (await state(page)).requests[0];
  if (request === undefined) throw new Error('Missing deferred request');
  await complete(page, request.id);
  const data = await fixture(page);
  expect((await state(page)).items).toEqual([...before, ...data.result.items]);
});
