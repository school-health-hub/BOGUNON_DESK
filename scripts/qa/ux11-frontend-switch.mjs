// Real ordinary App, isolated Chrome context, synthetic local state only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {resolve, relative, isAbsolute, join} from 'node:path';
import {preview} from 'vite';
import {chromium, expect} from '@playwright/test';
import {measureWidgetLibrary} from './ux10-widget-selection-measure.mjs';

const root = resolve('E:/BOGUNON_DEV/ux-11-home');
const output = resolve(process.env.UX11_FRONTEND_OUTPUT ?? '');
const child = relative(root, output);
assert.ok(child && !child.startsWith('..') && !isAbsolute(child), 'Dedicated E: output required');
for (const value of [process.env.TEMP, process.env.TMP]) {
  assert.ok(value, 'Explicit isolated temporary directory required');
  const path = relative(root, resolve(value));
  assert.ok(path && !path.startsWith('..') && !isAbsolute(path), 'Temporary files must stay in E: QA');
}
const key = 'school-health-desk.dashboard-layout.v1';
const report = {surface:'ordinary production App', captures:[], checks:{}, persistenceFailures:[], errors:[], consoleErrors:[], cleanup:false};
await mkdir(output, {recursive:true});
let server, browser;

function switchStyles() {
  return [...document.querySelectorAll('.widget-library--cards [role=switch]')].map(button => {
    const track = button.querySelector('.widget-library__track'), knob = track.firstElementChild;
    const rect = element => {const r=element.getBoundingClientRect(); return {width:r.width,height:r.height};};
    const css = getComputedStyle(button);
    return {name:button.getAttribute('aria-label'), checked:button.getAttribute('aria-checked'),
      target:rect(button), track:rect(track), knob:rect(knob), text:button.textContent,
      trackColor:getComputedStyle(track).backgroundColor, knobColor:getComputedStyle(knob).backgroundColor,
      transform:getComputedStyle(knob).transform, focus:button.matches(':focus-visible'), outline:css.outline};
  });
}
function contrast(a, b) {
  const luminance = color => {
    const channels = color.match(/[\d.]+/g).slice(0,3).map(Number).map(v => {
      const s=v/255; return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;
    });
    return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
  };
  const x=luminance(a), y=luminance(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}

try {
  server = await preview({root:process.cwd(), configFile:resolve('vite.config.ts'),
    preview:{host:'127.0.0.1',port:15433,strictPort:true,open:false}});
  browser = await chromium.launch({channel:'chrome',headless:false});
  const context = await browser.newContext({viewport:{width:1280,height:720}});
  await context.route('**/*', route => new URL(route.request().url()).hostname==='127.0.0.1'
    ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {if(message.type()==='error') report.consoleErrors.push(message.text());});
  await page.goto('http://127.0.0.1:15433');
  await page.getByRole('dialog').waitFor();
  for (const name of ['다음','나중에 연결','시작하기']) {
    const button=page.getByRole('button',{name,exact:false}).first();
    if(await button.isVisible()) await button.click();
  }
  const open = async () => {
    await page.getByRole('button',{name:'화면 꾸미기',exact:true}).click();
    await page.getByRole('button',{name:'위젯',exact:true}).click();
    await page.getByRole('switch').first().waitFor();
  };
  await open();
  await page.evaluate(async () => {await document.fonts.ready;});
  const switches = page.getByRole('switch');
  await expect(switches).toHaveCount(13);
  const stored = async () => page.evaluate(storageKey => {
    const raw=localStorage.getItem(storageKey); if(!raw)return null;
    const value=JSON.parse(raw);
    return {...value,widgets:[...value.widgets].sort((a,b)=>a.id.localeCompare(b.id))};
  }, key);
  // Initialize the fresh context via actual product actions, never fabricated DOM.
  const first=switches.first(); const initial=await first.getAttribute('aria-checked');
  await first.click(); await expect(first).toHaveAttribute('aria-checked',String(initial!=='true'));
  await first.click(); await expect(first).toHaveAttribute('aria-checked',initial);
  await expect.poll(stored).not.toBeNull(); const before=await stored();
  const preserve = async label => {
    try {await expect.poll(stored).toEqual(before); return true;}
    catch(error) {
      report.persistenceFailures.push({label, expected:before, actual:await stored(),
        message:error instanceof Error?error.message:String(error)});
      return false;
    }
  };
  for(let i=0;i<13;i++) {
    const control=switches.nth(i), checked=await control.getAttribute('aria-checked');
    await control.click(); await expect(control).toHaveAttribute('aria-checked',String(checked!=='true'));
    await control.click(); await expect(control).toHaveAttribute('aria-checked',checked);
  }
  report.checks.all13VisibilityRoundTrips=true;
  report.checks.all13RoundTrips=await preserve('thirteen toggle pairs');
  for(const [width,height] of [[1440,900],[1366,768],[1280,720],[980,700]]) {
    await page.setViewportSize({width,height});
    const capture=async state => {
      const dom=await page.evaluate(measureWidgetLibrary), controls=await page.evaluate(switchStyles);
      dom.descriptionPresentation=await page.locator('.widget-library--cards article').evaluateAll(cards => cards.map(card => {
        const description=card.querySelector('p'), button=card.querySelector('[role=switch]'), css=getComputedStyle(description);
        return {id:card.dataset.widgetType, clipped:description.scrollWidth>description.clientWidth+1,
          textOverflow:css.textOverflow, whiteSpace:css.whiteSpace,
          completeAccessibleDescription:button.getAttribute('aria-describedby')===description.id&&Boolean(description.textContent)};
      }));
      const name=`${width}x${height}-${state}`, image=join(output,name+'.png');
      await page.screenshot({path:image});
      await writeFile(join(output,name+'.json'),JSON.stringify({dom,controls},null,2));
      report.captures.push({name,viewport:{width,height},rendered:true,image,
        sha256:createHash('sha256').update(await readFile(image)).digest('hex')});
      assert.equal(dom.cards.length,13); assert.equal(dom.libraryOverflow,0);
      assert.equal(dom.overlaps.length,0); assert.ok(dom.cards.every(c=>c.titleFits));
      // Ordinary App intentionally uses one-line ellipsis (dashboard.css); retain it,
      // record truncation, and require the full aria-describedby text to remain available.
      assert.ok(dom.descriptionPresentation.every(p=>!p.clipped||
        (p.textOverflow==='ellipsis'&&p.whiteSpace==='nowrap'&&p.completeAccessibleDescription)));
      for(const control of controls) {
        assert.ok(control.target.width>=48&&control.target.height>=48);
        assert.deepEqual(control.track,{width:38,height:22});
        assert.deepEqual(control.knob,{width:16,height:16});
        assert.equal(control.text,''); assert.ok(control.name);
        control.knobTrackContrast=contrast(control.knobColor,control.trackColor);
        assert.ok(control.knobTrackContrast>=3);
      }
      await writeFile(join(output,name+'.json'),JSON.stringify({dom,controls},null,2));
      return controls;
    };
    await first.scrollIntoViewIfNeeded(); await capture('top');
    await switches.nth(6).scrollIntoViewIfNeeded(); await capture('middle');
    await switches.last().scrollIntoViewIfNeeded(); await capture('bottom');
    await first.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const on=await first.getAttribute('aria-checked'); await page.keyboard.press('Space');
    await expect(first).toHaveAttribute('aria-checked',String(on!=='true'));
    const off=await capture('keyboard-toggle');
    assert.ok(off[0].focus); assert.ok(!off[0].outline.startsWith('0px'));
    await page.keyboard.press('Space'); await expect(first).toHaveAttribute('aria-checked',on);
    await preserve(`${width}x${height} keyboard round trip`);
  }
  report.checks.keyboardAndFourViewports=true;
  await page.reload(); await open();
  report.checks.reloadPreservesLayout=await preserve('reload');
  assert.deepEqual(report.errors,[]);
  assert.equal(report.persistenceFailures.length,0,'Layout preservation failed; evidence retained, not waived');
  report.verdict='PASS';
} catch(error) {
  report.verdict='FAIL'; report.failure=error instanceof Error?error.message:String(error); throw error;
} finally {
  if(browser)await browser.close();
  if(server)await new Promise((done,fail)=>server.httpServer.close(error=>error?fail(error):done()));
  report.cleanup=true;
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
}
