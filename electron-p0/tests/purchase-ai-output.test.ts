import {it,expect} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {parseImageAiResponse} from '../main/ai-image-contract';
import {aiImageReview} from '../renderer/purchase/aiImageReview';
import {reviewRowItem} from '../renderer/purchase/imageReview';
import {validatePurchaseExport} from '../main/purchase-export-validation';
import {validateSpecialOutput,EDUFINE_HEADERS} from '../main/purchase-specialized-validation';
import {ExcelService} from '../main/purchase-excel';
import {createPurchaseSettlement} from '../renderer/purchase/purchase/purchaseSettlement';
import {defaultPurchaseOutputColumns} from '../renderer/purchase/purchase/types';
it('AI review proposals reuse real CSV/XLSX, settlement and Edufine four columns; mismatch blocks output',async()=>{
 const sourceId='one',raw=JSON.stringify({sources:[{sourceId,status:'success',items:[{sourceId,name:'합성 거즈',option:'중형',specification:'10매',bundleQuantity:10,quantity:2,unitPrice:12000,amount:24000,originalPrice:15000,discount:3000,evidence:'거즈 중형 10매 수량2 적용12000 금액24000',uncertain:[]}],order:{discount:0,shipping:3000,total:27000,evidence:'배송3000 총27000'},warnings:[]}]});
 const results=parseImageAiResponse(raw,[sourceId]),{rows}=aiImageReview({provider:'openai',model:'gpt-6.1-sol',requestId:'test',transmissions:[],results});
 const selection={token:'token',sources:[{id:sourceId,order:1,name:'synthetic.png',width:256,height:128,thumbnail:'data:',sha256:'a'.repeat(64),warning:null}]};const item=reviewRowItem({...rows[0],approved:true},selection)!;
 const root=await mkdtemp(join(tmpdir(),'purchase-ai-output-')),service=new ExcelService(process.env.PURCHASE_TEST_CLI??resolve('tools/purchase-excel-cli/target/debug/purchase-excel-cli'),join(root,'owned'));
 try{
  for(const format of ['csv','xlsx'] as const){const bytes=await service.generateExport(validatePurchaseExport({format,items:[item],columns:defaultPurchaseOutputColumns}),new AbortController().signal);expect(bytes.length).toBeGreaterThan(100);if(format==='csv')expect(bytes.toString('utf8')).toContain('24000');else expect(bytes.subarray(0,4)).toEqual(Buffer.from('PK\x03\x04'));}
  const edufine=validateSpecialOutput({items:[item]},'edufine'),preview=await service.previewSpecial(edufine,new AbortController().signal);expect(preview.headers).toEqual(EDUFINE_HEADERS);expect(preview.rows).toEqual([['합성 거즈','중형 · 10매',2,12000]]);expect((await service.generateSpecial(edufine,new AbortController().signal)).length).toBeGreaterThan(100);
  expect((await service.generateSpecial(validateSpecialOutput({items:[item],settlement:createPurchaseSettlement([item])},'settlement'),new AbortController().signal)).length).toBeGreaterThan(100);
  const mismatch=reviewRowItem({...rows[0],amount:'1',approved:true},selection)!;expect(()=>validatePurchaseExport({format:'csv',items:[mismatch],columns:defaultPurchaseOutputColumns})).toThrow();expect(()=>validateSpecialOutput({items:[mismatch]},'edufine')).toThrow();
 }finally{await service.flush();await rm(root,{recursive:true,force:true});}
},20000);
