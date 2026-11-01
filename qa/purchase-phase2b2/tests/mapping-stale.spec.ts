import { test, expect, state, act, shot, dialog, fixture, openMapping, chooseFixtureMapping, startMapping, complete, applyMapping, owner } from './mapping-helpers';

for (const mutation of ['header', 'mapping', 'candidate', 'reset', 'close', 'new-request'] as const) {
  for (const failure of [false, true]) {
    test(`stale ${failure ? 'error' : 'success'} after ${mutation} cannot change owner items candidates templates or notice`, async ({ page }, info) => {
      await openMapping(page);
      await chooseFixtureMapping(page);
      await page.getByLabel('이 열 구성을 기억하기', { exact: true }).check();
      await page.getByLabel('가져오기 템플릿 이름', { exact: true }).fill('오래된 응답이 저장하면 안 되는 설정');
      const id = await startMapping(page);
      switch (mutation) {
        case 'header': {
          const alternate = (await fixture(page)).candidate.headerOptions[1];
          if (alternate === undefined) throw new Error('Actual Rust alternative header missing');
          await page.getByLabel('머리글 행 선택', { exact: true }).selectOption(String(alternate.rowIndex));
          break;
        }
        case 'mapping': await page.getByLabel('품명에 연결할 원본 열', { exact: true }).selectOption(''); break;
        case 'candidate': await act(page, 'mapping:manual'); break;
        case 'reset': await act(page, 'reset'); await expect.poll(async () => (await state(page)).mapping.candidates.length).toBe(0); break;
        case 'close': await act(page, 'close'); await expect.poll(async () => (await state(page)).panelOpen).toBe(false); break;
        case 'new-request': await act(page, 'mapping:new-request'); break;
      }
      const before = await owner(page);
      await complete(page, id, failure);
      expect(await owner(page)).toEqual(before);
      expect((await state(page)).mapping.templates).toHaveLength(0);
      expect((await state(page)).mapping.notice).not.toContain('분석하지 못했습니다');
      await shot(page, info, `stale-${mutation}-${failure ? 'error' : 'success'}-owner-preserved`);
    });
  }
}

for (const failure of [false, true]) {
  test(`new mapping request wins over older ${failure ? 'error' : 'success'} and applies once`, async ({ page }, info) => {
    await openMapping(page);
    await chooseFixtureMapping(page);
    const id = await startMapping(page);
    await chooseFixtureMapping(page);
    await applyMapping(page).click();
    await expect.poll(async () => (await state(page)).requests.length).toBe(2);
    const latest = (await state(page)).requests.find(request => request.id !== id);
    if (latest === undefined) throw new Error('New request missing');
    const before = await owner(page);
    await complete(page, id, failure);
    expect(await owner(page)).toEqual(before);
    await expect(dialog(page).getByRole('button', { name: '분석 중…', exact: true })).toBeDisabled();
    await complete(page, latest.id);
    const data = await fixture(page);
    expect((await state(page)).items).toEqual([...before.items, ...data.result.items]);
    await expect(dialog(page)).toHaveCount(0);
    await shot(page, info, `latest-request-wins-${failure ? 'error' : 'success'}`);
  });
}

test('accepted mapping preserves unrelated source candidate and concurrent item edits through product merge helpers', async ({ page }, info) => {
  await openMapping(page);
  await chooseFixtureMapping(page);
  const id = await startMapping(page);
  await act(page, 'mapping:unrelated');
  await expect.poll(async () => (await state(page)).items[0]?.vendor).toBe('병행 수정 보존');
  await expect.poll(async () => (await state(page)).mapping.candidates.length).toBe(2);
  const before = await owner(page);
  const unrelated = await fixture(page, 'manual');
  const mapped = await fixture(page);
  await complete(page, id);
  const after = await state(page);
  expect(after.items).toEqual([...before.items, ...mapped.result.items]);
  expect(after.items[0]?.vendor).toBe('병행 수정 보존');
  expect(after.mapping.candidates.some(candidate => candidate.id === unrelated.candidate.id)).toBe(true);
  expect(after.mapping.candidates.some(candidate => candidate.id === mapped.candidate.id)).toBe(false);
  expect(after.mapping.sources.some(source => source.candidateId === unrelated.candidate.id && source.status === 'needsMapping')).toBe(true);
  expect(after.mapping.sources.some(source => source.candidateId === mapped.candidate.id && source.status === 'success')).toBe(true);
  expect(after.items.filter(item => mapped.result.items.some(mappedItem => mappedItem.id === item.id))).toHaveLength(mapped.result.items.length);
  await shot(page, info, 'accepted-mapping-preserves-unrelated-owner-state');
});
