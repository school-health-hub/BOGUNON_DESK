import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { measureWidgetLibrary } from './ux10-widget-selection-measure.mjs';

if(process.platform!=='win32')throw Error('UX-10 requires actual Windows Electron');
const output=resolve(process.env.UX10_EVIDENCE_ROOT??'artifacts/ux10-widget-selection-grid');
const runnerTemp=resolve(process.env.UX10_RUNNER_TEMP??join(output,'runner-temp'));
const allowedRoot=resolve('E:/BOGUNON_DEV/ux-10-home');
for(const target of [output,runnerTemp]){
  const child=relative(allowedRoot,target);
  assert.ok(child&&!child.startsWith('..')&&!isAbsolute(child),'QA output/temp must remain inside the dedicated E: workspace');
}
const qaRoot=join(runnerTemp,'qa-profile'),runId=randomUUID();
const sizes=[[1440,900],[1366,768],[1280,720],[980,700]];
const report={runId,captures:[],checks:{},errors:[],cleanup:false,nativeAttachment:'OPTION C DEFERRED / NOT RUN'};
await mkdir(join(output,'screenshots'),{recursive:true});await mkdir(qaRoot,{recursive:true});
let application,page;
const save=()=>writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
async function launch(){
  application=await electron.launch({executablePath:process.env.ELECTRON_P0_EXECUTABLE??resolve('node_modules/electron/dist/electron.exe'),args:[resolve('build/electron-p0-app')],chromiumSandbox:true,env:{...process.env,ELECTRON_P0_DEV_URL:'',ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_QA_ROOT:qaRoot,ELECTRON_P0_TEST_RUN:runId,RUNNER_TEMP:runnerTemp,NODE_ENV:'production'}});
  page=await application.firstWindow();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.getByRole('navigation',{name:'주요 기능'}).waitFor();
  const later=page.getByRole('button',{name:'나중에 설정',exact:true});await later.waitFor();await later.click();
  const info=await page.evaluate(()=>window.electronP0.info());assert.equal(resolve(info.userData),resolve(qaRoot,'test-runs',runId,'user-data'),'Only the isolated QA UUID profile may be used');report.profile=info.userData;
}
// The existing parser normalizes registry order on reload; identity and saved
// geometry are compared by stable widget ID rather than serialization order.
const settings=async()=>{
  const value=await page.evaluate(()=>window.electronP0.readSettings());
  return value?{...value,dashboard:{...value.dashboard,widgets:[...value.dashboard.widgets].sort((a,b)=>a.id.localeCompare(b.id))}}:value;
};
const library=()=>page.getByRole('complementary',{name:'위젯 편집'});
async function viewport(width,height){
  await application.evaluate(({BrowserWindow},size)=>{const window=BrowserWindow.getAllWindows()[0];window.unmaximize();window.setMinimumSize(320,400);window.webContents.setZoomFactor(1);window.setContentSize(size.width,size.height);},{width,height});
  await expect.poll(()=>page.evaluate(()=>[innerWidth,innerHeight])).toEqual([width,height]);
}
async function capture(state,width,height){
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
  const metrics=await page.evaluate(measureWidgetLibrary);
  const native=await application.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];return {bounds:window.getBounds(),content:window.getContentBounds(),visible:window.isVisible(),zoom:window.webContents.getZoomFactor()};});
  assert.equal(metrics.cards.length,13);assert.equal(metrics.pageOverflow,0);assert.equal(metrics.libraryOverflow,0);assert.equal(metrics.overlaps.length,0);
  assert.ok(metrics.cards.every(card=>card.titleFits&&card.descriptionFits));
  assert.ok(metrics.groups.every(group=>group.columns===(group.width>=960?3:group.width>=560?2:1)));
  assert.equal(native.visible,true);assert.equal(native.zoom,1);
  const file=`screenshots/${state}-${width}x${height}.png`,bytes=await page.screenshot();
  await writeFile(join(output,file),bytes);await writeFile(join(output,file+'.dom.json'),JSON.stringify({metrics,native},null,2));
  report.captures.push({file,sha256:createHash('sha256').update(bytes).digest('hex'),viewport:{width,height},rendered:true,source:'built production Electron renderer',nativeDpi:'NOT RUN'});await save();
}
async function openSettings(){
  await page.getByRole('navigation',{name:'주요 기능'}).locator('button[data-dock-item="settings"]').click();
  await page.getByRole('navigation',{name:'설정 카테고리'}).getByRole('button',{name:'위젯',exact:true}).click();await library().waitFor();
}
async function closeSettings(){await page.getByRole('button',{name:'설정 닫기',exact:true}).click();}
async function toggle(control,type,visible){
  await control.click();await expect(control).toHaveAttribute('aria-checked',String(visible));
  await expect.poll(async()=>{const value=await settings();return value?.dashboard.widgets.find(widget=>widget.type===type)?.visible;}).toBe(visible);
}
try{
  await launch();await viewport(1440,900);
  await expect.poll(settings).not.toBeNull();
  const initial=await settings();assert.ok(initial);
  // Seed only the disposable profile through the real validated settings API.
  const {presetId,...dashboard}=initial.dashboard;
  const seeded={...initial,dashboard:{...dashboard,widgets:dashboard.widgets.map(widget=>widget.type==='clock'?{...widget,x:1,y:30}:widget)}};
  await page.evaluate(value=>window.electronP0.writeSettings(value),seeded);await page.reload();
  await page.getByRole('button',{name:'나중에 설정',exact:true}).click();
  await page.getByRole('navigation',{name:'주요 기능'}).waitFor();
  const memo=page.getByRole('textbox',{name:'빠른 메모 입력',exact:true});
  await memo.fill('UX-10 합성 메모 — 위젯 OFF/ON 및 재실행 보존');
  await page.getByRole('button',{name:'메모 저장',exact:true}).click();
  await expect(page.locator('[data-memo-status]')).toHaveText('메모 저장됨');
  await openSettings();const before=await settings();assert.ok(before);assert.equal(before.dashboard.widgets.length,13);
  for(const [width,height] of sizes){
    await viewport(width,height);await library().getByRole('switch').first().scrollIntoViewIfNeeded();await capture('settings-top',width,height);
    await library().getByRole('switch').nth(6).scrollIntoViewIfNeeded();await capture('settings-middle',width,height);
    await library().getByRole('switch').last().scrollIntoViewIfNeeded();await capture('settings-bottom',width,height);
  }
  for(const widget of before.dashboard.widgets){
    const card=library().locator(`article[data-widget-type="${widget.type}"]`),control=card.getByRole('switch');
    await toggle(control,widget.type,!widget.visible);await toggle(control,widget.type,widget.visible);
  }
  const after=await settings();assert.deepEqual(after,before,'All saved IDs, geometry, settings, hidden flags and Dock must survive toggles');
  report.checks.all13RoundTripsPreserveSettings=true;
  const clock=library().getByRole('switch',{name:'날짜·시계 표시',exact:true});
  await clock.focus();await page.keyboard.press('Space');await expect(clock).toHaveAttribute('aria-checked','false');
  await capture('settings-off-keyboard-focus',980,700);
  await page.keyboard.press('Space');await expect(clock).toHaveAttribute('aria-checked','true');
  await expect.poll(settings).toEqual(before);
  report.checks.keyboardSpaceToggle=true;
  await viewport(560,700);await clock.scrollIntoViewIfNeeded();await capture('narrow-one-column',560,700);
  await closeSettings();
  await page.getByRole('navigation',{name:'주요 기능'}).locator('button[data-dock-item="toolbox"]').click();
  await expect(page.getByRole('button',{name:'보건소식지 제작소',exact:true})).toBeVisible();
  await page.getByRole('searchbox',{name:'업무 도구 검색'}).fill('공문');await expect(page.getByRole('button',{name:'공문작업실',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'위젯 표시 설정',exact:true}).click();await library().waitFor();
  for(const [width,height] of sizes){await viewport(width,height);await library().getByRole('switch').first().scrollIntoViewIfNeeded();await capture('editor-top',width,height);await library().getByRole('switch').nth(6).scrollIntoViewIfNeeded();await capture('editor-middle',width,height);await library().getByRole('switch').last().scrollIntoViewIfNeeded();await capture('editor-bottom',width,height);}
  const editorBefore=await settings();assert.deepEqual(editorBefore,before,'Opening editor must preserve saved geometry');
  for(const widget of editorBefore.dashboard.widgets){
    const control=library().locator(`article[data-widget-type="${widget.type}"]`).getByRole('switch');
    await toggle(control,widget.type,!widget.visible);await toggle(control,widget.type,widget.visible);
    await expect.poll(settings).toEqual(editorBefore);
  }
  report.checks.editorAll13RoundTripsPreserveSettings=true;
  const beforeOff=await settings();assert.ok(beforeOff);
  const memoSwitch=library().getByRole('switch',{name:'빠른 메모 표시',exact:true});await toggle(memoSwitch,'quick-memo',false);
  const expectedOff={...beforeOff,dashboard:{...beforeOff.dashboard,widgets:beforeOff.dashboard.widgets.map(widget=>widget.type==='quick-memo'?{...widget,visible:false}:widget)}};
  await expect.poll(settings).toEqual(expectedOff);
  await application.close();application=null;await launch();
  await expect.poll(settings).toEqual(expectedOff);await expect(page.getByRole('textbox',{name:'빠른 메모 입력',exact:true})).toHaveCount(0);
  await openSettings();await toggle(library().getByRole('switch',{name:'빠른 메모 표시',exact:true}),'quick-memo',true);await closeSettings();
  await expect(page.getByRole('textbox',{name:'빠른 메모 입력',exact:true})).toHaveValue('UX-10 합성 메모 — 위젯 OFF/ON 및 재실행 보존');
  await application.close();application=null;await launch();
  await expect.poll(settings).toEqual(beforeOff);await expect(page.getByRole('textbox',{name:'빠른 메모 입력',exact:true})).toHaveValue('UX-10 합성 메모 — 위젯 OFF/ON 및 재실행 보존');
  report.checks.offRestartOnRestartPreservesSettingsAndMemo=true;
  report.checks.toolboxAndNewsletterEntryPreserved=true;
  assert.deepEqual(report.errors,[]);report.verdict='PASS';
}catch(error){report.verdict='FAIL';report.failure=String(error);throw error;}
finally{if(application)await application.close();report.cleanup=true;await save();}
