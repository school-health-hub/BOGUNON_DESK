import {lstat,realpath} from 'node:fs/promises';
import {basename,dirname,extname,isAbsolute,join,relative,sep} from 'node:path';
import {assertSender} from './policy.js';
import {FINANCE_CONFLICT,FINANCE_FAILURE,FinanceEngineError,type FinanceWorker} from './finance-process.js';
import type {FinanceBridge,FinanceSnapshot,RestorePreview} from '../finance-protocol.js';
import type {IpcResult} from '../protocol.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const fields=(value:unknown,keys:string[]):value is Record<string,unknown>=>record(value)&&Object.keys(value).sort().join(',')===keys.sort().join(',');
const uuid=(value:unknown):value is string=>typeof value==='string'&&UUID.test(value);
function identity(value:unknown){return fields(value,['schemaVersion','datasetId','revision','history'])&&value.schemaVersion===2&&uuid(value.datasetId)&&Number.isSafeInteger(value.revision)&&(value.revision as number)>0&&Array.isArray(value.history)&&value.history.length<=100000&&value.history.every(uuid);}
function bounded(value:unknown,depth=0):boolean{if(depth>20)return false;if(value===null||typeof value==='boolean')return true;if(typeof value==='number')return Number.isSafeInteger(value);if(typeof value==='string')return value.length<=5000&&!value.includes('\0');if(Array.isArray(value))return value.length<=100000&&value.every(v=>bounded(v,depth+1));return record(value)&&Object.keys(value).length<=30&&Object.entries(value).every(([key,v])=>!['__proto__','constructor','prototype'].includes(key)&&bounded(v,depth+1));}
const shapes={load:[],createIncome:['expected','entry'],updateIncome:['expected','entry'],deleteIncome:['expected','id'],replacePhase2:['expected','phase2'],exportBackup:['expected','password'],selectBackup:[],inspectBackup:['token','password'],restoreBackup:['token','confirmDatasetChange'],cancelBackup:['token']} as const;
type Operation=keyof typeof shapes;
export function validateFinanceInput(operation:Operation,value:unknown){
 if(shapes[operation].length===0){if(value!==undefined)throw new Error();return {};}
 if(!fields(value,[...shapes[operation]])||!bounded(value)||Buffer.byteLength(JSON.stringify(value))>64*1024*1024)throw new Error();
 if('expected'in value&&!identity(value.expected))throw new Error();
 if('token'in value&&!uuid(value.token))throw new Error();if('id'in value&&!uuid(value.id))throw new Error();
 if('entry'in value&&(!record(value.entry)||!uuid(value.entry.id)))throw new Error();
 if('phase2'in value&&!record(value.phase2))throw new Error();
 if('password'in value&&(typeof value.password!=='string'||Buffer.byteLength(value.password)>1024||Buffer.byteLength(value.password)<(operation==='exportBackup'?12:1)))throw new Error();
 if('confirmDatasetChange'in value&&typeof value.confirmDatasetChange!=='boolean')throw new Error();return structuredClone(value);
}
function snapshot(value:unknown):FinanceSnapshot{if(!record(value)||!identity(value.identity)||!Array.isArray(value.income)||!bounded(value)||value.income.length>100000||value.phase2!==undefined&&!record(value.phase2))throw new FinanceEngineError(FINANCE_FAILURE);return value as FinanceSnapshot;}
function preview(value:unknown):RestorePreview{if(!record(value)||!uuid(value.token)||!uuid(value.currentDatasetId)||!uuid(value.backupDatasetId)||typeof value.eligible!=='boolean'||typeof value.requiresDatasetConfirmation!=='boolean'||typeof value.reason!=='string'||value.reason.length>1000||![value.currentRevision,value.backupRevision,value.recordCount].every(n=>Number.isSafeInteger(n)&&(n as number)>=0))throw new FinanceEngineError(FINANCE_FAILURE);return value as RestorePreview;}
type Dependencies={worker:FinanceWorker;protectedRoot:string;pickBackup:()=>Promise<string|undefined>;saveBackup:()=>Promise<string|undefined>;reviewRestore:()=>Promise<boolean>};
export class FinanceService{
 private queue:Promise<unknown>=Promise.resolve();private epoch=0;private count=0;private token:string|null=null;
 private poisoned=false;
 constructor(private readonly deps:Dependencies){}
 async status(){const available=await this.deps.worker.available();return {available,reason:available?'Windows SQLCipher·DPAPI 엔진 준비됨 · 실행 및 저장소 확인은 진입 시 수행합니다.':'이 환경에서 Windows SQLCipher·DPAPI 엔진을 사용할 수 없습니다. 평문 저장이나 합성 성공으로 대체하지 않습니다.'};}
 private async backupPath(path:string,write:boolean){
  if(!isAbsolute(path)||extname(path).toLowerCase()!=='.bgfnbk')throw new Error();const parent=await realpath(dirname(path)),target=join(parent,basename(path));
  let root=this.deps.protectedRoot;try{root=await realpath(root);}catch{}const part=relative(root,target);if(part===''||part!=='..'&&!part.startsWith(`..${sep}`)&&!isAbsolute(part))throw new Error();
  try{const info=await lstat(target);if(write||!info.isFile()||info.isSymbolicLink()||info.size>64*1024*1024+52)throw new Error();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT'||!write)throw e;}return target;
 }
 execute(operation:Operation,value?:unknown){
  const input=validateFinanceInput(operation,value),epoch=this.epoch;if(this.count>=8)throw new FinanceEngineError(FINANCE_FAILURE);this.count++;
  const work=this.queue.then(async()=>{
   if(epoch!==this.epoch)throw new FinanceEngineError(FINANCE_FAILURE);
   if(!await this.deps.worker.available())throw new FinanceEngineError('Windows SQLCipher·DPAPI 엔진을 사용할 수 없습니다. 평문 저장은 허용하지 않습니다.');
   if(this.poisoned&&operation!=='load')throw new FinanceEngineError(FINANCE_FAILURE);
   if(operation==='load'&&this.poisoned){await this.deps.worker.close();this.token=null;this.poisoned=false;}
   try{
    if(operation==='exportBackup'){
     const path=await this.deps.saveBackup();if(epoch!==this.epoch)throw new Error();if(!path)return false;
     const result=await this.deps.worker.call({...input,operation,path:await this.backupPath(path,true)});if(result!==true)throw new Error();return true;
    }
    if(operation==='selectBackup'){
     if(this.token){await this.deps.worker.call({operation:'cancelBackup',token:this.token});this.token=null;}
     const path=await this.deps.pickBackup();if(epoch!==this.epoch)throw new Error();if(!path)return null;
     const result=await this.deps.worker.call({operation,path:await this.backupPath(path,false)});if(!uuid(result))throw new Error();this.token=result;return result;
    }
    if(['inspectBackup','restoreBackup'].includes(operation)&&input.token!==this.token)throw new Error();
    if(operation==='restoreBackup'&&!await this.deps.reviewRestore())throw new FinanceEngineError('복원을 취소했습니다. 현재 금융 데이터는 유지됩니다.');
    if(epoch!==this.epoch)throw new Error();
    const result=await this.deps.worker.call({...input,operation});
    if(operation==='inspectBackup')return preview(result);
    if(operation==='cancelBackup'){if(input.token===this.token)this.token=null;return null;}
    if(operation==='restoreBackup')this.token=null;
    return snapshot(result);
   }catch(error){if(!['inspectBackup','selectBackup','cancelBackup'].includes(operation))this.poisoned=true;throw error;}
  });this.queue=work.catch(()=>{});return work.finally(()=>{this.count--;});
 }
 close(){this.epoch++;this.token=null;const work=this.queue.then(async()=>{await this.deps.worker.close();this.poisoned=false;return null;});this.queue=work.catch(()=>{});return work;}
}
export function createFinanceHandlers(contents:{mainFrame:unknown;getURL():string},url:string,service:FinanceService){
 const wrap=(count:number,fn:(value?:unknown)=>Promise<unknown>)=>async(event:{sender:unknown;senderFrame:unknown},...args:unknown[]):Promise<IpcResult<unknown>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'금융 요청을 허용하지 않습니다.',retryable:false}};}
  if(args.length!==count)return {ok:false,error:{code:'INVALID_INPUT',message:FINANCE_FAILURE,retryable:false}};
  try{return {ok:true,data:await fn(args[0])};}catch(error){return {ok:false,error:{code:error instanceof FinanceEngineError&&error.message===FINANCE_CONFLICT?'CONFLICT':'STORAGE_ERROR',message:error instanceof FinanceEngineError?error.message:FINANCE_FAILURE,retryable:false}};}
 };
 const result:Record<keyof FinanceBridge,ReturnType<typeof wrap>>={status:wrap(0,()=>service.status()),close:wrap(0,()=>service.close())} as Record<keyof FinanceBridge,ReturnType<typeof wrap>>;
 for(const operation of Object.keys(shapes) as Operation[])result[operation]=wrap(shapes[operation].length?1:0,value=>service.execute(operation,value));return result;
}
