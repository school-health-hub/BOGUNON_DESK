import { _electron as electron, expect } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
const output = resolve(process.env.TD2_REVIEW_DIR ?? 'artifacts/td2-b-review');
const tempRoot = resolve(process.env.TD2_QA_TEMP ?? join(tmpdir(),'bogunon-td2-qa'));
const qaRoot = join(tempRoot, 'profiles');
await mkdir(output, { recursive: true });
await mkdir(qaRoot, { recursive: true });
const focused=process.env.TD2_FOCUSED_QA==='1';
const runId = randomUUID();
let app = await electron.launch({ executablePath: process.env.TD2_ELECTRON_PATH, chromiumSandbox: true, args: [resolve('build/electron-p0-app')], env: {
...process.env, RUNNER_TEMP: tempRoot, ELECTRON_P0_QA_PROFILE: '1', ELECTRON_P0_QA_ROOT: qaRoot,
ELECTRON_P0_TEST_RUN: runId, ELECTRON_P0_DEV_URL: '',
} });
const report = { runId, sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
approval: 'B direction and 1280 visual approved; Windows usability/integration pending', profile: qaRoot, synthetic: true, captures: [], checks: [], errors: [] };
try {
let page = await app.firstWindow();page.setDefaultTimeout(15000);
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
let dock = page.getByRole('navigation', { name: '주요 기능' });
const dismissSetup = async () => {
await expect(dock).toBeVisible({ timeout: 30000 });
const setup = page.getByRole('dialog', { name: '학교 초기 설정' });
await expect(setup).toBeVisible();
await setup.getByRole('button', { name: '나중에 설정' }).click();
await expect(page.locator('[data-p0-save]')).toContainText('저장됨');
};
await dismissSetup();
const initial = await page.evaluate(() => window.electronP0.readSettings());
const snapshot = async name => {
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
if(name==='custom-layout')expect(await page.locator('.quick-memo-editor.is-widget').evaluate(e=>e.querySelector('textarea').getBoundingClientRect().bottom<=e.querySelector('.quick-memo-actions').getBoundingClientRect().top+1)).toBe(true);
const file = `${name}.png`;
const capture = await app.evaluate(async ({ BrowserWindow }) => {
const image = await BrowserWindow.getAllWindows()[0].webContents.capturePage();
return { png: image.toPNG().toString('base64'), size: image.getSize() };
});
await writeFile(join(output, file), Buffer.from(capture.png, 'base64'));
report.captures.push({ file, sha256: createHash('sha256').update(await readFile(join(output, file))).digest('hex'),
nativeImage: capture.size,
viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })) });
};
const seed = await page.evaluate(async focused => {
const now = new Date();
const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
const tasks = await window.electronWork.tasks.load();
if (!tasks.ok) return false;
const saved = await window.electronWork.tasks.save({ ...tasks.data.document, tasks: [
{ id: crypto.randomUUID(), title: '합성 QA · 보건교육 자료 준비', scheduledDate: today, dueDate: today, completed: false, priority: 'high', category: '교육', dday: true },
{ id: crypto.randomUUID(), title: '합성 QA · 건강검진 안내문 및 보호자 동의서 확인과 학년별 보건교육 일정 조정'.repeat(focused?8:1).slice(0,120).trim(), scheduledDate: today, dueDate: today, completed: false, priority: 'normal', category: '검진', dday: false },
] }, tasks.data.document.revision);
const memo = await window.electronWork.memo.write({ version: 1, text: '합성 QA 메모\n오전 · 교육 자료 준비\n오후 · 안내문 검토' });
const events = await window.electronWork.events.load();
if (!events.ok) return false;
const event = await window.electronWork.events.save({ expectedRevision: events.data.document.revision, expectedUpdatedAt: null,
event: { id: crypto.randomUUID(), title: '합성 QA · 보건교육 자료 준비 및 학년별 안내 일정 확인'.repeat(focused?8:1).slice(0,120).trim(), startDate: today, endDate: today, startTime: null, endTime: null, allDay: true, description: '', location: '', category: '교육' } });
return saved.ok && memo.ok && event.ok;
},focused);
expect(seed).toBe(true);
await page.reload();
await dismissSetup();
await expect(page.locator('.task-title').first()).toContainText('합성 QA');
report.display = await app.evaluate(({ screen, BrowserWindow }) => ({ displays: screen.getAllDisplays().map(d => ({ workArea: d.workArea, scaleFactor: d.scaleFactor })), defaultBounds: BrowserWindow.getAllWindows()[0].getBounds() }));
let main=page.locator('.workspace-dashboard');
const stored=await page.evaluate(()=>window.electronP0.readSettings());
for(const mode of ['1280x800','1440x900','900x680','maximized',...(focused?['zoom125','zoom150']:[])]){
 await app.evaluate(({BrowserWindow},mode)=>{const win=BrowserWindow.getAllWindows()[0];win.unmaximize();win.webContents.setZoomFactor(1);if(mode.startsWith('zoom')){win.setContentSize(1280,800);win.webContents.setZoomFactor(mode==='zoom125'?1.25:1.5)}else if(mode==='maximized')win.maximize();else{const [w,h]=mode.split('x').map(Number);win.setContentSize(w,h)}},mode);
 await expect.poll(()=>main.evaluate(e=>e.clientHeight>0&&e.scrollWidth<=e.clientWidth+2)).toBe(true);
 await page.waitForTimeout(400);
 await main.evaluate(e=>{e.scrollTop=0});await page.mouse.move(0,0);await snapshot(mode+'-top');
 const bounds=await page.evaluate(()=>{const d=document.querySelector('.dock-zone').getBoundingClientRect(),m=document.querySelector('.workspace-dashboard').getBoundingClientRect();return{dockBottom:d.bottom,mainBottom:m.bottom,dockTop:d.top,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1}});
 expect(bounds.overflow).toBe(false);expect(bounds.mainBottom).toBeLessThanOrEqual(bounds.dockTop+1);
 report.checks.push({mode,bounds});
const metrics=await page.evaluate(()=>{const main=document.querySelector('.workspace-dashboard');return{clientHeight:main.clientHeight,scrollHeight:main.scrollHeight,widgets:[...document.querySelectorAll('.desktop-widget-grid>[data-widget-type]')].map(e=>({type:e.dataset.widgetType,height:e.clientHeight,scrolling:[...e.querySelectorAll('*')].filter(n=>n.clientHeight>0&&n.scrollHeight>n.clientHeight+2&&['auto','scroll'].includes(getComputedStyle(n).overflowY)).map(n=>({class:n.className,height:n.clientHeight,scroll:n.scrollHeight}))})),memoHeight:document.querySelector('.quick-memo-editor textarea')?.clientHeight}});
report.checks.push({mode,metrics});
if(mode!=='900x680'&&!mode.startsWith('zoom')){
 for(const type of ['today-summary','meal','dday','quick-launcher'])expect(metrics.widgets.find(w=>w.type===type)?.scrolling??[]).toEqual([]);
 expect(metrics.memoHeight).toBeGreaterThanOrEqual(90);
 expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight+2);
}
 await main.evaluate(e=>{e.scrollTop=e.scrollHeight});await snapshot(mode+'-bottom');
 expect(await page.evaluate(()=>window.electronP0.readSettings())).toEqual(stored);
}
await dock.getByRole('button',{name:'홈',exact:true}).focus();await page.keyboard.press('Tab');await snapshot('dock-focus');
await dock.getByRole('button',{name:'빠른 메모',exact:true}).click();await expect(dock.getByRole('button',{name:'빠른 메모',exact:true})).toHaveAttribute('aria-current','page');await snapshot('dock-selected-memo');await page.keyboard.press('Escape');await dock.getByRole('button',{name:'홈',exact:true}).click();
await dock.getByRole('button',{name:'홈',exact:true}).hover();await snapshot('dock-hover');
if(focused){
 report.checks.push({mealReadyLongData:'NOT RUN: Electron meal adapter is signedOut; no production binding change or fake ready data',osDpi125150:'NOT RUN; zoom125/150 are Electron content zoom only'});
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.webContents.setZoomFactor(1);w.setContentSize(1440,900)});
 await main.evaluate(e=>{e.scrollTop=0});await page.getByRole('button',{name:'화면 꾸미기',exact:true}).click();
 const beforeMove=await page.evaluate(()=>window.electronP0.readSettings());
 const handle=page.locator('[data-widget-type=clock] .widget-frame__drag');await handle.scrollIntoViewIfNeeded();
 const box=await handle.boundingBox();expect(box).not.toBeNull();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+110,box.y+box.height/2+100,{steps:15});await page.mouse.up();
 await expect.poll(async()=>{const s=await page.evaluate(()=>window.electronP0.readSettings());const a=beforeMove.dashboard.widgets.find(w=>w.type==='clock'),b=s.dashboard.widgets.find(w=>w.type==='clock');return a.x!==b.x||a.y!==b.y}).toBe(true);
 const afterMove=await page.evaluate(()=>window.electronP0.readSettings());
 const resize=page.locator('[data-widget-type=clock] .react-resizable-handle-se');await resize.scrollIntoViewIfNeeded();const rb=await resize.boundingBox();expect(rb).not.toBeNull();
 await page.mouse.move(rb.x+rb.width/2,rb.y+rb.height/2);await page.mouse.down();await page.mouse.move(rb.x+rb.width/2+110,rb.y+rb.height/2+65,{steps:15});await page.mouse.up();
 await expect.poll(async()=>{const s=await page.evaluate(()=>window.electronP0.readSettings());const a=afterMove.dashboard.widgets.find(w=>w.type==='clock'),b=s.dashboard.widgets.find(w=>w.type==='clock');return a.w!==b.w||a.h!==b.h}).toBe(true);
 await page.getByRole('button',{name:'완료',exact:true}).click();await expect(page.locator('[data-p0-save]')).toContainText('저장됨');
 const beforeRestart=await page.evaluate(()=>window.electronP0.readSettings());await snapshot('drag-resize-saved');
 await app.close();
 app=await electron.launch({executablePath:process.env.TD2_ELECTRON_PATH,chromiumSandbox:true,args:[resolve('build/electron-p0-app')],env:{...process.env,RUNNER_TEMP:tempRoot,ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_QA_ROOT:qaRoot,ELECTRON_P0_TEST_RUN:runId,ELECTRON_P0_DEV_URL:''}});
 page=await app.firstWindow();dock=page.getByRole('navigation',{name:'주요 기능'});main=page.locator('.workspace-dashboard');await dismissSetup();
 expect(await page.evaluate(()=>window.electronP0.readSettings())).toEqual(beforeRestart);
 await expect(page.locator('.task-title').first()).toContainText('합성 QA');await expect(page.locator('textarea').first()).toHaveValue(/합성 QA 메모/);
 await snapshot('process-restart-restored');report.checks.push({actualDragResizeAndProcessRestart:'PASS',beforeMove:beforeMove.dashboard.widgets.find(w=>w.type==='clock'),afterMove:afterMove.dashboard.widgets.find(w=>w.type==='clock'),restored:beforeRestart.dashboard.widgets.find(w=>w.type==='clock')});
}
const custom=structuredClone(stored);delete custom.dashboard.presetId;
custom.dashboard.widgets=custom.dashboard.widgets.map(w=>w.type==='clock'?{...w,w:3,h:3,x:0,y:16}:w);
await page.evaluate(v=>window.electronP0.writeSettings(v),custom);await page.reload();await dismissSetup();
expect(await page.evaluate(()=>window.electronP0.readSettings())).toEqual(custom);
await main.evaluate(e=>{e.scrollTop=e.scrollHeight});await snapshot('custom-layout');
report.checks.push({savedCustomLayout:'PASS',resizeSettingsUnchanged:'PASS'});
expect(report.errors).toEqual([]);report.result='PASS';
}catch(error){report.result='FAIL';report.failure=String(error);const p=app.windows()[0];if(p){report.layoutDiagnostics=await p.locator('.quick-launcher').evaluate(e=>[e,...e.querySelectorAll('*')].map(n=>{const s=getComputedStyle(n);return{class:n.className,tag:n.tagName,h:n.clientHeight,scroll:n.scrollHeight,padding:s.padding,gap:s.gap,margin:s.margin,minHeight:s.minHeight,rows:s.gridTemplateRows}}));await p.screenshot({path:join(output,'failure.png')});}throw error;
}finally{await app.close();report.cleanup='Isolated Electron closed; synthetic E profile retained.';await writeFile(join(output,'review.json'),JSON.stringify(report,null,2));}