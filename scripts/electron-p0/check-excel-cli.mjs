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
