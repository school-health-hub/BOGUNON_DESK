import {expect, _electron as electron, test, type ElectronApplication, type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';

const appRoot=join(process.cwd(),'build/electron-p0-app');

async function palettePages(app:ElectronApplication):Promise<readonly Page[]>{
  await expect.poll(()=>app.windows().filter(page=>page.url().includes('/renderer/palette/')).length).toBeGreaterThanOrEqual(2);
  const pages=app.windows().filter(page=>page.url().includes('/renderer/palette/'));
  await Promise.all(pages.map(page=>page.getByRole('main',{name:'BOGUNON DESK 바탕화면 위젯'}).waitFor()));
  return pages;
}

test('Desktop Palette paints only widget and Dock surfaces over a transparent canvas',async()=>{
  const app=await electron.launch({
    chromiumSandbox:true,
    args:[appRoot],
    env:{...process.env,ELECTRON_P0_TEST_RUN:randomUUID(),ELECTRON_P0_DEV_URL:''},
  });
  try{
    const pages=await palettePages(app);
    for(const page of pages){
      const canvas=await page.evaluate(()=>{
        const main=document.querySelector<HTMLElement>('.desktop-palette');
        if(!main)throw new Error('Palette root not found');
        const style=(element:Element,pseudo?:string)=>{
          const computed=getComputedStyle(element,pseudo);
          return {backgroundColor:computed.backgroundColor,backgroundImage:computed.backgroundImage,content:computed.content};
        };
        return {
          html:style(document.documentElement),
          body:style(document.body),
          root:style(document.getElementById('root')!),
          main:style(main),
          before:style(main,'::before'),
          after:style(main,'::after'),
          dashboardCount:document.querySelectorAll('.workspace-dashboard').length,
        };
      });
      for(const layer of [canvas.html,canvas.body,canvas.root,canvas.main]){
        expect(layer.backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(layer.backgroundImage).toBe('none');
      }
      expect(canvas.before.content).toBe('none');
      expect(canvas.after.content).toBe('none');
      expect(canvas.dashboardCount).toBe(0);
      const quickLauncher=page.locator('[data-widget-type="quick-launcher"] .quick-launcher');
      if(await quickLauncher.count()){
        expect(await quickLauncher.evaluate(element=>element.scrollHeight)).toBeLessThanOrEqual(await quickLauncher.evaluate(element=>element.clientHeight));
      }
    }
    const emptyPixelAlpha=await app.evaluate(async({BrowserWindow})=>Promise.all(BrowserWindow.getAllWindows()
      .filter(window=>window.webContents.getURL().includes('/renderer/palette/'))
      .map(async window=>(await window.capturePage({x:4,y:4,width:1,height:1})).toBitmap()[3])));
    expect(emptyPixelAlpha).toEqual(pages.map(()=>0));
    await pages[0].screenshot({path:'artifacts/ux-07e-widget-settings/palette-transparent-canvas.png'});
  }finally{
    await app.close();
  }
});
