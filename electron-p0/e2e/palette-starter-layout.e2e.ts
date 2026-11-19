import {expect,_electron as electron,test,type ElectronApplication,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';

const appRoot=join(process.cwd(),'build/electron-p0-app');
const coreIds=['widget-clock','widget-today-summary','widget-quick-memo'] as const;

async function palettePages(app:ElectronApplication):Promise<readonly Page[]>{
  await expect.poll(()=>app.windows().filter(page=>page.url().includes('/renderer/palette/')).length).toBeGreaterThanOrEqual(2);
  const pages=app.windows().filter(page=>page.url().includes('/renderer/palette/'));
  await Promise.all(pages.map(page=>page.getByRole('main',{name:'BOGUNON DESK 바탕화면 위젯'}).waitFor()));
  return pages;
}

test('new Desktop Palette profiles leave desktop space open and preserve monitor-local choices',async()=>{
  const runId=randomUUID();
  const launch=()=>electron.launch({chromiumSandbox:true,args:[appRoot],env:{...process.env,ELECTRON_P0_TEST_RUN:runId,ELECTRON_P0_DEV_URL:''}});
  let app=await launch();
  try{
    let pages=await palettePages(app);
    const surfaces=await Promise.all(pages.map(page=>page.evaluate(()=>window.electronPalette.readSurface())));
    const primaryIndex=surfaces.findIndex(surface=>surface.ownedWidgetIds.length>0);
    expect(primaryIndex).toBeGreaterThanOrEqual(0);
    expect(surfaces[primaryIndex].ownedWidgetIds).toEqual(coreIds);
    expect(surfaces.filter((_,index)=>index!==primaryIndex).every(surface=>surface.ownedWidgetIds.length===0)).toBe(true);

    const primary=pages[primaryIndex];
    const visibleIds=await primary.locator('[data-widget-type]').evaluateAll(elements=>elements.map(element=>`widget-${element.getAttribute('data-widget-type')}`));
    expect(new Set(visibleIds)).toEqual(new Set(coreIds));
    const occupiedRatio=await primary.locator('[data-widget-type]').evaluateAll(elements=>elements.reduce((area,element)=>{
      const rect=element.getBoundingClientRect();return area+rect.width*rect.height;
    },0)/(innerWidth*innerHeight));
    expect(occupiedRatio).toBeLessThan(0.35);

    await primary.getByRole('button',{name:'위젯 편집'}).click();
    const clock=primary.locator('[data-widget-type="clock"]');
    const beforeClock=await clock.boundingBox();
    const dragHandle=await clock.getByRole('button',{name:'날짜·시계 이동'}).boundingBox();
    expect(beforeClock).not.toBeNull();expect(dragHandle).not.toBeNull();
    await primary.mouse.move(dragHandle!.x+dragHandle!.width/2,dragHandle!.y+dragHandle!.height/2);
    await primary.mouse.down();
    await primary.mouse.move(dragHandle!.x-180,dragHandle!.y+150,{steps:8});
    await primary.mouse.up();
    await expect.poll(async()=>Math.round((await clock.boundingBox())!.x)).not.toBe(Math.round(beforeClock!.x));
    const resizeHandle=await clock.locator('.react-resizable-handle-se').boundingBox();
    expect(resizeHandle).not.toBeNull();
    const beforeWidth=(await clock.boundingBox())!.width;
    await primary.mouse.move(resizeHandle!.x+resizeHandle!.width/2,resizeHandle!.y+resizeHandle!.height/2);
    await primary.mouse.down();
    await primary.mouse.move(resizeHandle!.x+100,resizeHandle!.y+40,{steps:8});
    await primary.mouse.up();
    await expect.poll(async()=>Math.round((await clock.boundingBox())!.width)).not.toBe(Math.round(beforeWidth));
    await primary.getByRole('button',{name:'완료'}).click();

    const secondary=pages.find((_,index)=>index!==primaryIndex)!;
    await secondary.getByRole('button',{name:'위젯 선택'}).click();
    await secondary.getByRole('button',{name:/위젯 추가/}).click();
    const quickLauncher=secondary.getByRole('article').filter({hasText:'빠른 실행'});
    await quickLauncher.getByRole('button',{name:'추가'}).click();
    await expect.poll(async()=>{
      const current=await Promise.all(pages.map(page=>page.evaluate(()=>window.electronPalette.readSurface())));
      return current.flatMap(surface=>surface.ownedWidgetIds).filter(id=>id==='widget-quick-launcher').length;
    }).toBe(1);
    await secondary.getByRole('button',{name:'완료'}).click();

    await app.close();
    app=await launch();
    pages=await palettePages(app);
    const restored=await Promise.all(pages.map(page=>page.evaluate(()=>window.electronPalette.readSurface())));
    expect(restored.flatMap(surface=>surface.ownedWidgetIds).filter(id=>id==='widget-quick-launcher')).toHaveLength(1);
    expect(restored.some(surface=>surface.ownedWidgetIds.length===1&&surface.ownedWidgetIds[0]==='widget-quick-launcher')).toBe(true);
    await pages[0].screenshot({path:'artifacts/ux-07e-widget-settings/palette-open-starter-layout.png'});
  }finally{
    await app.close();
  }
});
