import type {ElectronApplication,Page} from '@playwright/test';
export function observeStartup(page:Page){
 const errors:string[]=[];const add=(s:string)=>{if(errors.length<20)errors.push(s);};
 page.on('pageerror',e=>add(e.message));page.on('requestfailed',r=>add(`${r.url()}: ${r.failure()?.errorText}`));page.on('console',m=>{if(m.type()==='error')add(m.text());});
 return async(app:ElectronApplication)=>({main:await app.evaluate(({BrowserWindow,app})=>({appPath:app.getAppPath(),windows:BrowserWindow.getAllWindows().map(w=>({bounds:w.getBounds(),url:w.webContents.getURL(),loading:w.webContents.isLoading()}))})),renderer:await page.evaluate(()=>({url:location.href,ready:document.readyState,head:document.head.innerHTML.slice(0,1000),body:document.body.innerText.slice(0,300),bridge:typeof window.electronP0})),errors});
}
