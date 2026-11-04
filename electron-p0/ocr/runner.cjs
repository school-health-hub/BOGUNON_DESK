'use strict';
require('./offline-guard.cjs');
const fs=require('node:fs'),path=require('node:path');
const threads=require('worker_threads'),OriginalWorker=threads.Worker;
threads.Worker=class LimitedWorker extends OriginalWorker{constructor(file,options){super(file,{...options,resourceLimits:{maxOldGenerationSizeMb:256,stackSizeMb:8}});}};
const {createWorker}=require('./node_modules/tesseract.js');
(async()=>{
 let worker;
 try{
  if(![3,4].includes(process.argv.length)||!path.isAbsolute(process.argv[2]))throw Error('Invalid owned input');
  const fd=fs.openSync(process.argv[2],'r');let bytes;
  try{const before=fs.fstatSync(fd);if(!before.isFile()||before.size>48*1024*1024||before.size<24)throw Error('OCR input size');bytes=Buffer.alloc(before.size);let offset=0;while(offset<bytes.length){const count=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);if(!count)throw Error('OCR input changed');offset+=count;}const after=fs.fstatSync(fd);if(after.size!==before.size||after.mtimeMs!==before.mtimeMs)throw Error('OCR input changed');}finally{fs.closeSync(fd);}
  const {prepare,options}=require('./preprocess.cjs'),setting=options(process.argv[3]?JSON.parse(process.argv[3]):undefined),prepared=prepare(bytes,setting);
  worker=await createWorker(['kor','eng'],1,{workerPath:path.join(__dirname,'node_modules/tesseract.js/src/worker-script/node/index.js'),langPath:path.join(__dirname,'data'),cacheMethod:'none',gzip:true,logger:()=>{},errorHandler:()=>{process.exit(1);}});
  await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:setting.layout==='sparse'?'11':'6'});
  const {data}=await worker.recognize(prepared.bytes,{}, {text:true,blocks:true});
  const lines=(data.blocks??[]).flatMap(b=>(b.paragraphs??[]).flatMap(p=>p.lines??[])).slice(0,300).map(l=>({text:l.text.slice(0,500),confidence:l.confidence,box:prepared.map([l.bbox.x0,l.bbox.y0,l.bbox.x1,l.bbox.y1]),layoutBox:[l.bbox.x0,l.bbox.y0,l.bbox.x1,l.bbox.y1],words:(l.words??[]).slice(0,80).map(w=>({text:w.text.slice(0,100),confidence:w.confidence,box:prepared.map([w.bbox.x0,w.bbox.y0,w.bbox.x1,w.bbox.y1]),layoutBox:[w.bbox.x0,w.bbox.y0,w.bbox.x1,w.bbox.y1]}))}));
  if(!lines.length&&data.text?.trim())for(const text of data.text.split('\n').filter(Boolean).slice(0,300))lines.push({text:text.slice(0,500),confidence:data.confidence,box:[0,0,0,0]});
  process.stdout.write(JSON.stringify({lines}));
 }catch{process.exitCode=1;}
 finally{if(worker)await worker.terminate().catch(()=>{});}
})();
