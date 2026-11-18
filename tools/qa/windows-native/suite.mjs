import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const {OfficialDocumentService}=await import(pathToFileURL(join(process.env.QA_SOURCE_PATH,'build/electron-p0-app/main/official-document-files.js')).href);
const XLSX=await import(pathToFileURL(join(process.env.QA_SOURCE_PATH,'node_modules/xlsx/xlsx.mjs')).href);
const sha=b=>createHash('sha256').update(b).digest('hex');
export const planned=['공문 가져오기 취소','공문 원본 선택·원고 보존','공문 원본 재선택 취소','공문 저장 취소','공문 실제 저장·내용·해시','공문 덮어쓰기 거부','Record 파일 선택·취소·메모 보존','Purchase CSV 선택·취소·적용','Purchase XLSX 선택·취소·기존 품목 보존','Purchase PDF 선택·취소·기존 품목 보존','Purchase 저장 취소','Purchase 실제 XLSX 저장·내용·해시','Purchase 덮어쓰기 거부'];
export async function suite(ctx,step){
 const {page,expect,root,run,native}=ctx;
 let seq=0;const n=()=>`s${String(++seq).padStart(3,'0')}`;
 const act=(action,file='',hash='',title='')=>native(action,n(),file,hash,title?['-ExpectedTitle',title]:[]);
 const noDialogs=async()=>assert.equal((await act('list')).candidates.length,0);
 const title=page.locator('.od-paper label input'),body=page.locator('.od-paper textarea').first();
 const draft=['합성 원고입니다.','끝.'].join('\n');
 const odt=join(root,'outputs','official-'+run+'.odt'),xlsx=join(root,'outputs','purchase-'+run+'.xlsx');
 let odtHash,xlsxHash,sourceText;
 const preserveDraft=async()=>{await expect(title).toHaveValue('독립 Native QA R2');await expect(body).toHaveValue(draft);};
 const reviewOdt=async()=>{await page.getByRole('button',{name:'ODT 새 파일 저장',exact:true}).click();await act('review');};
 const reviewPurchase=async()=>{await page.getByRole('button',{name:'XLSX 저장',exact:true}).click();await act('purchase-review');};
 const enterSave=async(file,hash='')=>{await act('input',file,hash);await act('accept',file,hash);};
 const purchasePreserved=async()=>{await expect(page.getByRole('textbox',{name:'1행 품명',exact:true})).toHaveValue('합성 Native 품목');await expect(page.getByRole('textbox',{name:'1행 수량',exact:true})).toHaveValue('2');await expect(page.getByRole('textbox',{name:'1행 단가',exact:true})).toHaveValue('12000');};
 await ctx.openTool('공문작업실');await page.getByRole('button',{name:'빈 문서 작성',exact:true}).click();await title.fill('독립 Native QA R2');await body.fill(draft);
 await step(planned[0],async()=>{await page.getByRole('button',{name:'PDF/HWPX/ODT 가져오기',exact:true}).click();await act('cancel','','','합성 공문 가져오기');await expect(page.locator('.od-status')).toContainText('취소');await preserveDraft();await noDialogs();return {draftPreserved:true};});
 await step(planned[1],async()=>{await page.getByRole('button',{name:'PDF/HWPX/ODT 가져오기',exact:true}).click();await act('open',join(root,'fixtures/1-official.odt'),'','합성 공문 가져오기');const source=page.getByRole('textbox',{name:'받은 공문 원문',exact:true});await expect(source).toHaveValue(new RegExp('합성 파일창 경계 QA'));sourceText=await source.inputValue();await page.getByRole('button',{name:'신규 공문 작성',exact:true}).click();await preserveDraft();return {sourceImported:true,draftPreserved:true};});
 await step(planned[2],async()=>{const opening=page.getByRole('button',{name:'PDF/HWPX/ODT 가져오기',exact:true}).click();await act('source-confirm','','','BOGUNON DESK');await opening;await act('cancel','','','합성 공문 가져오기');await preserveDraft();await page.getByRole('button',{name:'공문 핵심정리',exact:true}).click();await expect(page.getByRole('textbox',{name:'받은 공문 원문',exact:true})).toHaveValue(sourceText);await page.getByRole('button',{name:'신규 공문 작성',exact:true}).click();await noDialogs();return {sourcePreserved:true,draftPreserved:true};});
 await step(planned[3],async()=>{await reviewOdt();await act('cancel','','','검토한 공문을 새 ODT로 저장');await preserveDraft();await noDialogs();return {draftPreserved:true};});
 await step(planned[4],async()=>{await reviewOdt();await enterSave(odt);await expect(page.locator('[data-od-save-state]')).toContainText('파일 저장 완료',{timeout:30000});const bytes=await readFile(odt);const cli=process.env.QA_OFFICIAL_CLI_PATH;const service=new OfficialDocumentService(cli,join(root,'temp/verify-odt'));try{const doc=await service.import(odt,new AbortController().signal);assert(doc.text.replace(/\s/g,'').includes('독립NativeQAR2'));assert(doc.text.includes('합성 원고입니다.'));}finally{await service.flush();}odtHash=sha(bytes);await noDialogs();return {path:odt,bytes:bytes.length,sha256:odtHash,contentVerified:true};});
 await step(planned[5],async()=>{await reviewOdt();await enterSave(odt,odtHash);await act('deny');await act('cancel','','','검토한 공문을 새 ODT로 저장');assert.equal(sha(await readFile(odt)),odtHash);await preserveDraft();await noDialogs();return {hashUnchanged:odtHash,draftPreserved:true};});
 const closing=page.getByRole('button',{name:'보건 업무로',exact:true}).click();await act('source-confirm','','','BOGUNON DESK');await closing;await noDialogs();
 await step(planned[6],async()=>{await ctx.openTool('생활기록부 도우미');const pick=page.getByRole('button',{name:'활동보고서 파일 추가',exact:true});await pick.click();const candidates=await act('list');await act('open',join(root,'fixtures/2-record.pdf'),'','활동보고서 선택 · 세션 메모리 전용');const fields=page.locator('.record-helper-panel textarea');await expect(fields.nth(0)).toHaveValue('Synthetic student activity report text',{timeout:30000});await fields.nth(1).fill('합성 교사 메모 — 취소 후 유지');await pick.click();await act('cancel','','','활동보고서 선택 · 세션 메모리 전용');await expect(fields.nth(0)).toHaveValue('Synthetic student activity report text');await expect(fields.nth(1)).toHaveValue('합성 교사 메모 — 취소 후 유지');await noDialogs();return {candidates,sourcePreserved:true,memoPreserved:true};});
 await page.getByRole('button',{name:'생기부 도우미 닫기',exact:true}).click();await page.getByRole('dialog',{name:'생기부 도우미 닫기',exact:true}).getByRole('button',{name:'닫고 비우기',exact:true}).click();await ctx.openTool('품의 도우미');
 await step(planned[7],async()=>{await page.getByRole('combobox',{name:'가져오기 형식',exact:true}).selectOption('csv');const b=page.getByRole('button',{name:'CSV 가져오기',exact:true});await b.click();await act('cancel');await expect(b).toBeEnabled();await b.click();await act('open',join(root,'fixtures/3-purchase.csv'));await page.getByRole('button',{name:'CSV 품목 적용',exact:true}).click();await purchasePreserved();await expect(page.getByRole('dialog')).toContainText('1개 선택 · 24,000원');return {rows:1,quantity:2,unitPrice:12000,total:24000};});
 for(const [i,format,label,file,count] of [[8,'excel','Excel','4-purchase.xlsx',2],[9,'pdf','PDF','5-purchase.pdf',1]]){
  await step(planned[i],async()=>{await page.getByRole('combobox',{name:'가져오기 형식',exact:true}).selectOption(format);const b=page.getByRole('button',{name:`${label} 가져오기`,exact:true});await b.click();await act('cancel');await purchasePreserved();await b.click();await act('open',join(root,'fixtures',file));const group=page.getByRole('group',{name:`${label} 적용 확인`,exact:true});await expect(group).toContainText(`${count}개 ${label} 품목`,{timeout:30000});await page.getByRole('button',{name:`${label} 분석 취소`,exact:true}).click();await purchasePreserved();await noDialogs();return {previewItems:count,existingItemsPreserved:true};});
 }
 await step(planned[10],async()=>{await reviewPurchase();await act('cancel','','','구매 품목 출력 저장');await purchasePreserved();await noDialogs();return {itemsPreserved:true};});
 await step(planned[11],async()=>{await reviewPurchase();await enterSave(xlsx);await expect.poll(async()=>{try{return (await stat(xlsx)).size;}catch{return 0;}},{timeout:30000}).toBeGreaterThan(100);const bytes=await readFile(xlsx),book=XLSX.read(bytes,{type:'buffer'}),rows=book.SheetNames.flatMap(n=>XLSX.utils.sheet_to_json(book.Sheets[n],{header:1}));assert(rows.flat().includes('합성 Native 품목'));assert(rows.flat().includes(24000));xlsxHash=sha(bytes);await noDialogs();return {path:xlsx,bytes:bytes.length,sha256:xlsxHash,rows};});
 await step(planned[12],async()=>{await reviewPurchase();await enterSave(xlsx,xlsxHash);await act('deny');await act('cancel','','','구매 품목 출력 저장');assert.equal(sha(await readFile(xlsx)),xlsxHash);await purchasePreserved();await noDialogs();return {hashUnchanged:xlsxHash,itemsPreserved:true};});
 return {odt:{path:odt,sha256:odtHash},xlsx:{path:xlsx,sha256:xlsxHash}};
}
