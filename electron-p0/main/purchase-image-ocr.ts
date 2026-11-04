import {spawn} from 'node:child_process';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,isAbsolute,relative} from 'node:path';
import {IMAGE_IMPORT_LIMITS,type OcrLine} from '../purchase-image-protocol.js';
export async function verifyOcrRuntime(root:string){
 const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8')) as {offline?:boolean;files?:{file:string;bytes:number;sha256:string}[]};
 if(!manifest.offline||!Array.isArray(manifest.files)||manifest.files.length>300)throw Error('OCR runtime unavailable');
 for(const entry of manifest.files){if(isAbsolute(entry.file)||entry.file.includes('\\')||entry.file.split('/').includes('..')||relative(root,join(root,entry.file)).startsWith('..'))throw Error('Invalid OCR runtime');
  const file=join(root,entry.file),s=await lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.size!==entry.bytes)throw Error('OCR runtime mismatch');
  if(createHash('sha256').update(await readFile(file)).digest('hex')!==entry.sha256)throw Error('OCR runtime mismatch');
 }
 for(const name of ['runner.cjs','offline-guard.cjs','data/kor.traineddata.gz','data/eng.traineddata.gz','node_modules/tesseract.js/src/worker-script/node/index.js'])if(!manifest.files.some(f=>f.file===name))throw Error('Missing offline OCR resource');
}
export function parseOcrOutput(bytes:Buffer):readonly OcrLine[]{
 const value=JSON.parse(bytes.toString('utf8')) as {lines?:unknown};if(!Array.isArray(value.lines)||value.lines.length>300)throw Error('Invalid OCR output');let chars=0;
 return value.lines.map((row:unknown)=>{const r=row as OcrLine;if(!r||typeof r.text!=='string'||r.text.length>500||!Number.isFinite(r.confidence)||r.confidence<0||r.confidence>100||!Array.isArray(r.box)||r.box.length!==4||r.box.some(n=>!Number.isFinite(n)||n<0||n>IMAGE_IMPORT_LIMITS.dimension)||r.box[0]>r.box[2]||r.box[1]>r.box[3])throw Error('Invalid OCR output');chars+=r.text.length;if(chars>32000)throw Error('OCR output too large');return {text:r.text.trim(),confidence:r.confidence,box:r.box};});
}
export function recognizeImage(runtime:string,input:string,signal:AbortSignal,timeoutMs:number=IMAGE_IMPORT_LIMITS.timeoutMs,executable=process.execPath):Promise<readonly OcrLine[]>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(Error('Canceled'));return;}
  // Fixed Main-owned executable and runtime only. Never inherit NODE_OPTIONS or proxy credentials.
  const env:NodeJS.ProcessEnv={ELECTRON_RUN_AS_NODE:'1'};
  for(const key of ['SystemRoot','WINDIR','TEMP','TMP','LANG'])if(process.env[key])env[key]=process.env[key];
  const child=spawn(executable,['--max-old-space-size=256','--require',join(runtime,'offline-guard.cjs'),join(runtime,'runner.cjs'),input],{env,windowsHide:true,stdio:['ignore','pipe','ignore']});
  let chunks:Buffer[]=[],size=0,failed=false,settled=false;
  const stop=()=>{failed=true;child.kill();};const timer=setTimeout(stop,timeoutMs);signal.addEventListener('abort',stop,{once:true});
  const finish=(error?:Error,result?:readonly OcrLine[])=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',stop);chunks=[];if(error)reject(error);else resolve(result!);};
  child.stdout.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>512*1024)stop();else chunks.push(chunk);});
  child.once('error',()=>finish(Error('로컬 OCR을 실행하지 못했습니다.')));
  child.once('close',code=>{if(failed||code!==0){finish(Error('OCR 시간·메모리 제한 또는 실행 오류입니다.'));return;}try{finish(undefined,parseOcrOutput(Buffer.concat(chunks)));}catch{finish(Error('OCR 결과를 읽지 못했습니다.'));}});
 });
}
