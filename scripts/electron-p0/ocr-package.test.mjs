import {createHash} from 'node:crypto';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,cp,rm,stat,writeFile} from 'node:fs/promises';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync} from 'node:child_process';
import {getFileMatchers,copyFiles,excludedNames,excludedExts} from 'app-builder-lib/out/fileMatcher.js';
import {verifyOcrRuntime,recognizeImage} from '../../build/electron-p0-app/main/purchase-image-ocr.js';
const root=resolve('build/purchase-ocr'),manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
test('actual electron-builder extraResources selection includes every offline runtime dependency, WASM and both traineddata files',async()=>{
 await verifyOcrRuntime(root);const config=JSON.parse(await readFile('electron-p0/builder.json','utf8'));
 const matchers=getFileMatchers(config,'extraResources',resolve('/tmp/ocr-resources'),{defaultSrc:process.cwd(),macroExpander:v=>v,customBuildOptions:config.win,globalOutDir:resolve('release-electron-p0')});
 const matcher=matchers.find(m=>m.from===root);assert(matcher,'Missing OCR resources mapping');const filter=matcher.createFilter();
 for(const entry of manifest.files){const file=join(root,entry.file);assert(filter(file,await stat(file)),`Builder omitted ${entry.file}`);}
 const metadataNames=new Set(excludedNames.split(','));const metadataExts=[...excludedExts.split(','),'pdb'];
 assert(!manifest.files.some(f=>f.file.split('/').some(p=>metadataNames.has(p)||p.startsWith('._')||metadataExts.some(ext=>p.endsWith('.'+ext)))));
 assert(manifest.files.some(f=>f.file.endsWith('kor.traineddata.gz')));assert(manifest.files.some(f=>f.file.endsWith('eng.traineddata.gz')));assert(manifest.bytes<20*1024*1024);
});
test('actual builder directory copy preserves every manifested OCR dependency',async()=>{
 const dest=await mkdtemp(join(tmpdir(),'ocr-package-copy-'));
 try{const config=JSON.parse(await readFile('electron-p0/builder.json','utf8'));
 const matchers=getFileMatchers(config,'extraResources',dest,{defaultSrc:process.cwd(),macroExpander:v=>v,customBuildOptions:config.win,globalOutDir:resolve('release-electron-p0')});
 await copyFiles(matchers.filter(m=>m.from===root||m.from===join(root,'node_modules')),null,false);
 await verifyOcrRuntime(join(dest,'purchase-ocr'));
 for(const entry of manifest.files)assert.equal(createHash('sha256').update(await readFile(join(dest,'purchase-ocr',entry.file))).digest('hex'),entry.sha256);
 }finally{await rm(dest,{recursive:true,force:true});}
});
test('real staged offline Korean/English OCR reads synthetic cart prices/options and bounding-box evidence',async()=>{
 const lines=await recognizeImage(root,resolve('electron-p0/tests/fixtures/purchase-image/synthetic-cart.png'),new AbortController().signal);const text=lines.map(l=>l.text).join('\n');
 for(const word of ['상품명','합성 멸균 거즈','10매','수량: 2','12,000','24,000','배송비','27,000'])assert(text.includes(word),`OCR failed synthetic text: ${word}`);
 assert(lines.every(l=>l.box.length===4));
 const english=await recognizeImage(root,resolve('electron-p0/tests/fixtures/purchase-image/synthetic-cart-english.png'),new AbortController().signal);assert(english.map(l=>l.text).join(' ').includes('Alcohol Swab'));
 const jpeg=await recognizeImage(root,resolve('electron-p0/tests/fixtures/purchase-image/synthetic-cart.jpg'),new AbortController().signal);assert(jpeg.map(l=>l.text).join(' ').includes('24,000'));
 console.log('Actual offline OCR:',JSON.stringify(lines));
});
test('all worker threads deny network calls and bound WASM memory; timeout/abort stop only the owned OCR process',async()=>{
 const guard=join(root,'offline-guard.cjs');const script=`const {Worker}=require('worker_threads');const checks=[];for(const name of ['http','https']){try{require(name).get('http://127.0.0.1:1');}catch{checks.push(name);}}try{new WebAssembly.Memory({initial:1,maximum:9000}).grow(8192);}catch{checks.push('memory');}new Worker("fetch('https://example.invalid').catch(()=>require('worker_threads').parentPort.postMessage('network-blocked'))",{eval:true}).once('message',m=>{checks.push(m);console.log(JSON.stringify(checks));});`;
 const result=JSON.parse(execFileSync(process.execPath,['--require',guard,'-e',script],{encoding:'utf8',timeout:10000}));assert.deepEqual(result,['http','https','memory','network-blocked']);
 const signal=new AbortController();signal.abort();await assert.rejects(recognizeImage(root,resolve('electron-p0/tests/fixtures/purchase-image/synthetic-cart.png'),signal.signal),/Canceled/);
 await assert.rejects(recognizeImage(root,resolve('electron-p0/tests/fixtures/purchase-image/synthetic-cart.png'),new AbortController().signal,1));
 const active=new AbortController(),pending=recognizeImage(root,resolve('electron-p0/tests/fixtures/purchase-image/synthetic-cart.png'),active.signal);setTimeout(()=>active.abort(),25);await assert.rejects(pending);
});
test('missing or modified offline assets fail closed; there is no model CDN fallback',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'ocr-package-test-'));try{await cp(root,temp,{recursive:true});await writeFile(join(temp,'runner.cjs'),'tampered');await assert.rejects(verifyOcrRuntime(temp));await cp(join(root,'runner.cjs'),join(temp,'runner.cjs'));await rm(join(temp,'data','kor.traineddata.gz'));await assert.rejects(verifyOcrRuntime(temp));}finally{await rm(temp,{recursive:true,force:true});}
});
