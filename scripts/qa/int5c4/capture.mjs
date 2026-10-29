import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { startServer } from './server.mjs';
import { inspect } from './dom.mjs';
import { chromium } from './tools/node_modules/playwright-core/index.mjs';

const productSha='32d40c1769b587f917416f17bc588d7e62d7084f';
if(process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_OS!=='Windows'||process.env.GITHUB_REF!=='refs/heads/codex/int5c3-windows-qa') throw Error('Dedicated remote Windows only');
const source=path.join(process.env.GITHUB_WORKSPACE,'source'),out=path.join(process.env.QA_ROOT,'evidence');
const git=(...args)=>execFileSync('git',args,{cwd:source,encoding:'utf8'}).trim();
if(git('rev-parse','HEAD')!==productSha)throw Error('Product SHA mismatch');
const captures=[],assertions=[],events=[];
const json=(n,v)=>fs.writeFile(path.join(out,n),JSON.stringify(v,null,2));
let server,browser,context,failure;
const cleanup={browserClosed:false,serverClosed:false,userProfileReused:false};
try{
  server=await startServer(path.join(source,'dist'));
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({locale:'ko-KR',timezoneId:'Asia/Seoul',deviceScaleFactor:1,serviceWorkers:'block'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===server.origin?r.continue():r.abort('blockedbyclient'));
  await context.routeWebSocket('**/*',s=>s.close());
  const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>events.push({type:'pageerror',message:e.message}));
  page.on('console',m=>{if(m.type()==='error')events.push({type:'console',message:m.text()});});
  page.on('dialog',d=>d.dismiss());
  const button=n=>page.getByRole('button',{name:n,exact:true});
  const nav=()=>page.getByRole('navigation',{name:'주요 기능'});
  async function home(){
    await page.goto(server.origin,{waitUntil:'networkidle'});
    if(await button('다음').count()){await button('다음').click();await button('나중에 연결').click();await button('시작하기').click();}
    await nav().waitFor();
  }
  async function cap(name,vp){
    await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
    const dom=await page.evaluate(inspect),file=`${name}-${vp.width}x${vp.height}.png`;
    const bytes=await page.screenshot({animations:'disabled'});await fs.writeFile(path.join(out,file),bytes);
    await json(file+'.dom.json',dom);captures.push({file,state:name,viewport:vp,productSha,rendered:true,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),browser:browser.version(),dpr:1,nativeDpi:'NOT RUN'});
    await json('captures.json',captures);
    assertions.push({state:name,viewport:vp,pageFits:dom.page.scrollWidth<=dom.page.clientWidth,financeContrast:dom.finance.filter(x=>x.contrast!==null).every(x=>x.contrast>=4.5),helperNoOrphan:dom.helpers.every(x=>!x.orphanEnding),purchaseFitEstimate:dom.purchase?.fitEstimate??null});
    return dom;
  }
  for(const vp of [{width:980,height:700},{width:1280,height:720},{width:1366,height:768},{width:1440,height:900}]){
    await page.setViewportSize(vp);await home();await cap('dashboard-smoke',vp);
    await page.getByRole('button',{name:'MY FINANCE 개인 수입 관리',exact:true}).click();
    await page.locator('.finance-area-tabs').waitFor();
    async function tabs(group,label){
      const selected=page.locator(`${group} button.is-active`),other=page.locator(`${group} button:not(.is-active)`).first();
      await page.mouse.move(0,0);await cap(label+'-rest',vp);
      await selected.hover();await cap(label+'-selected-hover',vp);
      await page.mouse.move(0,0);await page.keyboard.press('Tab');await selected.focus();await cap(label+'-focus',vp);
      await other.hover();await cap(label+'-other-hover',vp);
    }
    await tabs('.finance-area-tabs','finance-area');
    await page.locator('.finance-area-tabs button').nth(1).click();
    if(await page.locator('.finance-phase2-tabs').count())await tabs('.finance-phase2-tabs','finance-phase2');
    else events.push({type:'NOT RUN',state:'finance-phase2',reason:'Product requires Native snapshot; no fake storage injected',viewport:vp});
    await home();await nav().getByRole('button',{name:'업무 도구',exact:true}).click();
    await page.locator('.toolbox-panel__launch').filter({hasText:'품의 도우미'}).click();
    await button('품목 추가').click();await page.getByRole('textbox',{name:'1행 품명',exact:true}).fill('합성 QA 물품');
    await page.getByRole('textbox',{name:'1행 수량',exact:true}).fill('2');await page.getByRole('textbox',{name:'1행 단가',exact:true}).fill('1000');
    await page.getByRole('tab',{name:'구매결과',exact:true}).click();
    const select=page.getByRole('combobox',{name:'1행 구매 상태',exact:true});await select.waitFor();
    for(const status of ['pending','purchased','partial','cancelled']){
      await select.selectOption(status);await select.scrollIntoViewIfNeeded();
      if(await select.inputValue()!==status)throw Error('Native select state change failed');
      await cap('purchase-'+status,vp);
    }
    await home();await nav().getByRole('button',{name:'업무 도구',exact:true}).click();
    await page.locator('.toolbox-panel__launch').filter({hasText:'공문 작업실'}).click();
    const help=page.locator('.official-document-prompt-help').last();await help.scrollIntoViewIfNeeded();await cap('official-help',vp);
  }
  if(git('diff','--name-only'))throw Error('Product tracked source changed');
}catch(e){failure=e;}
finally{
  try{if(context)await context.close();if(browser)await browser.close();cleanup.browserClosed=true;}catch(e){cleanup.browserError=String(e);}
  try{if(server)await server.close();cleanup.serverClosed=true;}catch(e){cleanup.serverError=String(e);}
  await json('events.json',events);await json('visual-assertions.json',assertions);await json('cleanup.json',cleanup);
  await json('visual-summary.json',{productSha,controllerSha:process.env.GITHUB_SHA,workflowSha:process.env.QA_WORKFLOW_SHA,captureCount:captures.length,error:failure?String(failure):null,verdict:'REVIEW REQUIRED',nativeStorage:'NOT RUN',nativeDpi:'NOT RUN',selectFit:'DOM estimate + screenshot manual review required'});
}
if(failure)throw failure;
