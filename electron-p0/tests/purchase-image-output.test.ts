import {it,expect} from 'vitest';import {mkdtemp,rm} from 'node:fs/promises';import {resolve,join} from 'node:path';import {tmpdir} from 'node:os';
import {recognizeImage} from '../main/purchase-image-ocr';import {parseImageReview,reviewRowItem} from '../renderer/purchase/imageReview';
import {validatePurchaseExport} from '../main/purchase-export-validation';import {validateSpecialOutput,EDUFINE_HEADERS} from '../main/purchase-specialized-validation';import {ExcelService} from '../main/purchase-excel';import {createPurchaseSettlement} from '../renderer/purchase/purchase/purchaseSettlement';
import {defaultPurchaseOutputColumns} from '../renderer/purchase/purchase/types';import type {ImageSelection} from '../purchase-image-protocol';
it('turns actual offline OCR into reviewed PurchaseItem and reuses real CSV/XLSX/settlement/fixed-four-column Edufine writers',async()=>{
 const root=await mkdtemp(join(tmpdir(),'image-output-contract-')),service=new ExcelService(resolve('tools/purchase-excel-cli/target/debug/purchase-excel-cli'),join(root,'cli'));
 try{
  const lines=await recognizeImage(resolve('build/purchase-ocr'),resolve('electron-p0/tests/fixtures/purchase-image/synthetic-cart.png'),new AbortController().signal);
  const selection:ImageSelection={token:'synthetic',sources:[{id:'image',order:1,name:'synthetic-cart.png',width:1800,height:750,sha256:'synthetic',thumbnail:'data:image/png;base64,',warning:null}]};
  const result=parseImageReview(selection,{token:'synthetic',results:[{sourceId:'image',status:'success',lines,message:null}]});expect(result.rows).toHaveLength(1);expect(result.charges).toHaveLength(2);
  const item=reviewRowItem({...result.rows[0],approved:true},selection)!;expect(item.name).toBe('합성 멸균 거즈');expect(item.quantity).toBe(2);expect(item.unitPrice).toBe(12000);expect(item.importedAmount).toBe(24000);
  for(const format of ['csv','xlsx'] as const){const bytes=await service.generateExport(validatePurchaseExport({format,items:[item],columns:defaultPurchaseOutputColumns}),new AbortController().signal);expect(bytes.length).toBeGreaterThan(100);if(format==='csv'){expect(bytes.toString('utf8')).toContain('합성 멸균 거즈');expect(bytes.toString('utf8')).toContain('24000');}else expect(bytes.subarray(0,4)).toEqual(Buffer.from([80,75,3,4]));}
  const edufine=validateSpecialOutput({items:[item]},'edufine'),preview=await service.previewSpecial(edufine,new AbortController().signal);expect(preview.headers).toEqual(EDUFINE_HEADERS);expect(preview.rows).toEqual([['합성 멸균 거즈','10매 포장',2,12000]]);expect(preview.rows[0]).toHaveLength(4);expect((await service.generateSpecial(edufine,new AbortController().signal)).length).toBeGreaterThan(100);
  const settlement=validateSpecialOutput({items:[item],settlement:createPurchaseSettlement([item])},'settlement');expect((await service.generateSpecial(settlement,new AbortController().signal)).subarray(0,4)).toEqual(Buffer.from([80,75,3,4]));
 }finally{await service.flush();await rm(root,{recursive:true,force:true});}
},20000);
