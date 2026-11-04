'use strict';
require('./offline-guard.cjs');
const fs=require('node:fs'),path=require('node:path');
const threads=require('worker_threads'),OriginalWorker=threads.Worker;
threads.Worker=class LimitedWorker extends OriginalWorker{constructor(file,options){super(file,{...options,resourceLimits:{maxOldGenerationSizeMb:256,stackSizeMb:8}});}};
const {createWorker}=require('./node_modules/tesseract.js');
(async()=>{
 let worker;
 try{
  if(process.argv.length!==3||!path.isAbsolute(process.argv[2]))throw Error('Invalid owned input');
  const fd=fs.openSync(process.argv[2],'r');let bytes;
  try{const before=fs.fstatSync(fd);if(!before.isFile()||before.size>48*1024*1024||before.size<24)throw Error('OCR input size');bytes=Buffer.alloc(before.size);let offset=0;while(offset<bytes.length){const count=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);if(!count)throw Error('OCR input changed');offset+=count;}const after=fs.fstatSync(fd);if(after.size!==before.size||after.mtimeMs!==before.mtimeMs)throw Error('OCR input changed');}finally{fs.closeSync(fd);}
  worker=await createWorker(['kor','eng'],1,{workerPath:path.join(__dirname,'node_modules/tesseract.js/src/worker-script/node/index.js'),langPath:path.join(__dirname,'data'),cacheMethod:'none',gzip:true,logger:()=>{},errorHandler:()=>{}});
  await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'6'});
  const {data}=await worker.recognize(bytes,{}, {text:true,blocks:true});
  const lines=(data.blocks??[]).flatMap(b=>(b.paragraphs??[]).flatMap(p=>p.lines??[])).slice(0,300).map(l=>({text:l.text.slice(0,500),confidence:l.confidence,box:[l.bbox.x0,l.bbox.y0,l.bbox.x1,l.bbox.y1]}));
  if(!lines.length&&data.text?.trim())for(const text of data.text.split('\n').filter(Boolean).slice(0,300))lines.push({text:text.slice(0,500),confidence:data.confidence,box:[0,0,0,0]});
  process.stdout.write(JSON.stringify({lines}));
 }catch{process.exitCode=1;}
 finally{if(worker)await worker.terminate().catch(()=>{});}
})();
