import {test,expect,_electron as electron} from '@playwright/test';
import {randomUUID} from 'node:crypto';import {join} from 'node:path';import {mkdir,readFile} from 'node:fs/promises';
import {createNewsletterProject} from '../../src/newsletter/project';
import {createNewsletterDesignState} from '../../src/newsletter/rendering/designSchema';
import {upgradeNewsletterDesignStateV2} from '../../src/newsletter/rendering/designState';
test('newsletter: original editor/scene, image reconnect, dialog-scoped JSON save and reopen',async()=>{
 const now='2026-10-30T00:00:00.000Z';
 const project=await createNewsletterProject({projectId:'synthetic-electron-newsletter',title:'합성 소식지',now});
 const design=upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now}),now);
 const app=await electron.launch({chromiumSandbox:true,...(process.env.ELECTRON_P0_EXECUTABLE?{executablePath:process.env.ELECTRON_P0_EXECUTABLE}:{}),args:process.env.ELECTRON_P0_EXECUTABLE?[]:[join(process.cwd(),'build/electron-p0-app')],env:{...process.env,ELECTRON_P0_TEST_RUN:randomUUID(),ELECTRON_P0_DEV_URL:''}});
 try{
  const page=await app.firstWindow();await page.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('button',{name:'보건소식지 제작소',exact:true}).click();
  await page.getByLabel('원고·디자인 JSON 열기',{exact:true}).setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({project,design}))});
  await expect(page.getByRole('img',{name:'A4 보건소식지 미리보기',exact:true})).toBeVisible();
  await page.getByLabel('원고 제목',{exact:true}).fill('합성 편집 제목');await page.getByRole('button',{name:'원고 반영',exact:true}).click();
  await page.getByRole('button',{name:'승인 수달쌤 적용',exact:true}).click();
  await expect(page.getByText('디자인·렌더 승인 · 실제 출력 승인 대기',{exact:true})).toBeVisible();
  await page.getByLabel('이미지 원본 연결',{exact:true}).setInputFiles('src/newsletter/rendering/assets/otter-primary-v1.png');
  await expect(page.getByText('1개 이미지의 SHA-256을 확인했습니다. 승인 상태는 변경하지 않았습니다.',{exact:true})).toBeVisible();
  await expect(page.getByRole('img',{name:'A4 보건소식지 미리보기',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'출력 폴더 선택·저장',exact:true})).toHaveCount(0);
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
 }finally{await app.close();}
});
