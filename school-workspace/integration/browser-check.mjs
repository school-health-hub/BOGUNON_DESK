import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out='school-workspace/integration/evidence';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.SCHOOL01C_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try{
 for(const [client,width,height] of [['mobile',390,844],['desktop',980,700]]){
  for(const scenario of ['active','pending','session-expired','denied']){
   const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   // No external network is allowed in this synthetic preview.
   await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:5188'?route.continue():route.abort());
   await page.goto(`http://127.0.0.1:5188/school-workspace/integration/dev-ui/${client}.html?scenario=${scenario}`);
   await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('combobox').selectOption('synthetic-a');
   const expected=scenario==='active'?'공동 기능을 이용할 수 있습니다':scenario==='pending'?'학교 가입 승인을 기다리고 있습니다':scenario==='session-expired'?'로그인 시간이 만료되었습니다':'이 학교에 접근할 권한이 없습니다';
   await page.getByRole('status').filter({hasText:expected}).waitFor();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),text=await page.locator('body').innerText();
   if(overflow||errors.length||/accessToken|refreshToken|ws_v1|SCHOOL01C_MOCK/.test(text))throw Error(JSON.stringify({client,scenario,overflow,errors}));
   await page.screenshot({path:`${out}/${client}-${scenario}.png`,fullPage:true});
   await page.getByRole('button',{name:'로그아웃',exact:true}).click();await page.getByRole('status').filter({hasText:'로그인이 필요합니다'}).waitFor();
   results.push({classification:'MOCK UI + REAL Chromium',client,viewport:{width,height},scenario,result:'PASS',horizontalOverflow:overflow,pageErrors:errors});await page.close();
  }
 }
 await writeFile(`${out}/browser-check.json`,JSON.stringify({realHosted:'NOT RUN',results},null,2));console.log(`${results.length} browser cases PASS; MOCK UI only`);
}finally{await browser.close();}
