import {expect,test,_electron as electron} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

test('Palette tools, widget resizing and newsletter shortcut use one isolated Workspace',async()=>{
  const qaRoot=process.env.DESKTOP_UX_02_QA_ROOT;
  if(!qaRoot)throw Error('DESKTOP_UX_02_QA_ROOT must be set');
  await mkdir(qaRoot,{recursive:true});
  const root=await mkdtemp(join(qaRoot,'profile-')),runId=randomUUID(),settings=join(root,'test-runs',runId,'user-data','poc-settings');
  await mkdir(settings,{recursive:true});
  await writeFile(join(settings,'onboarding.json'),JSON.stringify({version:1,completed:true}));
  const launch=()=>electron.launch({chromiumSandbox:true,args:[join(process.cwd(),'build/electron-p0-app')],env:{...process.env,RUNNER_TEMP:qaRoot,ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_QA_ROOT:root,ELECTRON_P0_TEST_RUN:runId,ELECTRON_P0_DEV_URL:''}});
  const app=await launch();
  try{
    await expect.poll(()=>app.windows().filter(page=>page.url().includes('/palette/')).length).toBeGreaterThan(0);
    const palette=app.windows().find(page=>page.url().includes('/palette/')&&page.locator('.palette-dock-region'));
    const workspace=app.windows().find(page=>!page.url().includes('/palette/'));
    if(!palette||!workspace)throw Error('Expected Palette and Workspace renderers');
    await expect(palette.locator('.palette-dock-region')).toBeVisible();
    await palette.locator('.palette-dock-region [data-dock-item="toolbox"]').evaluate(button=>(button as HTMLElement).click());
    await expect(palette.getByRole('region',{name:'업무 도구 선택'})).toBeVisible();
    await palette.getByRole('button',{name:'보건소식지 제작소 열기'}).evaluate(button=>(button as HTMLElement).click());
    await expect(workspace.getByRole('region',{name:'보건소식지 제작소'})).toBeVisible();
    await expect(workspace.locator('.workspace-dashboard')).toBeHidden();
    await expect(workspace.getByRole('dialog',{name:'학교 초기 설정'})).toHaveCount(0);
    await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(window=>window.isVisible()&&!window.webContents.getURL().includes('/palette/')).length)).toBe(1);
    await workspace.screenshot({path:join(qaRoot,'newsletter-direct.png')});
    await workspace.getByRole('button',{name:'보건 업무로'}).click();
    await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>!window.webContents.getURL().includes('/palette/'))?.isVisible())).toBe(false);
    await expect(palette.locator('.palette-dock-region')).toBeVisible();
    for(const name of ['공문작업실','품의 도우미','Record Helper','물품 관리','교육영상 Finder']){
      await palette.locator('.palette-dock-region [data-dock-item="toolbox"]').evaluate(button=>(button as HTMLElement).click());
      await palette.getByRole('button',{name:`${name} 열기`}).evaluate(button=>(button as HTMLElement).click());
      await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>!window.webContents.getURL().includes('/palette/'))?.isVisible())).toBe(true);
      await expect(workspace.locator('.workspace-dashboard')).toBeHidden();
      await expect(workspace.getByRole('dialog',{name:'학교 초기 설정'})).toHaveCount(0);
      await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>!window.webContents.getURL().includes('/palette/'))?.close());
      await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>!window.webContents.getURL().includes('/palette/'))?.isVisible())).toBe(false);
      await expect(palette.locator('.palette-dock-region')).toBeVisible();
    }
    await palette.getByRole('button',{name:'위젯 편집'}).evaluate(button=>(button as HTMLElement).click());
    await palette.locator('[data-widget-id="widget-quick-memo"] .widget-frame').evaluate(frame=>(frame as HTMLElement).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
    const menu=palette.getByLabel('선택한 위젯 메뉴');
    await expect(menu).toBeVisible();
    expect(await menu.evaluate(element=>{const rect=element.getBoundingClientRect();return rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight;})).toBe(true);
    await palette.screenshot({path:join(qaRoot,'widget-edit-menu.png')});
    const before=await palette.evaluate(()=>window.electronPalette.readSurface());
    await menu.getByRole('button',{name:'너비 +'}).evaluate(button=>(button as HTMLElement).click());
    await expect.poll(async()=>{const value=await palette.evaluate(()=>window.electronPalette.readSurface());const layout=value.layout as {widgets:{id:string;w:number}[]};return layout.widgets.find(widget=>widget.id==='widget-quick-memo')?.w;}).toBeGreaterThan((before.layout as {widgets:{id:string;w:number}[]}).widgets.find(widget=>widget.id==='widget-quick-memo')?.w??0);
    await palette.getByRole('button',{name:'완료'}).evaluate(button=>(button as HTMLElement).click());
    await palette.screenshot({path:join(qaRoot,'palette-widget-resized.png')});
    await palette.getByRole('button',{name:'위젯 편집'}).evaluate(button=>(button as HTMLElement).click());
    await palette.getByRole('button',{name:'위젯 추가'}).evaluate(button=>(button as HTMLElement).click());
    const newsletter=palette.locator('.palette-widget-library article').filter({hasText:'보건소식지 제작소'});
    await newsletter.getByRole('button',{name:'추가'}).evaluate(button=>(button as HTMLElement).click());
    await expect(palette.locator('[data-widget-id="widget-newsletter-shortcut"]')).toBeVisible();
    const monthly=palette.locator('.palette-widget-library article').filter({hasText:'월간 실무일정'});
    await monthly.getByRole('button',{name:'추가'}).evaluate(button=>(button as HTMLElement).click());
    await expect(palette.locator('[data-widget-id="widget-monthly-calendar"]')).toHaveAttribute('data-grid-width','4');
    await expect(palette.locator('[data-widget-id="widget-monthly-calendar"]')).toHaveAttribute('data-grid-height','5');
    await palette.getByRole('button',{name:'위젯 목록 닫기'}).evaluate(button=>(button as HTMLElement).click());
    await palette.getByRole('button',{name:'완료'}).evaluate(button=>(button as HTMLElement).click());
    await palette.screenshot({path:join(qaRoot,'monthly-compact-and-newsletter.png')});
    await palette.locator('[data-widget-id="widget-newsletter-shortcut"] button').first().evaluate(button=>(button as HTMLElement).click());
    await expect(workspace.getByRole('region',{name:'보건소식지 제작소'})).toBeVisible();
    await workspace.getByRole('button',{name:'보건 업무로'}).click();
    await expect(palette.locator('.palette-dock-region')).toBeVisible();
    const secondary=app.windows().find(page=>page.url().includes('/palette/')&&page!==palette);
    if(secondary){
      const target=await secondary.evaluate(()=>window.electronPalette.readSurface());
      await palette.evaluate(profileKey=>window.electronPalette.updateWidget({action:'move',widgetId:'widget-newsletter-shortcut',targetProfileKey:profileKey}),target.profileKey);
      await expect(secondary.locator('[data-widget-id="widget-newsletter-shortcut"]')).toBeVisible();
      await expect(palette.locator('[data-widget-id="widget-newsletter-shortcut"]')).toHaveCount(0);
      await secondary.getByRole('button',{name:'위젯 편집'}).evaluate(button=>(button as HTMLElement).click());
      await secondary.locator('[data-widget-id="widget-newsletter-shortcut"] .widget-frame').evaluate(frame=>(frame as HTMLElement).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
      const secondaryMenu=secondary.getByLabel('선택한 위젯 메뉴');
      await expect(secondaryMenu).toBeVisible();
      expect(await secondaryMenu.evaluate(element=>{const rect=element.getBoundingClientRect();return rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight;})).toBe(true);
      await secondary.screenshot({path:join(qaRoot,'secondary-widget-edit-menu.png')});
      await secondary.getByRole('button',{name:'완료'}).evaluate(button=>(button as HTMLElement).click());
      await secondary.screenshot({path:join(qaRoot,'secondary-newsletter-widget.png')});
      const primary=await palette.evaluate(()=>window.electronPalette.readSurface());
      await secondary.evaluate(profileKey=>window.electronPalette.updateWidget({action:'move',widgetId:'widget-newsletter-shortcut',targetProfileKey:profileKey}),primary.profileKey);
      await expect(palette.locator('[data-widget-id="widget-newsletter-shortcut"]')).toBeVisible();
      await expect(secondary.locator('[data-widget-id="widget-newsletter-shortcut"]')).toHaveCount(0);
    }
    const saved=JSON.parse(await readFile(join(settings,'desktop-surface.json'),'utf8'));
    expect(JSON.stringify(saved)).toContain('widget-quick-memo');
    expect(JSON.stringify(saved)).toContain('widget-newsletter-shortcut');
    await palette.evaluate(()=>window.electronPalette.openWorkspace());
    await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>!window.webContents.getURL().includes('/palette/'))?.isVisible())).toBe(true);
    await palette.locator('.palette-dock-region [data-dock-item="toolbox"]').evaluate(button=>(button as HTMLElement).click());
    await palette.getByRole('button',{name:'물품 관리 열기'}).evaluate(button=>(button as HTMLElement).click());
    await expect(workspace.locator('.td2-workspace[data-workspace="inventory"]')).toBeVisible();
    await expect(workspace.locator('.workspace-dashboard')).toBeHidden();
  }finally{await app.close();}
  const restarted=await launch();
  try{
    await expect.poll(()=>restarted.windows().filter(page=>page.url().includes('/palette/')).length).toBeGreaterThan(0);
    const palette=restarted.windows().find(page=>page.url().includes('/palette/'));
    if(!palette)throw Error('Palette did not restart');
    await expect(palette.locator('[data-widget-id="widget-newsletter-shortcut"]')).toBeVisible();
    await expect(palette.locator('[data-widget-id="widget-quick-memo"]')).toHaveAttribute('data-grid-width',/^[4-9]$/);
  }finally{await restarted.close();}
});
