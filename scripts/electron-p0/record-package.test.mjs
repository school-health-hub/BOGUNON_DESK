import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdtemp,cp,appendFile,rm,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {verifyRecordPackage,recordSources} from './record-package.mjs';
test('the built Record helper is bound to the exact reused Rust engine and native binary',async()=>{
 const manifest=await verifyRecordPackage('build/record-helper-cli');assert.deepEqual(manifest.sources,await recordSources());assert(manifest.sources['src-tauri/src/record_helper_import/pdf.rs']);assert(manifest.sources['src-tauri/src/record_helper_import/hwp.rs']);assert(manifest.sources['tools/official-document-cli/src/limits.rs']);
});
test('mismatched native bytes or source provenance blocks Record packaging',async()=>{
 const root=await mkdtemp(join(tmpdir(),'record-package-'));
 try{await cp('build/record-helper-cli',root,{recursive:true});const name=process.platform==='win32'?'record-helper-cli.exe':'record-helper-cli';await appendFile(join(root,name),'synthetic corruption');await assert.rejects(()=>verifyRecordPackage(root));await cp('build/record-helper-cli',root,{recursive:true});const m=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));m.sources={};await writeFile(join(root,'manifest.json'),JSON.stringify(m));await assert.rejects(()=>verifyRecordPackage(root));}finally{await rm(root,{recursive:true,force:true});}
});
test('builder retains four existing native CLIs and adds the separate Record resource with a mandatory prepack check',async()=>{
 const builder=JSON.parse(await readFile('electron-p0/builder.json','utf8')),resources=[...builder.extraResources,...builder.win.extraResources];
 for(const name of ['record-helper-cli','purchase-excel-cli','official-document-cli','chatgpt-auth-cli','my-finance-cli'])assert(resources.some(r=>r.to===name));const record=resources.find(r=>r.to==='record-helper-cli');assert.deepEqual(record.filter,['record-helper-cli.exe','record-helper-cli','manifest.json']);
 assert((await readFile('scripts/electron-p0/check-excel-package.cjs','utf8')).includes('verifyRecordPackage'));const pkg=JSON.parse(await readFile('package.json','utf8'));assert(pkg.scripts['electron:p0:package:win'].startsWith('node scripts/electron-p0/build-record.mjs --release'));
});
