import {test,expect,_electron as electron} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {defaultAppearance,defaultWidgetLayouts} from '../../src/dashboard/layouts';

test('saved weekly slot exposes all weekdays without rewriting geometry in View/Edit',async()=>{
 test.setTimeout(180000);
 const root=process.env.ELECTRON_P0_QA_ROOT;
 if(!root)throw Error('An isolated ELECTRON_P0_QA_ROOT is required');
 const id=randomUUID(),settings=join(root,'test-runs',id,'user-data','poc-settings');
 const widgets=defaultWidgetLayouts.map(widget=>({...widget,visible:widget.type==='weekly-schedule',...(widget.type==='weekly-schedule'?{x:0,y:0}:{})}));
 const layout={version:1,dashboard:{version:1,appearance:defaultAppearance,widgets},dock:{version:2,items:[]}};
 await mkdir(settings,{recursive:true});
 await writeFile(join(settings,'layout.json'),JSON.stringify(layout),{flag:'wx'});
 await writeFile(join(settings,'desktop-surface.json'),JSON.stringify({version:2,mode:'window',profiles:{},dockProfileKey:null}),{flag:'wx'});
 const executablePath=process.env.ELECTRON_P0_EXECUTABLE;
 const app=await electron.launch({chromiumSandbox:true,timeout:90000,...(executablePath?{executablePath}:{}),args:executablePath?[]:[join(process.cwd(),'build/electron-p0-app')],env:{...process.env,ELECTRON_P0_TEST_RUN:id,ELECTRON_P0_DEV_URL:''}});
 try{
  await expect.poll(()=>app.windows().some(page=>page.url().endsWith('/renderer/index.html')),{timeout:30000}).toBe(true);
  const page=app.windows().find(page=>page.url().endsWith('/renderer/index.html'));
  if(!page)throw Error('Owned Workspace window missing');
  const later=page.getByRole('button',{name:'나중에 설정',exact:true});await page.addLocatorHandler(later,()=>later.click());
  for(const [width,height] of [[1440,900],[1366,768],[1280,720],[980,700]]){
   await app.evaluate(({BrowserWindow},size)=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/renderer/index.html'));if(!w)throw Error('Workspace missing');w.setContentSize(size.width,size.height);},{width,height});
   for(const mode of ['view','edit']){
    if(mode==='edit')await page.getByRole('button',{name:'화면 꾸미기',exact:true}).click();
    const widget=page.locator('[data-widget-type="weekly-schedule"]');await widget.scrollIntoViewIfNeeded();
    await expect(widget.locator('.week-grid article header span')).toHaveText(['월','화','수','목','금','토','일']);
    await expect.poll(()=>widget.evaluate(w=>{
     const frame=w.querySelector('.widget-frame'),panel=w.querySelector('.week-panel');
     if(!(frame instanceof HTMLElement)||!(panel instanceof HTMLElement))return false;
     const f=frame.getBoundingClientRect(),p=panel.getBoundingClientRect();
     return p.bottom<=f.bottom+1&&p.top>=f.top&&panel.clientHeight>0&&(panel.scrollHeight<=panel.clientHeight+1||/auto|scroll/.test(getComputedStyle(panel).overflowY));
    })).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
    if(mode==='edit')await page.getByRole('button',{name:'완료',exact:true}).click();
   }
  }
  expect(JSON.parse(await readFile(join(settings,'layout.json'),'utf8')).dashboard.widgets).toEqual(widgets);
 }finally{await app.close();}
});
