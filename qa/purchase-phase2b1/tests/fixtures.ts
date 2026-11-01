import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import type { PurchaseQaController } from '../contract';
declare global { interface Window { purchaseQa: PurchaseQaController } }
export const test = base.extend({
  page: async ({ page, context }, use, testInfo) => {
    const failures: string[] = [];
    const diagnostics: string[] = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://127.0.0.1:1420' || url.protocol === 'data:') await route.continue();
      else { failures.push(`External request blocked: ${url.origin}`); await route.abort(); }
    });
    await context.routeWebSocket(/.*/, socket => {
      const url = new URL(socket.url());
      if (url.hostname === '127.0.0.1' && url.port === '1420') socket.connectToServer();
      else { failures.push(`External websocket blocked: ${url.origin}`); socket.close(); }
    });
    context.on('page', popup => {
      if (popup !== page) { failures.push('Unexpected popup'); void popup.close(); }
    });
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (testInfo.title.includes('corrupt-duplicate') && /same key|Encountered two children/.test(text)) diagnostics.push(text);
      else failures.push(text);
    });
    page.on('pageerror', error => failures.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '품의 도우미', exact: true })).toBeVisible();
    await expect.poll(async () => (await state(page)).items.length).toBe(3);
    await page.evaluate(() => document.fonts.ready);
    await use(page);
    await testInfo.attach('runtime-and-network-errors', { body: JSON.stringify(failures), contentType: 'application/json' });
    await testInfo.attach('expected-fault-diagnostics', { body: JSON.stringify(diagnostics), contentType: 'application/json' });
    expect(failures).toEqual([]);
  },
});
export { expect };
export const state = (page: Page) => page.evaluate(() => window.purchaseQa.getState());
export const act = (page: Page, action: string) => page.evaluate(value => window.purchaseQa.act(value), action);
export const undo = (page: Page) => page.getByRole('button', { name: '마지막 일괄 적용 실행 취소', exact: true });
export async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}
export async function review(page: Page, vendor = '공통 구매처'): Promise<void> {
  await page.getByRole('button', { name: '선택 품목 일괄 편집', exact: true }).click();
  await page.getByLabel('구매처 처리 방식').selectOption('set');
  await page.getByLabel('일괄 구매처', { exact: true }).fill(vendor);
  await page.getByRole('button', { name: '적용 내용 확인', exact: true }).click();
}
export async function apply(page: Page): Promise<void> {
  await review(page);
  await page.getByRole('button', { name: /개 품목에 적용$/ }).click();
  await expect(undo(page)).toBeVisible();
}
