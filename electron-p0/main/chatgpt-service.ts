import type {ChatGptStatus,ChatGptRequest} from '../chatgpt-protocol.js';
import type {IpcResult} from '../protocol.js';
import {assertSender} from './policy.js';
import {ChatGptError,type ChatGptRunner} from './chatgpt-process.js';
import {validateAiRequest} from './ai-service.js';
import {validModel} from './ai-network.js';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const initial=(supported:boolean):ChatGptStatus=>({supported,phase:'disconnected',busy:false,accountId:null,identity:null,planUsageEnabled:false,models:[],model:null,textCallVerified:false,showPlanNotice:false,notice:supported?'기존 Tauri 연결은 가져오지 않습니다. Electron에서 새로 로그인하세요.':'ChatGPT DPAPI 연결은 Windows 실행본에서 사용할 수 있습니다.'});
const errors:Record<string,string>={cancelled:'요청을 취소했습니다. 이미 전송된 내용은 회수할 수 없습니다.',timeout:'ChatGPT 요청 시간이 초과되었습니다. 자동 재요청하지 않습니다.',authentication:'인증을 완료하지 못했습니다. 기존 등록 계정으로 다시 연결해 주세요.',reauthenticationRequired:'ChatGPT 계정을 다시 인증해 주세요.',permissionDenied:'ChatGPT 요금제 사용 권한을 확인해 주세요.',usageLimitExceeded:'ChatGPT 사용 한도에 도달했습니다. 사용량 설정을 확인해 주세요.',usageUnavailable:'ChatGPT 사용량을 현재 확인할 수 없습니다.',missingRuntime:'ChatGPT 인증 helper가 없습니다. 정상 Windows 패키지를 사용해 주세요.',unsupportedPlatform:'ChatGPT DPAPI 연결은 Windows에서만 지원합니다.',storage:'암호화된 ChatGPT 연결 정보를 처리하지 못했습니다. 기존 파일을 보존했습니다.',busy:'다른 ChatGPT 요청이 진행 중입니다.',invalidResponse:'ChatGPT 응답을 검증하지 못했습니다.',accountChanged:'계정이 변경되었습니다. 모델을 다시 조회해 주세요.'};
export class ChatGptService{
 private state:ChatGptStatus;
 private controller:AbortController|null=null;
 private epoch=0;
 constructor(private readonly runner:ChatGptRunner,private readonly review:(request:ChatGptRequest,model:string)=>Promise<boolean>){this.state=initial(runner.available);}
 private accept(value:unknown){
  if(!object(value)||!object(value.connection))throw new ChatGptError('invalidResponse');const c=value.connection;
  if(!['connected','disconnected','busy'].includes(String(c.status))||typeof c.planUsageEnabled!=='boolean'||typeof c.showPlanUsageNotice!=='boolean'||!(value.accountId===null||typeof value.accountId==='string'&&/^[a-f0-9]{64}$/.test(value.accountId)))throw new ChatGptError('invalidResponse');
  const connected=c.status==='connected';if(connected&&!value.accountId)throw new ChatGptError('invalidResponse');
  const changed=this.state.accountId!==value.accountId;
  const label=c.email??c.displayName;if(label!==null&&label!==undefined&&(typeof label!=='string'||label.length>320))throw new ChatGptError('invalidResponse');
  this.state={...this.state,accountId:connected?value.accountId as string:null,identity:connected?String(label??'ChatGPT 계정'):null,planUsageEnabled:connected&&c.planUsageEnabled,showPlanNotice:connected&&c.showPlanUsageNotice,phase:connected?c.planUsageEnabled?'ready':'permission-required':'disconnected',models:changed||!connected||!c.planUsageEnabled?[]:this.state.models,model:changed||!connected||!c.planUsageEnabled?null:this.state.model,textCallVerified:!changed&&connected&&c.planUsageEnabled&&this.state.textCallVerified,notice:object(c.notice)&&c.notice.code==='remoteRevocationFailed'?'이 PC의 연결은 해제했지만 원격 폐기는 확인하지 못했습니다. ChatGPT 설정에서도 확인해 주세요.':connected?'로그인 상태 확인됨. 모델 조회와 실제 호출 성공은 별도입니다.':'ChatGPT 연결이 해제되었습니다.'};
 }
 private async run<T>(work:(signal:AbortSignal,epoch:number)=>Promise<T>):Promise<T>{
  if(this.controller)throw new ChatGptError('busy');const controller=new AbortController(),epoch=++this.epoch;this.controller=controller;
  try{return await work(controller.signal,epoch);}catch(e){
   const code=e instanceof ChatGptError?e.code:'connection';
   if(code==='reauthenticationRequired'||code==='accountChanged'){this.state={...this.state,phase:'reauthentication-required',models:[],model:null,textCallVerified:false,planUsageEnabled:false};}
   else if(code==='permissionDenied')this.state={...this.state,phase:'permission-required',planUsageEnabled:false};
   else if(code==='usageLimitExceeded')this.state={...this.state,phase:'usage-limit'};
   else if(code!=='cancelled')this.state={...this.state,phase:'temporary-error'};
   this.state={...this.state,notice:errors[code]??'ChatGPT 연결을 완료하지 못했습니다. 원고와 API Key 연결은 유지됩니다.'};throw new Error(this.state.notice);
  }finally{if(this.controller===controller)this.controller=null;}
 }
 private check(signal:AbortSignal,epoch:number){if(signal.aborted||epoch!==this.epoch)throw new ChatGptError('cancelled');}
 private async invoke(action:string,signal:AbortSignal,epoch:number,extra:Record<string,unknown>={}){const data=await this.runner.run({action,...extra},signal);this.check(signal,epoch);return data;}
 snapshot():ChatGptStatus{return {...this.state,busy:!!this.controller,phase:this.controller&&this.state.phase==='authenticating'?'authenticating':this.state.phase,models:[...this.state.models]};}
 async status(){if(!this.runner.available||this.controller)return this.snapshot();return this.run(async(s,e)=>{const phase=this.state.phase,notice=this.state.notice;this.accept(await this.invoke('state',s,e));if(phase==='reauthentication-required'||this.state.accountId&&['usage-limit','temporary-error','permission-required'].includes(phase))this.state={...this.state,phase,notice};return this.snapshot();}).then(()=>this.snapshot());}
 async signIn(){return this.run(async(s,e)=>{this.state={...this.state,phase:'authenticating'};this.accept(await this.invoke('signIn',s,e));return null;}).then(()=>this.snapshot());}
 async refreshModels(){return this.run(async(s,e)=>{
  // User explicitly requested refresh. Native checks saved scopes and may refresh a token.
  const result=await this.invoke('models',s,e);if(!object(result)||!Array.isArray(result.models)||result.models.length>500)throw new ChatGptError('invalidResponse');
  const models=result.models.map(m=>{if(!object(m)||!validModel(m.slug)||typeof m.displayName!=='string'||!m.displayName.trim()||m.displayName.length>200)throw new ChatGptError('invalidResponse');return {id:m.slug,label:m.displayName};});
  this.accept(result.state);if(!this.state.planUsageEnabled)throw new ChatGptError('permissionDenied');
  const model=models.some(m=>m.id===this.state.model)?this.state.model:models[0]?.id??null;
  this.state={...this.state,models,model,textCallVerified:model===this.state.model&&this.state.textCallVerified,notice:'계정 모델 목록을 확인했습니다. 실제 AI 호출 성공을 의미하지 않습니다.'};
 }).then(()=>this.snapshot());}
 async selectModel(input:unknown){if(!object(input)||Object.keys(input).join(',')!=='model'||typeof input.model!=='string'||this.controller||!this.state.models.some(m=>m.id===input.model))throw Error('조회한 ChatGPT 모델을 선택해 주세요.');this.state={...this.state,model:input.model,textCallVerified:false};return this.snapshot();}
 async acknowledge(){return this.run(async(s,e)=>{this.accept(await this.invoke('acknowledge',s,e));}).then(()=>this.snapshot());}
 async disconnect(){return this.run(async(s,e)=>{this.accept(await this.invoke('disconnect',s,e));}).then(()=>this.snapshot());}
 async generate(input:unknown){
  if(!object(input)||Object.keys(input).sort().join(',')!=='prompt,tool')throw Error('AI 요청 내용을 확인해 주세요.');
  validateAiRequest({tool:input.tool==='connection-test'?'finder':input.tool,prompt:input.prompt});const request=input as ChatGptRequest;
  return this.run(async(s,e)=>{const {accountId,model}=this.state;if(!accountId||!model||!this.state.planUsageEnabled||!this.state.models.some(m=>m.id===model)||this.state.phase!=='ready')throw new ChatGptError('permissionDenied');
   if(!await this.review(request,model))return null;this.check(s,e);
   const result=await this.invoke('generate',s,e,{model,prompt:request.prompt,accountId});
   if(!object(result)||result.accountId!==accountId||typeof result.text!=='string'||!result.text.trim()||result.text.length>60000)throw new ChatGptError('invalidResponse');
   this.state={...this.state,textCallVerified:true,notice:'선택 계정·모델의 텍스트 호출이 완료되었습니다.'};return {text:result.text};
  });
 }
 cancel(){this.epoch++;this.controller?.abort();this.state={...this.state,notice:errors.cancelled};return null;}
 dispose(){this.cancel();this.runner.dispose();}
 flush(){return this.runner.flush();}
}
export function createChatGptHandlers(contents:Parameters<typeof assertSender>[1],url:string,service:ChatGptService){
 const wrap=<T>(count:number,work:(input:unknown)=>T|Promise<T>)=>async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<T>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용하지 않는 ChatGPT 요청입니다.',retryable:false}};}
  if(args.length!==count)return {ok:false,error:{code:'INVALID_INPUT',message:'ChatGPT 요청 내용을 확인해 주세요.',retryable:false}};
  try{return {ok:true,data:await work(args[0])};}catch(error){return {ok:false,error:{code:'INTERNAL_ERROR',message:error instanceof Error&&Object.values(errors).includes(error.message)?error.message:'ChatGPT 요청을 완료하지 못했습니다. 기존 자료를 유지합니다.',retryable:true}};}
 };
 return {status:wrap(0,()=>service.status()),signIn:wrap(0,()=>service.signIn()),refreshModels:wrap(0,()=>service.refreshModels()),selectModel:wrap(1,v=>service.selectModel(v)),acknowledge:wrap(0,()=>service.acknowledge()),disconnect:wrap(0,()=>service.disconnect()),generate:wrap(1,v=>service.generate(v)),cancel:wrap(0,()=>service.cancel())};
}
