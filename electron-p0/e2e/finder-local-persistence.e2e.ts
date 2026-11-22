import {test,expect,_electron as electron,type ElectronApplication} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';

test('Finder keeps a synthetic local video and note after restart',async()=>{
 test.setTimeout(180000);
 const qaRoot=process.env.ELECTRON_P0_QA_ROOT;
 if(!qaRoot)throw Error('An isolated ELECTRON_P0_QA_ROOT is required');
 const id=randomUUID(),settings=join(qaRoot,'test-runs',id,'user-data','poc-settings');
 await mkdir(settings,{recursive:true});
 await writeFile(join(settings,'desktop-surface.json'),JSON.stringify({version:2,mode:'window',profiles:{},dockProfileKey:null}),{flag:'wx'});
 const executablePath=process.env.ELECTRON_P0_EXECUTABLE;
 const launch=()=>electron.launch({chromiumSandbox:true,timeout:90000,
  ...(executablePath?{executablePath}:{}),args:executablePath?[]:[join(process.cwd(),'build/electron-p0-app')],
  env:{...process.env,ELECTRON_P0_TEST_RUN:id,ELECTRON_P0_DEV_URL:''}});
 const openFinder=async(app:ElectronApplication)=>{
  await expect.poll(()=>app.windows().some(page=>page.url().endsWith('/renderer/index.html')),{timeout:30000}).toBe(true);
  const page=app.windows().find(page=>page.url().endsWith('/renderer/index.html'));
  if(!page)throw Error('Owned Workspace window missing');
  const later=page.getByRole('button',{name:'나중에 설정',exact:true});
  await page.addLocatorHandler(later,()=>later.click());
  await page.getByRole('navigation',{name:'주요 기능'}).getByRole('button',{name:'업무 도구',exact:true}).click();
  await page.getByRole('button',{name:'교육영상 찾기',exact:true}).click();
  await expect(page.getByRole('heading',{name:'교육영상 찾기',exact:true})).toBeVisible();
  return page;
 };
 let app=await launch();
 try{
  const page=await openFinder(app);
  await page.getByLabel('검색 방식').selectOption('mock');
  await page.getByLabel('교육 주제').fill('합성 손 씻기');
  await page.getByLabel('검색 대상').fill('합성 학습자');
  await page.getByRole('button',{name:'Mock 영상 검색',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'합성 Mock 결과 12개입니다.'})).toBeVisible();
  const first=page.locator('.ev-result').first();
  await first.getByRole('button',{name:/선택$/}).click();
  await page.getByLabel('교육 일시 또는 시청 기간').fill('합성 2026.11.23.');
  await page.getByLabel('안내사항').fill('합성 영상의 내용은 실제 교육에 사용하지 않습니다.');
  await page.getByLabel('사용자 메모').fill('합성 Finder 재실행 검증');
  await page.getByRole('button',{name:'안내문 생성',exact:true}).click();
  await expect(page.getByRole('button',{name:'라이브러리 저장',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'라이브러리 저장',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'독립 라이브러리에 저장했습니다.'})).toBeVisible();
  await expect(page.locator('.ev-library li')).toHaveCount(1);
  await app.close();app=await launch();
  const restored=await openFinder(app);
  await expect(restored.locator('.ev-library li')).toHaveCount(1);
  await expect(restored.locator('.ev-library li').first()).toContainText('합성 손 씻기');
  await restored.locator('.ev-library li').first().getByRole('button',{name:'불러오기',exact:true}).click();
  await expect(restored.getByLabel('사용자 메모')).toHaveValue('합성 Finder 재실행 검증');
  await expect(restored.getByLabel('교육 일시 또는 시청 기간',{exact:true})).toHaveValue('합성 2026.11.23.');
  await restored.screenshot({path:'artifacts/electron-p0-e2e/finder-local-persistence.png'});
 }finally{await app.close();}
});
