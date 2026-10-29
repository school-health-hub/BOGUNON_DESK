import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { startServer } from './server.mjs';
import { measure } from './measure.mjs';
import { contrastEvidence } from './contrast.mjs';

const productSha = '3d2694cc5755cb758e97a7d861b6ae847224f6e7';
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_OS !== 'Windows' || process.env.GITHUB_REF !== 'refs/heads/codex/int5b-visual-windows-qa') throw new Error('Remote dedicated Windows QA only; local execution is prohibited');
const source = path.resolve(process.env.GITHUB_WORKSPACE, 'source');
const output = path.join(process.env.QA_ROOT, 'evidence');
const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
if (head() !== productSha) throw new Error('Product SHA mismatch');
const { chromium } = await import('./tools/node_modules/playwright-core/index.mjs');
const json = (name, value) => fs.writeFile(path.join(output, name), JSON.stringify(value, null, 2));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = [], events = [], assertions = [];
let browser, context, server, cdp, error;
const cleanup = { contextClosed: false, browserClosed: false, serverClosed: false, userProfileReused: false, errors: [] };
try {
  server = await startServer(path.join(source, 'dist'));
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', deviceScaleFactor: 1, viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === server.origin ? route.continue() : route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', socket => socket.close({ code: 1008, reason: 'QA sockets disabled' }));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', exception => events.push({ kind: 'pageerror', message: exception.message }));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) events.push({ kind: message.type(), message: message.text() }); });
  page.on('requestfailed', request => events.push({ kind: 'requestfailed', url: request.url(), error: request.failure()?.errorText }));
  await page.clock.setFixedTime(new Date('2026-10-29T09:30:00+09:00'));
  await page.goto(server.origin + '/', { waitUntil: 'networkidle' });
  const button = name => page.getByRole('button', { name, exact: true });
  if (await button('다음').count()) {
    await button('다음').click(); await button('나중에 연결').click(); await button('시작하기').click();
  }
  const navigation = page.getByRole('navigation', { name: '주요 기능' });
  await navigation.waitFor();
  cdp = await context.newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  async function capture(state, viewport) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(350);
    const dom = await page.evaluate(measure);
    if (dom.viewport.width !== viewport.width || dom.viewport.height !== viewport.height || dom.viewport.dpr !== 1) throw new Error('Viewport/DPR mismatch');
    const name = `${state}-${viewport.width}x${viewport.height}`;
    const image = await page.screenshot({ animations: 'disabled', fullPage: false });
    const contrast = await contrastEvidence(page, path.join(output, `${name}.background-measurement.png`));
    const documentNode = await cdp.send('DOM.getDocument');
    const fonts = [];
    for (const selector of ['.date-card__date', '.summary-card h1', '.summary-card span', '.quick-launcher', '.desktop-settings h2', '.toolbox-panel h2', '.official-document-panel h2', '.official-document-panel button']) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector });
      fonts.push({ selector, ...(nodeId ? await cdp.send('CSS.getPlatformFontsForNode', { nodeId }) : { status: 'NOT_PRESENT' }) });
    }
    await fs.writeFile(path.join(output, `${name}.png`), image);
    await json(`${name}.dom.json`, { dom, contrast, platformFonts: fonts, nonTextContrast: 'REQUIRES_REVIEW: computed styles + real screenshot; no automated PASS', keyboardCertification: 'REQUIRES_REVIEW' });
    manifest.push({ state, viewport, productSha, screenshot: `${name}.png`, screenshotSha256: sha(image), rendered: true, browser: browser.version(), dpr: 1, windowsDpi: 'NOT RUN' });
    await json('captures.json', manifest);
    return dom;
  }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 980, height: 700 }]) {
    await page.setViewportSize(viewport);
    await navigation.getByRole('button', { name: '홈', exact: true }).click();
    await page.evaluate(() => { document.querySelector('main').scrollTo(0, 0); window.scrollTo(0, 0); });
    await page.mouse.move(1, 1);
    const top = await capture('dashboard-top', viewport);
    for (const type of ['clock', 'today-summary', 'monthly-calendar', 'quick-launcher', 'quick-memo']) {
      if (!top.widgets.some(widget => widget.type === type)) throw new Error(`Required default widget missing: ${type}`);
    }
    const memo = page.getByRole('textbox', { name: '빠른 메모 입력' });
    await memo.fill('합성 QA 메모');
    await page.evaluate(() => { const main = document.querySelector('main'); main.scrollTo(0, main.scrollHeight); });
    const bottom = await capture('dashboard-bottom', viewport);
    await memo.fill('');
    // Exercise each launcher control's scroll-into-view path, not just the final button.
    const launchControls = page.locator('.quick-launcher button');
    const reachability = [];
    for (let i = 0; i < await launchControls.count(); i++) {
      const control = launchControls.nth(i);
      await control.scrollIntoViewIfNeeded();
      reachability.push(await control.evaluate(element => { const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { text: element.textContent, disabled: element.disabled, unobscured: hit === element || element.contains(hit) }; }));
    }
    await page.evaluate(() => document.querySelector('main').scrollTo(0, 0));
    const calendarButton = page.getByRole('button', { name: '2026년 10월 29일 일정 추가', exact: true });
    await calendarButton.focus(); await page.keyboard.press('Tab');
    const focus = await capture('keyboard-focus', viewport);
    assertions.push({ viewport, clockPresent: top.clock.length >= 3, clockWidthFits: top.clock.every(item => item.scrollWidth <= item.clientWidth + 1), pageFits: top.pageWidth <= viewport.width, dockGap: top.dock && top.main ? top.dock.top - top.main.rect.bottom : null, lowerButtons: bottom.buttons, launcherReachability: reachability, focus: focus.active, words: top.words, nestedScroll: top.scrollContainers, status: 'EVIDENCE_ONLY_REVIEW_REQUIRED' });
    await navigation.getByRole('button', { name: '설정', exact: true }).click();
    await page.locator('.desktop-settings').waitFor(); await capture('settings', viewport); await button('설정 닫기').click();
    await navigation.getByRole('button', { name: '업무 도구', exact: true }).click();
    await page.locator('.toolbox-panel').waitFor(); await capture('toolbox', viewport);
    await page.getByRole('button', { name: /^공문 작업실/ }).click();
    await page.getByRole('dialog', { name: '공문 작업실', exact: true }).waitFor(); await capture('official', viewport);
    await button('공문 작업실 닫기').click();
    if (await button('업무 도구함 닫기').count()) await button('업무 도구함 닫기').click();
  }
  if (manifest.length !== 24 || head() !== productSha) throw new Error('Incomplete capture matrix or product SHA changed');
} catch (exception) { error = exception; }
finally {
  for (const [name, resource] of [['contextClosed', context], ['browserClosed', browser], ['serverClosed', server]]) {
    try { if (resource) await resource.close(); cleanup[name] = resource ? true : 'NOT_STARTED'; }
    catch (exception) { cleanup.errors.push({ resource: name, error: exception.message }); error ??= exception; }
  }
  await json('assertions.json', assertions); await json('events.json', events); await json('cleanup.json', cleanup);
  await json('visual-summary.json', { captureCount: manifest.length, expectedCaptures: 24, captureStatus: error ? 'INCOMPLETE' : 'COMPLETE', designVerdict: 'REQUIRES_INDEPENDENT_VISUAL_REVIEW', error: error?.message ?? null, nativeDpi: 'NOT RUN' });
}
if (error) throw error;
