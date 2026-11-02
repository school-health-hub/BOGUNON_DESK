import {observeStartup} from './startup-diagnostics';
import {test,expect,_electron as electron} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';
import {createHash} from 'node:crypto';
import {randomUUID} from 'node:crypto';import {join} from 'node:path';import {mkdir,readFile} from 'node:fs/promises';
import {createNewsletterProject} from '../../src/newsletter/project';
import {createNewsletterDesignState} from '../../src/newsletter/rendering/designSchema';
import {upgradeNewsletterDesignStateV2} from '../../src/newsletter/rendering/designState';
test('newsletter: original editor/scene, image reconnect, dialog-scoped JSON save and reopen',async()=>{
 test.setTimeout(120000);
 const now='2026-10-30T00:00:00.000Z';
 const project=await createNewsletterProject({projectId:'synthetic-electron-newsletter',title:'합성 소식지',now});
 const design=upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now}),now);
 const profileId=randomUUID();
 const launch=()=>electron.launch({chromiumSandbox:true,...(process.env.ELECTRON_P0_EXECUTABLE?{executablePath:process.env.ELECTRON_P0_EXECUTABLE}:{}),args:process.env.ELECTRON_P0_EXECUTABLE?[]:[join(process.cwd(),'build/electron-p0-app')],env:{...process.env,ELECTRON_P0_TEST_RUN:profileId,ELECTRON_P0_DEV_URL:''}});
 let app=await launch();
 try{
  let page=await app.firstWindow();const diagnose=observeStartup(page);await page.getByRole('button',{name:'설정',exact:true}).click().catch(async e=>{console.log('P2D2_DIAGNOSTIC '+JSON.stringify(await diagnose(app)));throw e;});await page.getByRole('button',{name:'보건소식지 제작소',exact:true}).click();
  await page.getByLabel('원고·디자인 JSON 열기',{exact:true}).setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({project,design}))});
  await expect(page.getByRole('img',{name:'A4 보건소식지 미리보기',exact:true})).toBeVisible();
  await page.getByLabel('원고 제목',{exact:true}).fill('합성 편집 제목');await page.getByRole('button',{name:'원고 반영',exact:true}).click();
  await page.getByRole('button',{name:'승인 수달쌤 적용',exact:true}).click();
  await expect(page.getByText('디자인·렌더 승인 · 실제 출력 승인 대기',{exact:true})).toBeVisible();
  await page.getByLabel('이미지 원본 연결',{exact:true}).setInputFiles('src/newsletter/rendering/assets/otter-primary-v1.png');
  await expect(page.getByText('1개 이미지의 SHA-256을 확인했습니다. 승인 상태는 변경하지 않았습니다.',{exact:true})).toBeVisible();
  await expect(page.getByRole('img',{name:'A4 보건소식지 미리보기',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'출력 위치 선택·저장',exact:true})).toBeDisabled();
  const info=await page.evaluate(()=>window.electronP0.info());await mkdir(info.userData,{recursive:true});const path=join(info.userData,'synthetic-newsletter.json');
  // Native dialog selection is simulated only by Playwright's privileged main-process connection.
  await app.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});dialog.showMessageBox=async()=>({response:0,checkboxChecked:false});},path);
  await page.getByRole('button',{name:'원고·디자인 JSON 저장',exact:true}).click();await expect(page.getByText('원고·디자인 JSON을 저장했습니다.',{exact:true})).toBeVisible();
  const saved=await readFile(path,'utf8'),doc=JSON.parse(saved);expect(doc.project.topics[0].title).toBe('합성 편집 제목');expect(doc.design.assetManifest[0].exportApproval).toBe('pending');expect(Object.keys(doc).sort()).toEqual(['design','project']);
  expect(saved).not.toContain('data:image');expect(saved).not.toContain('bytesBase64');
  await page.getByLabel('원고 제목',{exact:true}).fill('합성 취소할 변경');await page.getByRole('button',{name:'원고 반영',exact:true}).click();
  await page.getByRole('button',{name:'원고·디자인 JSON 저장',exact:true}).click();await expect(page.getByText('JSON 저장을 취소했습니다.',{exact:true})).toBeVisible();expect(await readFile(path,'utf8')).toBe(saved);
  await page.getByLabel('원고·디자인 JSON 열기',{exact:true}).setInputFiles(path);await expect(page.getByLabel('원고 제목',{exact:true})).toHaveValue('합성 편집 제목');
  await page.getByLabel('이미지 원본 연결',{exact:true}).setInputFiles('src/newsletter/rendering/assets/otter-primary-v1.png');
  await page.getByRole('button',{name:'카드뉴스 7장',exact:true}).click();await expect(page.getByRole('img',{name:'card-cover 미리보기',exact:true})).toBeVisible();
  await page.screenshot({path:'artifacts/electron-p0-e2e/newsletter-editor.png',fullPage:true});
  await page.getByRole('button',{name:'보건 업무로',exact:true}).click();await expect(page.getByRole('navigation',{name:'주요 기능'})).toBeVisible();
  await page.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('button',{name:'보건소식지 제작소',exact:true}).click();
  await expect(page.getByRole('img',{name:'card-cover 미리보기',exact:true})).toBeVisible();
  const otter=await readFile('src/newsletter/rendering/assets/otter-primary-v1.png');
  const denied=await page.evaluate(({document,bytesBase64,reference})=>window.electronWork.newsletter.exportOutput({document,selection:'a4-pdf',assets:[{reference,bytesBase64}]}),{document:saved.replaceAll('"exportApproval": "pending"','"exportApproval": "approved"'),bytesBase64:otter.toString('base64'),reference:`asset:${createHash('sha256').update(otter).digest('hex')}`});
  expect(denied).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
  await page.locator('.newsletter-native-project > summary').click();
  await page.getByRole('button',{name:'프로젝트 내부 저장',exact:true}).click();await expect(page.locator('[data-project-status]')).toHaveText('프로젝트 저장됨 · revision 1');
  const firstStored=await page.evaluate(projectId=>window.electronWork.newsletter.projects.load({projectId}),project.projectId);if(!firstStored.ok)throw Error('Missing stored project');
  await page.getByLabel('원고 제목',{exact:true}).fill('합성 내부 수정');await page.getByRole('button',{name:'원고 반영',exact:true}).click();
  await page.getByRole('button',{name:'프로젝트 내부 저장',exact:true}).click();await expect(page.locator('[data-project-status]')).toHaveText('프로젝트 저장됨 · revision 2');
  expect(await page.evaluate(first=>window.electronWork.newsletter.projects.save({document:first.document,expected:first.head}),firstStored.data)).toMatchObject({ok:false,error:{code:'CONFLICT'}});
  await page.getByRole('button',{name:'revision 이력 조회',exact:true}).click();await page.getByRole('button',{name:'revision 1 미리보기',exact:true}).click();
  await expect(page.locator('.newsletter-studio input[aria-label="원고 제목"]')).toHaveValue('합성 편집 제목');
  await page.getByRole('button',{name:'미리 본 revision 복구',exact:true}).click();await expect(page.locator('[data-project-status]')).toHaveText('복구를 취소했습니다.');
  await expect(page.getByLabel('원고 제목',{exact:true})).toHaveValue('합성 내부 수정');
  await page.getByRole('button',{name:'revision 1 미리보기',exact:true}).click();await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});});
  await page.getByRole('button',{name:'미리 본 revision 복구',exact:true}).click();await expect(page.locator('[data-project-status]')).toContainText('프로젝트 복구됨 · revision 3');
  const restored=await page.evaluate(projectId=>window.electronWork.newsletter.projects.load({projectId}),project.projectId);if(!restored.ok)throw Error('Missing restored project');expect(JSON.parse(restored.data.document).design.assetManifest[0].exportApproval).toBe('pending');
  const projectFile=await readFile(join(info.userData,'work-data','newsletter-projects',project.projectId+'.json'),'utf8');expect(JSON.parse(projectFile).rows).toHaveLength(3);expect(projectFile).not.toContain('data:image');
  await app.close();app=await launch();page=await app.firstWindow();await page.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('button',{name:'보건소식지 제작소',exact:true}).click();
  await page.locator('.newsletter-native-project > summary').click();await page.getByLabel('저장된 프로젝트',{exact:true}).selectOption(project.projectId);await page.getByRole('button',{name:'프로젝트 불러오기',exact:true}).click();
  await expect(page.locator('[data-project-status]')).toContainText('프로젝트 불러옴 · revision 3');await expect(page.getByLabel('원고 제목',{exact:true})).toHaveValue('합성 편집 제목');

  // A fresh, explicitly approved synthetic asset; no production images or financial data.
  const pngBase64=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2;c.height=2;const g=c.getContext('2d')!;g.fillStyle='#286c60';g.fillRect(0,0,2,2);return c.toDataURL('image/png').split(',')[1];});
  const png=Buffer.from(pngBase64,'base64'),sha=createHash('sha256').update(png).digest('hex');
  const asset={id:'synthetic-approved',sha256:sha,mediaType:'image/png' as const,approvalStatus:'approved' as const,exportApproval:'approved' as const,originalName:'synthetic-approved.png',localReference:`asset:${sha}`,registry:{classification:'USER_CREATED' as const,purpose:'illustration' as const,usageScope:'newsletter-output' as const}};
  const cards=design.cardLayouts.map((c,i)=>i===0?{...c,image:{...c.image,assetId:asset.id}}:c);
  const approvedProject={...project,projectId:'synthetic-approved-project' as typeof project.projectId};
  const approved={...design,projectId:approvedProject.projectId,assetManifest:[asset],cardLayouts:cards,revisionHistory:design.revisionHistory.map(e=>e.revision===design.designRevision?{...e,snapshot:{...e.snapshot,assetManifest:[asset],cardLayouts:cards}}:e)};
  await page.getByLabel('원고·디자인 JSON 열기',{exact:true}).setInputFiles({name:'synthetic-approved.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({project:approvedProject,design:approved}))});
  await expect(page.locator('.revision-chip')).toHaveText('Revision 2');
  const changedPngBase64=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2;c.height=2;const g=c.getContext('2d')!;g.fillStyle='#a33d35';g.fillRect(0,0,2,2);return c.toDataURL('image/png').split(',')[1];});
  const changedPng=Buffer.from(changedPngBase64,'base64');expect(createHash('sha256').update(changedPng).digest('hex')).not.toBe(sha);
  await page.getByLabel('이미지 원본 연결',{exact:true}).setInputFiles({name:'synthetic-changed.png',mimeType:'image/png',buffer:changedPng});
  await expect(page.getByText('원장에 없는 이미지입니다: synthetic-changed.png',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'출력 위치 선택·저장',exact:true})).toBeDisabled();
  await page.getByLabel('이미지 원본 연결',{exact:true}).setInputFiles({name:'synthetic-approved.png',mimeType:'image/png',buffer:png});
  const exportButton=page.getByRole('button',{name:'출력 위치 선택·저장',exact:true});await expect(exportButton).toBeEnabled().catch(async e=>{console.log('P2D2_DIAGNOSTIC '+(await page.locator('.newsletter-product-host').innerText()).slice(0,5000));throw e;});
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});});
  for(const selection of ['a4-png','a4-pdf','cards-pdf','card-pngs'] as const){
   const destination=join(info.userData,selection==='card-pngs'?'cards-parent':selection==='a4-png'?'synthetic-export.png':`${selection}.pdf`);if(selection==='card-pngs')await mkdir(destination);
   await app.evaluate(({dialog},destination)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:destination});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[destination]});},destination);
   await page.getByLabel('출력 형식',{exact:true}).selectOption(selection);await exportButton.click();await expect(page.locator('[data-export-status]')).toHaveText(/^출력물을 저장했습니다\./,{timeout:60000});
   if(selection==='a4-png'){const bytes=await readFile(destination);expect(bytes.readUInt32BE(16)).toBe(2480);expect(bytes.readUInt32BE(20)).toBe(3508);expect(await page.evaluate(async base64=>{const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();return [img.naturalWidth,img.naturalHeight];},bytes.toString('base64'))).toEqual([2480,3508]);}
   else if(selection!=='card-pngs'){const parsed=await PDFDocument.load(await readFile(destination));expect(parsed.getPageCount()).toBe(selection==='cards-pdf'?7:1);}
   else{const {readdir}=await import('node:fs/promises');const folders=await readdir(destination);expect(folders).toHaveLength(1);const files=await readdir(join(destination,folders[0]));expect(files).toHaveLength(7);for(const name of files){const bytes=await readFile(join(destination,folders[0],name));expect(bytes.readUInt32BE(16)).toBe(1800);expect(bytes.readUInt32BE(20)).toBe(1800);}}
  }
  await page.screenshot({path:'artifacts/electron-p0-e2e/newsletter-export.png',fullPage:true});
  await page.getByRole('button',{name:'프로젝트 내부 저장',exact:true}).click();await expect(page.locator('[data-project-status]')).toHaveText('프로젝트 저장됨 · revision 1');
  await page.getByRole('button',{name:'프로젝트 불러오기',exact:true}).click();await expect(page.locator('[data-project-status]')).toContainText('이미지 원본을 다시 연결');
  await expect(page.locator('.preview-panel').getByRole('alert')).toContainText('이미지 원본을 다시 선택');
  await page.getByLabel('이미지 원본 연결',{exact:true}).setInputFiles({name:'synthetic-approved.png',mimeType:'image/png',buffer:png});await expect(exportButton).toBeEnabled();
  await page.screenshot({path:'artifacts/electron-p0-e2e/newsletter-project.png',fullPage:true});

 }finally{await app.close();}
});
