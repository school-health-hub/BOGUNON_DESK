import type {AiConnect,AiRequest,AiStatus,AiModel,IpcResult} from '../protocol.js';
import type {AiCredential,AiVault} from './ai-vault.js';
import {validAiKey} from './ai-vault.js';
import {AI_ERROR,AiError,discoverAiModels,generateAiText,type AiFetch} from './ai-network.js';
import {inspectOfficialDocumentPrivacy} from './ai-privacy.js';
import {assertSender} from './policy.js';
const INPUT_ERROR='AI 요청 내용을 확인해 주세요.';
const keys=(value:unknown,expected:string[]):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===expected.sort().join(',');
export function validateAiConnect(value:unknown):AiConnect{
 if(!keys(value,['provider','remember'])||(value.provider!=='openai'&&value.provider!=='gemini')||typeof value.remember!=='boolean')throw new AiError(INPUT_ERROR);return {provider:value.provider as AiConnect['provider'],remember:value.remember};
}
export function validateAiRequest(value:unknown):AiRequest{
 if(!keys(value,['tool','prompt'])||!(['official-document','newsletter','finder'] as unknown[]).includes(value.tool)||typeof value.prompt!=='string'||!value.prompt.trim()||value.prompt.length>60000||Buffer.byteLength(value.prompt)>65536||value.prompt.includes('\0'))throw new AiError(INPUT_ERROR);
 if(!inspectOfficialDocumentPrivacy(value.prompt).isSafe)throw new AiError('개인정보 가능 항목이 있습니다. 제거한 뒤 다시 확인해 주세요.');return {tool:value.tool as AiRequest['tool'],prompt:value.prompt};
}
type Dependencies={vault:AiVault;fetch:AiFetch;readClipboard:()=>Promise<string>;clearClipboard:(expected:string)=>Promise<void>;reviewKey:(input:AiConnect)=>Promise<boolean>;reviewSend:(request:AiRequest,connection:Readonly<{provider:string;model:string}>)=>Promise<boolean>;timeoutMs?:number};
export class AiService{
 private connection:AiCredential|null=null;
 private models:AiModel[]=[];
 private remembered=false;
 private credentialQueue:Promise<unknown>=Promise.resolve();
 private credentialWork<T>(work:()=>Promise<T>):Promise<T>{const operation=this.credentialQueue.then(work);this.credentialQueue=operation.catch(()=>{});return operation;}
 private epoch=0;
 private controller:AbortController|null=null;
 constructor(private readonly deps:Dependencies){}
 async status():Promise<AiStatus>{return {connected:this.connection!==null,provider:this.connection?.provider??null,model:this.connection?.model??null,models:[...this.models],stored:await this.deps.vault.exists(),secureStorage:this.deps.vault.available,busy:this.controller!==null,chatGptSupported:false};}
 private check(signal:AbortSignal,epoch:number){if(signal.aborted||epoch!==this.epoch)throw new AiError(AI_ERROR.cancelled);}
 private async run<T>(work:(signal:AbortSignal,epoch:number,network:<R>(work:()=>Promise<R>)=>Promise<R>)=>Promise<T>):Promise<T>{
  if(this.controller)throw new AiError('다른 AI 요청이 진행 중입니다. 완료하거나 취소해 주세요.');
  const controller=new AbortController(),epoch=++this.epoch;this.controller=controller;
  const network=async<R>(work:()=>Promise<R>):Promise<R>=>{const timer=setTimeout(()=>controller.abort(new AiError(AI_ERROR.timeout)),this.deps.timeoutMs??20000);try{return await work();}finally{clearTimeout(timer);}};
  try{const result=await work(controller.signal,epoch,network);this.check(controller.signal,epoch);return result;}
  catch(error){if(controller.signal.reason instanceof AiError&&controller.signal.reason.message===AI_ERROR.timeout)throw controller.signal.reason;throw error;}
  finally{if(this.controller===controller)this.controller=null;}
 }
 connectFromClipboard(value:unknown){const input=validateAiConnect(value);
  return this.run(async(signal,epoch,network)=>{
   if(input.remember&&!this.deps.vault.available)throw new AiError('이 환경에서는 안전한 인증정보 저장을 사용할 수 없습니다. 세션 연결을 선택해 주세요.');
   if(!await this.deps.reviewKey(input))return null;this.check(signal,epoch);
   const clipboard=await this.deps.readClipboard();this.check(signal,epoch);const key=clipboard.trim();if(!validAiKey(key))throw new AiError(AI_ERROR.auth);
   const models=await network(()=>discoverAiModels(this.deps.fetch,input.provider,key,signal));this.check(signal,epoch);if(models.some(m=>m.id.includes(key)||m.label.includes(key)))throw new AiError(AI_ERROR.invalid);
   const credential={provider:input.provider,key,model:models[0].id};
   if(input.remember){await this.credentialWork(async()=>{this.check(signal,epoch);await this.deps.vault.write(credential);});this.check(signal,epoch);}
   else {await this.credentialWork(async()=>{this.check(signal,epoch);await this.deps.vault.clear();});this.check(signal,epoch);}
   this.connection=credential;this.models=models;this.remembered=input.remember;await this.deps.clearClipboard(clipboard);this.check(signal,epoch);
   return {...await this.status(),busy:false};
  });
 }
 restore(){return this.run(async(signal,epoch,network)=>{
  const credential=await this.deps.vault.read();this.check(signal,epoch);if(!credential)throw new AiError('저장된 API 연결이 없습니다.');
  const models=await network(()=>discoverAiModels(this.deps.fetch,credential.provider,credential.key,signal));this.check(signal,epoch);if(models.some(m=>m.id.includes(credential.key)||m.label.includes(credential.key)))throw new AiError(AI_ERROR.invalid);
  this.connection={...credential,model:models.some(m=>m.id===credential.model)?credential.model:models[0].id};this.models=models;this.remembered=true;
  return {...await this.status(),busy:false};
 });}
 selectModel(value:unknown){
  if(!keys(value,['model'])||typeof value.model!=='string')throw new AiError(INPUT_ERROR);const model=value.model;
  return this.run(async(signal,epoch)=>{if(!this.connection||!this.models.some(m=>m.id===model))throw new AiError('계정에서 조회한 모델을 선택해 주세요.');
   const next={...this.connection,model};if(this.remembered)await this.credentialWork(async()=>{this.check(signal,epoch);await this.deps.vault.write(next);});this.check(signal,epoch);this.connection=next;return {...await this.status(),busy:false};});
 }
 generate(value:unknown){const request=validateAiRequest(value);
  return this.run(async(signal,epoch,network)=>{
   const connection=this.connection;if(!connection)throw new AiError('AI 서비스가 연결되지 않았습니다.');
   if(!await this.deps.reviewSend(request,{provider:connection.provider,model:connection.model}))return null;
   this.check(signal,epoch);
   const text=await network(()=>generateAiText(this.deps.fetch,connection.provider,connection.key,connection.model,request.prompt,signal));this.check(signal,epoch);
   if(text.includes(connection.key))throw new AiError(AI_ERROR.invalid);return {text};
  });
 }
 cancel(){this.epoch++;this.controller?.abort();return null;}
 async disconnect(){this.cancel();this.connection=null;this.models=[];this.remembered=false;try{await this.credentialWork(()=>this.deps.vault.clear());}catch{throw new AiError('세션 연결은 해제했지만 저장된 인증정보를 삭제하지 못했습니다. 앱 설정에서 다시 해제해 주세요.');}return this.status();}
 dispose(){this.cancel();this.connection=null;this.models=[];this.remembered=false;}
}
export function createAiHandlers(contents:{mainFrame:unknown;getURL():string},url:string,service:AiService){
 const wrap=<T>(count:number,fn:(input:unknown)=>Promise<T>|T)=>async(event:{sender:unknown;senderFrame:unknown},...args:unknown[]):Promise<IpcResult<T>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'AI 요청을 허용하지 않습니다.',retryable:false}};}
  if(args.length!==count)return {ok:false,error:{code:'INVALID_INPUT',message:INPUT_ERROR,retryable:false}};
  try{return {ok:true,data:await fn(args[0])};}catch(error){return {ok:false,error:{code:'INTERNAL_ERROR',message:error instanceof AiError?error.message:'AI 연결을 완료하지 못했습니다. 인증정보·원고는 로그에 기록하지 않습니다.',retryable:true}};}
 };
 return {status:wrap(0,()=>service.status()),connectFromClipboard:wrap(1,input=>service.connectFromClipboard(input)),restore:wrap(0,()=>service.restore()),selectModel:wrap(1,input=>service.selectModel(input)),generate:wrap(1,input=>service.generate(input)),cancel:wrap(0,()=>service.cancel()),disconnect:wrap(0,()=>service.disconnect())};
}
