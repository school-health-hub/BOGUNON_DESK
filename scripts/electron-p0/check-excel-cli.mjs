import {spawnSync} from 'node:child_process';import {resolve,join} from 'node:path';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const exe=resolve(process.argv[2]??'tools/purchase-excel-cli/target/debug/purchase-excel-cli');
const fixtures=resolve('tools/purchase-excel-cli/target/qa-fixtures');
const call=request=>{const r=spawnSync(exe,[],{input:JSON.stringify({version:1,request}),encoding:'utf8',shell:false,windowsHide:true,timeout:30000,maxBuffer:64*1024*1024});assert.equal(r.status,0,`CLI exit=${r.status} error=${r.error?.code??'none'} (78 means resource limits unavailable)`);const v=JSON.parse(r.stdout);assert.equal(v.version,1);assert.equal(v.ok,true);return v.data;};
const xlsx=call({operation:'analyze',path:join(fixtures,'synthetic.xlsx')});assert.deepEqual(xlsx,JSON.parse(readFileSync(join(fixtures,'expected-xlsx.json'),'utf8')));
assert.equal(call({operation:'analyze',path:join(fixtures,'synthetic.xls')}).items[0].name,'합성 XLS');
const unknown=call({operation:'analyze',path:join(fixtures,'unknown.xlsx')});assert.equal(unknown.candidates.length,1);
const mapped=call({operation:'map',candidate:unknown.candidates[0],headerRow:0,mapping:{name:0,quantity:1,unitPrice:2}});assert.equal(mapped.items[0].quantity,3);assert.equal(mapped.items[0].unitPrice,25);
const invalid=spawnSync(exe,[],{input:'{"version":99,"request":{}}',encoding:'utf8',timeout:30000,shell:false});assert.notEqual(invalid.status,0);
console.log('Excel CLI smoke PASS: XLSX/XLS, automatic sheet selection, original result fixture, mapping and invalid request; each child exited');
const pdf=call({operation:'analyze',path:join(fixtures,'synthetic.pdf')});assert.deepEqual(pdf,JSON.parse(readFileSync(join(fixtures,'expected-pdf.json'),'utf8')));
assert.equal(call({operation:'analyze',path:join(fixtures,'korean.pdf')}).items[0].name,'합성 품목');
const pdfCandidate=call({operation:'analyze',path:join(fixtures,'unknown.pdf')}).candidates[0];
assert.equal(call({operation:'map',candidate:pdfCandidate,headerRow:0,mapping:{name:0,quantity:1,unitPrice:2}}).items[0].quantity,3);
for(const [name,phrase] of [['scanned.pdf','OCR'],['encrypted.pdf','암호화'],['oversized-pages.pdf','50페이지'],['damaged.pdf','읽지 못했습니다']]){
 const r=call({operation:'analyze',path:join(fixtures,name)});assert.equal(r.items.length,0);assert(r.sources[0].message.includes(phrase));assert(['unsupported','error'].includes(r.sources[0].status));
}
console.log('PDF CLI smoke PASS: text/Korean/total/mapping and scanned/encrypted/damaged/page-limit rejection; no OCR or external executable');
const exportInput=JSON.parse(readFileSync(join(fixtures,'export-request.json'),'utf8'));
for(const format of ['csv','xlsx']){
 const r=call({operation:'export',format,...exportInput});assert.equal(r.validated,true);assert.equal(r.format,format);assert.deepEqual(r.columns,exportInput.columns);const bytes=Buffer.from(r.bytesBase64,'base64');assert(bytes.length>20);assert(bytes.subarray(0,format==='csv'?3:4).equals(Buffer.from(format==='csv'?[239,187,191]:[80,75,3,4])));
}
console.log('Purchase export CLI smoke PASS: original CSV/XLSX generation and read-back validation, no output path supplied to CLI');

const rows=[{number:1,name:'=합성 품목',plannedQuantity:2,actualQuantity:2,plannedUnitPrice:1000,actualUnitPrice:900,plannedAmount:2000,actualAmount:1800,difference:-200,status:'구매완료',note:'합성'}];
const summary={plannedTotal:2000,actualSubtotal:1800,shippingFee:300,discountAmount:100,finalActual:2000,difference:0};
for(const operation of ['edufine','settlement']){
 const request=operation==='edufine'?{operation,items:exportInput.items}:{operation,rows,summary};
 const table=call({...request,preview:true});assert.equal(table.headers.length,operation==='edufine'?4:11);assert.equal(table.rows.length,1);
 if(operation==='edufine')assert.deepEqual(table.headers,['내용','규격','수량','예상단가']);else assert.deepEqual(table.summaryRows[4],['최종결제금액',2000]);
 const workbook=call({...request,preview:false});assert.equal(workbook.validated,true);assert.deepEqual(workbook.columns,table.headers);assert(Buffer.from(workbook.bytesBase64,'base64').subarray(0,4).equals(Buffer.from([80,75,3,4])));
}
console.log('Settlement/Edufine CLI smoke PASS: original 11/4 columns, summaries, workbook read-back and fixed executable exit');

const winQa=call({operation:'analyze',path:join(fixtures,'win-qa04.pdf')});assert.equal(winQa.items.length,4);assert.equal(winQa.items.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0),23500);assert(winQa.items.every(item=>!item.name.includes('예상 합계')));console.log('WIN-QA-04 CLI regression PASS: labeled 23,500 won total excluded');
