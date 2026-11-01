import type { Page } from '@playwright/test';
import { purchaseImportFieldIds, purchaseImportFieldLabels } from '../../../src/purchase/types';
import type { MappingFixtures } from '../mapping-fixtures';
import { test, expect, state, act, shot } from './fixtures';
export { test, expect, state, act, shot };
export const dialog = (page: Page) => page.getByRole('dialog', { name: '열 지정', exact: true });
export const applyMapping = (page: Page) => dialog(page).getByRole('button', { name: '적용', exact: true });
export const fixture = (page: Page, kind: keyof MappingFixtures = 'review') => page.evaluate(value => window.purchaseQa.fixture(value), kind);
export async function openMapping(page: Page, kind: keyof MappingFixtures = 'review'): Promise<void> {
  await act(page, `mapping:${kind}`);
  await page.getByRole('button', { name: '열 지정', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
}
export async function chooseFixtureMapping(page: Page, kind: keyof MappingFixtures = 'review'): Promise<void> {
  const data = await fixture(page, kind);
  for (const field of purchaseImportFieldIds) await page.getByLabel(`${purchaseImportFieldLabels[field]}에 연결할 원본 열`, { exact: true }).selectOption('');
  for (const field of purchaseImportFieldIds) {
    const index = data.mapping[field];
    if (index !== undefined) await page.getByLabel(`${purchaseImportFieldLabels[field]}에 연결할 원본 열`, { exact: true }).selectOption(String(index));
  }
}
export async function startMapping(page: Page): Promise<number> {
  await applyMapping(page).click();
  await expect.poll(async () => (await state(page)).requests.length).toBe(1);
  const request = (await state(page)).requests[0];
  if (request === undefined) throw new Error('Deferred mapping request missing');
  return request.id;
}
export async function complete(page: Page, id: number, failure = false): Promise<void> {
  await page.evaluate(value => window.purchaseQa.complete(value.id, value.failure), { id, failure });
  await expect.poll(async () => (await state(page)).requests.some(request => request.id === id)).toBe(false);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
export const owner = async (page: Page) => { const current = await state(page); return { items: current.items, mapping: current.mapping }; };
