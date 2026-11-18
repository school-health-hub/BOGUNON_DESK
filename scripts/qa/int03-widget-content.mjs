import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,relative,isAbsolute,join,sep} from 'node:path';

assert.equal(process.platform,'win32','Actual Windows Electron required');
const source=process.cwd(),root=resolve(process.env.INT03_QA_ROOT??resolve(source,'..'));
assert.ok(process.env.INT03_CONTENT_OUTPUT,'Explicit evidence output required');
const out=resolve(process.env.INT03_CONTENT_OUTPUT),child=relative(root,out);
assert.ok(child&&child!=='..'&&!child.startsWith('..'+sep)&&!isAbsolute(child));
const fromSource=relative(source,out);
assert.ok(fromSource==='..'||fromSource.startsWith('..'+sep)||isAbsolute(fromSource),'Evidence must be outside source');
const temp=join(out,'temp'),qa=join(temp,'profile'),id=randomUUID();
await mkdir(qa,{recursive:true});
const report={captures:[],states:[],focus:[],checks:{},errors:[],cleanup:false};
let app,page;
const settings=()=>page.evaluate(()=>window.electronP0.readSettings());
const widget=type=>page.locator(`.desktop-widget-grid > [data-widget-type="${type}"]`);
async function save(name){
 const bytes=await page.screenshot({caret:'initial'}),file=name+'.png';
 await writeFile(join(out,file),bytes);
 report.captures.push({file,sha256:createHash('sha256').update(bytes).digest('hex'),rendered:true,viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))});
}
async function focusMetrics(){
 return page.evaluate(()=>{
  const e=document.activeElement;if(!(e instanceof HTMLElement))return null;
  const r=e.getBoundingClientRect(),main=document.querySelector('.workspace-dashboard'),dock=document.querySelector('[aria-label="주요 기능"]');
  const clips=[{top:0,left:0,right:innerWidth,bottom:innerHeight}];
  for(let p=e.parentElement;p;p=p.parentElement){const c=getComputedStyle(p),b=p.getBoundingClientRect();if(c.display!=='contents'&&(c.overflowX!=='visible'||c.overflowY!=='visible'))clips.push({top:b.top+p.clientTop,left:b.left+p.clientLeft,right:b.left+p.clientLeft+p.clientWidth,bottom:b.top+p.clientTop+p.clientHeight});}
  if(main?.contains(e)){const m=main.getBoundingClientRect();clips.push({top:m.top,left:m.left,right:m.left+main.clientWidth,bottom:Math.min(m.bottom,dock.getBoundingClientRect().top)});}
  const c=getComputedStyle(e);
  const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
  return {name:e.getAttribute('aria-label')??e.textContent?.trim(),tag:e.tagName,rect:{top:r.top,left:r.left,right:r.right,bottom:r.bottom},clips,focusVisible:e.matches(':focus-visible'),outline:c.outline,visible:e.checkVisibility(),centerHit:e.contains(hit),centerElement:hit instanceof HTMLElement?{tag:hit.tagName,className:hit.className,text:hit.textContent?.trim().slice(0,80)}:null,fullyVisible:clips.every(b=>r.top>=b.top-1&&r.left>=b.left-1&&r.right<=b.right+1&&r.bottom<=b.bottom+1)};
 });
}
async function tabTo(target){
 for(let i=0;i<300;i++){
  if(await target.evaluate(e=>e===document.activeElement))return;
  await page.keyboard.press('Tab');
 }
 throw Error('Keyboard target not reachable by Tab');
}
async function checkFocus(label){
 await expect.poll(async()=>(await focusMetrics())?.fullyVisible,{timeout:3000,message:label+' must be entirely visible without pointer scrolling'}).toBe(true);
 const metric=await focusMetrics();assert.equal(metric.visible,true);assert.equal(metric.focusVisible,true);assert.equal(metric.centerHit,true,label+' must not be covered');
 report.focus.push({label,...metric});return metric;
}
async function keyActivate(target,key='Enter'){
 await tabTo(target);await checkFocus(await target.getAttribute('aria-label')??await target.innerText());await page.keyboard.press(key);
}
try{
 app=await electron.launch({executablePath:join(source,'node_modules/electron/dist/electron.exe'),args:[join(source,'build/electron-p0-app')],chromiumSandbox:true,env:{...process.env,ELECTRON_P0_DEV_URL:'',ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_QA_ROOT:qa,ELECTRON_P0_TEST_RUN:id,RUNNER_TEMP:temp,TEMP:temp,TMP:temp}});
 page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.getByRole('button',{name:'나중에 설정',exact:true}).click();
 report.native=await app.evaluate(({screen,BrowserWindow})=>({scale:screen.getPrimaryDisplay().scaleFactor,zoom:BrowserWindow.getAllWindows()[0].webContents.getZoomFactor()}));
 assert.deepEqual(report.native,{scale:1,zoom:1});
 report.build=JSON.parse(await readFile(join(source,'build/electron-p0-app/build-meta.json'),'utf8'));
 assert.equal(report.build.sourceSha,process.env.INT03_EXPECTED_SOURCE_SHA);
 const before=await settings();report.settingsBefore=before;
 for(const mode of ['view','edit']){
  if(mode==='edit')await keyActivate(page.getByRole('button',{name:'화면 꾸미기',exact:true}));
  for(const [w,h]of [[1440,900],[1366,768],[1280,720],[980,700]]){
   await app.evaluate(({BrowserWindow},[w,h])=>{const win=BrowserWindow.getAllWindows()[0];win.unmaximize();win.setContentSize(w,h);win.setPosition(8,8);},[w,h]);
   await expect.poll(()=>page.evaluate(()=>[innerWidth,innerHeight])).toEqual([w,h]);
   const state={mode,viewport:{w,h},controls:[]};report.currentState=state;
   const textarea=widget('quick-memo').locator('textarea');
   state.disabledGrouping=await textarea.evaluate(e=>{const group=e.closest('fieldset'),original=group.disabled;try{group.disabled=true;return{display:getComputedStyle(group).display,inheritedDisabled:e.matches(':disabled')};}finally{group.disabled=original;}});
   assert.equal(state.disabledGrouping.inheritedDisabled,true);await tabTo(textarea);await checkFocus('memo textarea');
   await page.keyboard.press('Control+A');await page.keyboard.insertText('합성 QA 메모\n마지막 줄 끝.');await page.keyboard.press('Control+End');
   await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowRight');await checkFocus('memo final-line caret host');
   state.memo=await textarea.evaluate(e=>({text:e.value,start:e.selectionStart,end:e.selectionEnd,scrollTop:e.scrollTop,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight}));
   assert.equal(state.memo.end,state.memo.text.length);await save(`${mode}-${w}x${h}-memo-input`);
   await page.keyboard.press('Shift+Tab');await expect(widget('quick-memo').getByRole('button',{name:'메모 저장',exact:true})).toBeFocused();await checkFocus('memo save Shift+Tab');
   await page.keyboard.press('Space');await expect(widget('quick-memo').locator('[data-memo-status]')).toHaveText('메모 저장됨');
   await expect(widget('quick-memo').getByRole('button',{name:'메모 저장',exact:true})).toBeEnabled();await expect(textarea).toBeEnabled();
   await page.keyboard.press('Tab');await expect(textarea).toBeFocused();await checkFocus('memo Tab return');
   for(const name of ['복사','비우기','업무로 보내기']){const b=widget('quick-memo').getByRole('button',{name,exact:true});await tabTo(b);state.controls.push(await checkFocus('memo '+name));}
   await save(`${mode}-${w}x${h}-memo-actions`);
   for(const name of ['온라인 보건실','BOGUNON','업무포털','업무 도구']){await tabTo(widget('quick-launcher').getByRole('button',{name,exact:true}));state.controls.push(await checkFocus('launcher '+name));}
   await save(`${mode}-${w}x${h}-launcher-actions`);
   const empty=widget('quick-launcher').getByRole('button',{name:/등록된 폴더가 없습니다/});await tabTo(empty);state.controls.push(await checkFocus('launcher folder entry'));await save(`${mode}-${w}x${h}-launcher-folders`);
   state.overflow=await page.evaluate(()=>{const e=document.querySelector('.workspace-dashboard');return{page:document.documentElement.scrollWidth-innerWidth,workspace:e.scrollWidth-e.clientWidth};});assert.deepEqual(state.overflow,{page:0,workspace:0});
   report.states.push(state);await writeFile(join(out,'progress.json'),JSON.stringify(report,null,2));
  }
 }
 const infoTrigger=widget('quick-memo').getByRole('button',{name:'빠른 메모 설정 보기',exact:true});
 for(const close of ['Enter','Escape']){
  await keyActivate(infoTrigger);const dialog=page.getByRole('dialog',{name:'빠른 메모 위젯 정보',exact:true});await expect(dialog).toBeVisible();
  await tabTo(dialog.getByRole('button',{name:'위젯 정보 닫기',exact:true}));await checkFocus('widget information close');await page.keyboard.press(close);await expect(dialog).toHaveCount(0);await expect(infoTrigger).toBeFocused();await checkFocus('widget information focus return');
 }
 await keyActivate(page.getByRole('button',{name:'완료',exact:true}));
 assert.deepEqual(await settings(),before);report.checks.noAutomaticLayoutWrites=true;
 const dockSettings=page.getByRole('navigation',{name:'주요 기능'}).locator('[data-dock-item="settings"]');await keyActivate(dockSettings);
 await keyActivate(page.getByRole('navigation',{name:'설정 카테고리'}).getByRole('button',{name:'위젯',exact:true}));
 const switches=page.getByRole('switch');assert.equal(await switches.count(),13);
 for(let i=0;i<13;i++){
  const sw=switches.nth(i),initial=await sw.getAttribute('aria-checked'),type=await sw.evaluate(e=>e.closest('[data-widget-type]').getAttribute('data-widget-type'));
  await tabTo(sw);await checkFocus('widget switch '+i);await page.keyboard.press('Space');await expect(sw).toHaveAttribute('aria-checked',String(initial!=='true'));
  await expect.poll(async()=>(await settings()).dashboard.widgets.find(w=>w.type===type).visible).toBe(initial!=='true');
  await page.keyboard.press('Space');await expect(sw).toHaveAttribute('aria-checked',initial);
  await expect.poll(async()=>(await settings()).dashboard.widgets.find(w=>w.type===type).visible).toBe(initial==='true');
 }
 await keyActivate(page.getByRole('button',{name:'설정 닫기',exact:true}));await expect(dockSettings).toBeFocused();await checkFocus('settings focus return');
 await keyActivate(widget('quick-launcher').getByRole('button',{name:'업무 도구',exact:true}));
 await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(widget('quick-launcher').getByRole('button',{name:'업무 도구',exact:true})).toBeFocused();
 const after=await settings(),expected=structuredClone(before);delete expected.dashboard.presetId;
 // Existing explicit hide/restore marks the layout custom; parser order is not widget identity.
 for(const value of [after,expected])value.dashboard.widgets.sort((a,b)=>a.id.localeCompare(b.id));
 assert.deepEqual(after,expected);report.settingsAfter=after;assert.deepEqual(report.errors,[]);report.checks.keyboardOnlyStateActions=true;report.checks.widgetFieldsAppearanceAndDockPreserved=true;report.checks.presetId='Existing markLayoutCustom transition only after explicit switches; exact settings equality verified before toggles';report.checks.caretPixels='Requires direct review of actual caret:initial screenshots; selectionEnd alone is not a visual verdict';report.verdict='AUTOMATED GUI CHECKS PASS — independent visual review required';
}catch(e){report.verdict='FAIL';report.failure=String(e);if(page){report.failureFocus=await focusMetrics();await save('failure');}process.exitCode=1;}
finally{if(app)await app.close();report.cleanup=true;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({verdict:report.verdict,failure:report.failure,states:report.states.length,captures:report.captures.length,cleanup:report.cleanup}));
