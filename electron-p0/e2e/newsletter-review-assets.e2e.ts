import {test,expect,_electron as electron} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createNewsletterProject} from '../../src/newsletter/project';
import {createNewsletterDesignState} from '../../src/newsletter/rendering/designSchema';
import {upgradeNewsletterDesignStateV2} from '../../src/newsletter/rendering/designState';
import {inspectUserImage,registerImportedChatGptImage} from '../../src/newsletter/userImageImport';

test('reference-only reconnect is review-only and JSON preserves approval state',async()=>{
 test.setTimeout(90000);
 const executablePath=process.env.ELECTRON_P0_EXECUTABLE;
 if(!executablePath)throw Error('Set ELECTRON_P0_EXECUTABLE to the installed runtime');
 if(process.env.ELECTRON_P0_QA_PROFILE!=='1'||!process.env.ELECTRON_P0_QA_ROOT)throw Error('An isolated Electron QA profile root is required');
 const out=resolve('.omo/evidence/review-reconnect'),now='2026-11-16T04:00:00.000Z';await mkdir(out,{recursive:true});
 const imagePath=resolve('src/newsletter/rendering/assets/students/01-winter-gut.png'),buffer=await readFile(imagePath),bytes=new Uint8Array(buffer);
 const imported=await inspectUserImage({name:'synthetic-review.png',type:'image/png',size:bytes.length,arrayBuffer:async()=>bytes.buffer},async()=>({width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)}));
 const project=await createNewsletterProject({projectId:'synthetic-review-reconnect',title:'합성 자산 검토 문서',now});
 const registered=registerImportedChatGptImage(upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now}),now),imported,now);
 const cards=registered.cardLayouts.map((card,index)=>index===1?{...card,image:{...card.image,assetId:imported.assetId}}:card);
 const design={...registered,cardLayouts:cards,revisionHistory:registered.revisionHistory.map(entry=>entry.revision===registered.designRevision?{...entry,snapshot:{...entry.snapshot,cardLayouts:cards}}:entry)};
 const original={project,design},input=join(out,'synthetic-review.json'),saved=join(out,`saved-review-${randomUUID()}.json`);await writeFile(input,JSON.stringify(original));
 const profileId=randomUUID();
 const app=await electron.launch({executablePath,args:[resolve('build/electron-p0-app')],env:{...process.env,ELECTRON_P0_TEST_RUN:profileId,ELECTRON_P0_DEV_URL:''}});
 try{
 const page=await app.firstWindow();
 await page.getByRole('button',{name:'나중에 설정',exact:true}).click();await page.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('button',{name:'앱 정보',exact:true}).click();await page.getByRole('button',{name:'보건소식지 제작소',exact:true}).click();
 await page.getByLabel('원고·디자인 JSON 열기',{exact:true}).setInputFiles(input);
 await page.getByLabel('이미지 원본 연결',{exact:true}).setInputFiles(imagePath);
 await expect(page.getByText('검토용 미승인 이미지 1개 연결됨 · 출판 승인 대기',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'출력 위치 선택·저장',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'카드뉴스 7장',exact:true}).click();await expect(page.getByRole('img',{name:'card-cover 미리보기',exact:true})).toBeVisible();
 await page.getByLabel('카드 선택',{exact:true}).getByRole('button',{name:'1',exact:true}).click();
 await expect(page.getByRole('img',{name:'card-topic-1 미리보기',exact:true})).toBeVisible();
 await page.screenshot({path:join(out,'review-only-connected.png'),fullPage:true});
 await page.getByLabel('이미지 원본 연결',{exact:true}).setInputFiles(resolve('src/newsletter/rendering/assets/otter-primary-v1.png'));
 await expect(page.getByText('원장에 없는 이미지입니다: otter-primary-v1.png',{exact:true})).toBeVisible();
 await expect(page.getByText('검토용 미승인 이미지 1개 연결됨 · 출판 승인 대기',{exact:true})).toBeVisible();
 await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},saved);
 await page.getByRole('button',{name:'원고·디자인 JSON 저장',exact:true}).click();await expect(page.getByText('원고·디자인 JSON을 저장했습니다.',{exact:true})).toBeVisible();expect(JSON.parse(await readFile(saved,'utf8'))).toEqual(original);
 await page.getByLabel('원고·디자인 JSON 열기',{exact:true}).setInputFiles(saved);await expect(page.getByText('검토용 미승인 이미지 1개 연결됨 · 출판 승인 대기',{exact:true})).toHaveCount(0);
 await page.getByLabel('이미지 원본 연결',{exact:true}).setInputFiles(imagePath);await expect(page.getByText('검토용 미승인 이미지 1개 연결됨 · 출판 승인 대기',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'출력 위치 선택·저장',exact:true})).toBeDisabled();
 }finally{await app.close();}
});
