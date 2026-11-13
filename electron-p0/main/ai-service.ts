import type {ImageAiConnection} from '../purchase-ai-protocol.js';
import {randomUUID} from 'node:crypto';
import {generateApiImages} from './ai-image-network.js';
import {supportsImage,type OutboundImage} from './ai-image-contract.js';
import type {AiConnect,AiRequest,AiStatus,AiModel,IpcResult} from '../protocol.js';
import type {AiCredential,AiVault} from './ai-vault.js';
import {validAiKey} from './ai-vault.js';
import {AI_ERROR,AiError,discoverAiCatalog,generateAiText,type AiFetch} from './ai-network.js';
import {buildNewsletterCapabilitySelection,selectNewsletterCapabilityModel,type NewsletterCapabilityKind,type NewsletterCapabilitySelection} from './newsletter-ai-capabilities.js';
import {generateNewsletterTextProposal,parseNewsletterAiTextRequest,regenerateNewsletterTopicText} from './newsletter-ai-text.js';
import {generateNewsletterImageCandidate} from './newsletter-ai-image.js';
import {NewsletterAiConsentPolicy,NewsletterAiConsentPolicyError,type NewsletterAiConsentFile,type NewsletterAiConsentRequest,type NewsletterAiConsentReview,type NewsletterAiPreparedConsent} from './newsletter-ai-consent.js';
import type {NewsletterAiImageRequest} from '../newsletter-ai-bridge.js';
import type {NewsletterAiTextResult} from '../newsletter-ai-protocol.js';
import type {NewsletterAiStoredCandidate} from './newsletter-ai-candidate-store.js';
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
type Dependencies={chatGptSupported?:boolean;vault:AiVault;fetch:AiFetch;readClipboard:()=>Promise<string>;clearClipboard:(expected:string)=>Promise<void>;reviewKey:(input:AiConnect)=>Promise<boolean>;reviewSend:(request:AiRequest,connection:Readonly<{provider:string;model:string}>)=>Promise<boolean>;reviewNewsletter?:(manifest:NewsletterAiPreparedConsent)=>Promise<NewsletterAiConsentReview>;nextNewsletterRequestId?:()=>string;now?:()=>Date;timeoutMs?:number};
type NewsletterConsentExecution<T>=Readonly<{request:NewsletterAiConsentRequest;currentFiles:readonly NewsletterAiConsentFile[];signal:AbortSignal;epoch:number;send:(signal:AbortSignal)=>Promise<T>}>;
export class AiService{
 private connection:AiCredential|null=null;
 private models:AiModel[]=[];
 private newsletterSelection:NewsletterCapabilitySelection|null=null;
 private remembered=false;
 private credentialQueue:Promise<unknown>=Promise.resolve();
 private credentialWork<T>(work:()=>Promise<T>):Promise<T>{const operation=this.credentialQueue.then(work);this.credentialQueue=operation.catch(()=>{});return operation;}
 private epoch=0;
 private imageVersion=0;
 private controller:AbortController|null=null;
 private readonly newsletterConsent:NewsletterAiConsentPolicy|null;
 constructor(private readonly deps:Dependencies){this.newsletterConsent=deps.reviewNewsletter?new NewsletterAiConsentPolicy({review:deps.reviewNewsletter,nextRequestId:deps.nextNewsletterRequestId??randomUUID,now:deps.now??(()=>new Date())}):null;}
 async status():Promise<AiStatus>{return {connected:this.connection!==null,provider:this.connection?.provider??null,model:this.connection?.model??null,models:[...this.models],textModel:this.newsletterSelection?.textModel??null,imageModel:this.newsletterSelection?.imageModel??null,textModels:[...(this.newsletterSelection?.textModels??[])],imageModels:[...(this.newsletterSelection?.imageModels??[])],stored:await this.deps.vault.exists(),secureStorage:this.deps.vault.available,busy:this.controller!==null,chatGptSupported:this.deps.chatGptSupported??false};}
 private selectedCredential(provider:AiCredential['provider'],key:string,model:string,selection:NewsletterCapabilitySelection):AiCredential{
  return selection.textModel===null?{provider,key,model}:{provider,key,model,textModel:selection.textModel,imageModel:selection.imageModel};
 }
 private check(signal:AbortSignal,epoch:number){if(signal.aborted||epoch!==this.epoch)throw new AiError(AI_ERROR.cancelled);}
 private async executeNewsletterConsent<T>(execution:NewsletterConsentExecution<T>){
  if(!this.newsletterConsent)throw new AiError('보건소식지 외부 전송 검토를 사용할 수 없습니다.');
  const prepared=this.newsletterConsent.prepare(execution.request);
  try{return await this.newsletterConsent.execute(prepared.requestId,execution.currentFiles,consentSignal=>{
   this.check(execution.signal,execution.epoch);
   return execution.send(AbortSignal.any([execution.signal,consentSignal]));
  });}catch(error){
   this.check(execution.signal,execution.epoch);
   if(error instanceof NewsletterAiConsentPolicyError)throw new AiError(error.message);
   throw error;
  }
 }
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
   const catalog=await network(()=>discoverAiCatalog(this.deps.fetch,input.provider,key,signal));this.check(signal,epoch);if([...catalog.models,...catalog.capabilityModels].some(m=>m.id.includes(key)||m.label.includes(key)))throw new AiError(AI_ERROR.invalid);
   const selection=buildNewsletterCapabilitySelection(input.provider,catalog.capabilityModels,null);const credential=this.selectedCredential(input.provider,key,catalog.models[0].id,selection);
   if(input.remember){await this.credentialWork(async()=>{this.check(signal,epoch);await this.deps.vault.write(credential);});this.check(signal,epoch);}
   else {await this.credentialWork(async()=>{this.check(signal,epoch);await this.deps.vault.clear();});this.check(signal,epoch);}
   this.imageVersion++;this.connection=credential;this.models=[...catalog.models];this.newsletterSelection=selection;this.remembered=input.remember;await this.deps.clearClipboard(clipboard);this.check(signal,epoch);
   return {...await this.status(),busy:false};
  });
 }
 restore(){return this.run(async(signal,epoch,network)=>{
  const credential=await this.deps.vault.read();this.check(signal,epoch);if(!credential)throw new AiError('저장된 API 연결이 없습니다.');
  const catalog=await network(()=>discoverAiCatalog(this.deps.fetch,credential.provider,credential.key,signal));this.check(signal,epoch);if([...catalog.models,...catalog.capabilityModels].some(m=>m.id.includes(credential.key)||m.label.includes(credential.key)))throw new AiError(AI_ERROR.invalid);
  const model=catalog.models.some(candidate=>candidate.id===credential.model)?credential.model:catalog.models[0].id;
  const selection=buildNewsletterCapabilitySelection(credential.provider,catalog.capabilityModels,{textModel:credential.textModel??credential.model,imageModel:credential.imageModel??null});
  this.imageVersion++;this.connection=this.selectedCredential(credential.provider,credential.key,model,selection);this.models=[...catalog.models];this.newsletterSelection=selection;this.remembered=true;
  return {...await this.status(),busy:false};
 });}
 selectModel(value:unknown){
  if(!keys(value,['model'])||typeof value.model!=='string')throw new AiError(INPUT_ERROR);const model=value.model;
  return this.run(async(signal,epoch)=>{if(!this.connection||!this.models.some(m=>m.id===model))throw new AiError('계정에서 조회한 모델을 선택해 주세요.');
   const selection=this.newsletterSelection;const next=selection?this.selectedCredential(this.connection.provider,this.connection.key,model,selection):{...this.connection,model};if(this.remembered)await this.credentialWork(async()=>{this.check(signal,epoch);await this.deps.vault.write(next);});this.check(signal,epoch);this.connection=next;return {...await this.status(),busy:false};});
 }
 selectNewsletterModel(value:unknown){
  if(!keys(value,['kind','model'])||(value.kind!=='text'&&value.kind!=='image')||typeof value.model!=='string')throw new AiError(INPUT_ERROR);
  const kind:NewsletterCapabilityKind=value.kind;const model=value.model;
  return this.run(async(signal,epoch)=>{if(!this.connection||!this.newsletterSelection)throw new AiError('AI 서비스가 연결되지 않았습니다.');
   let selection:NewsletterCapabilitySelection;try{selection=selectNewsletterCapabilityModel(this.newsletterSelection,kind,model);}catch(error){if(error instanceof Error)throw new AiError('선택한 모델은 이 기능을 지원하지 않습니다.');throw error;}
   const next=this.selectedCredential(this.connection.provider,this.connection.key,this.connection.model,selection);if(this.remembered)await this.credentialWork(async()=>{this.check(signal,epoch);await this.deps.vault.write(next);});this.check(signal,epoch);this.connection=next;this.newsletterSelection=selection;return {...await this.status(),busy:false};});
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
 proposeNewsletterText(value:unknown){const request=parseNewsletterAiTextRequest(value);
  if(!inspectOfficialDocumentPrivacy(request.brief).isSafe)throw new AiError('개인정보 가능 항목이 있습니다. 제거한 뒤 다시 확인해 주세요.');
  return this.run(async(signal,epoch,network)=>{
   const connection=this.connection,textModel=this.newsletterSelection?.textModel;if(!connection||!textModel)throw new AiError('구조화 원고 생성을 지원하는 AI 모델이 연결되지 않았습니다.');
   const consentRequest:NewsletterAiConsentRequest={operation:'generate-text',provider:connection.provider,model:textModel,mock:false,files:[],externalDataCategories:['보건소식지 생성 지시문'],cost:{status:'unknown'},privacyReviewText:request.brief};
   const sendText=(consentSignal:AbortSignal):Promise<NewsletterAiTextResult>=>request.regenerate===undefined
    ?generateNewsletterTextProposal(this.deps.fetch,{provider:connection.provider,key:connection.key,model:textModel},request,consentSignal)
    :regenerateNewsletterTopicText(this.deps.fetch,{provider:connection.provider,key:connection.key,model:textModel},request,consentSignal);
   const result=await this.executeNewsletterConsent<NewsletterAiTextResult>({request:consentRequest,currentFiles:[],signal,epoch,send:consentSignal=>network(()=>sendText(consentSignal))});
   switch(result.status){
    case 'declined':return null;
    case 'cancelled':throw new AiError(AI_ERROR.cancelled);
    case 'completed':
     this.check(signal,epoch);if(JSON.stringify(result.value).includes(connection.key))throw new AiError(AI_ERROR.invalid);return result.value;
    default: {const unreachable:never=result;throw unreachable;}
   }
  });
 }
 generateNewsletterImageCandidate(request:NewsletterAiImageRequest,references:readonly NewsletterAiStoredCandidate[]){
  if(!inspectOfficialDocumentPrivacy(request.prompt).isSafe)throw new AiError('개인정보 가능 항목이 있습니다. 제거한 뒤 다시 확인해 주세요.');
  return this.run(async(signal,epoch,network)=>{
   const connection=this.connection,imageModel=this.newsletterSelection?.imageModel;
   if(!connection||!imageModel||request.provider!==connection.provider||request.model!==imageModel)throw new AiError('이미지 생성을 지원하는 AI 모델 연결을 확인해 주세요.');
   const extension=(mediaType:NewsletterAiStoredCandidate['mediaType'])=>mediaType==='image/png'?'png':mediaType==='image/jpeg'?'jpg':'webp';
   const files:NewsletterAiConsentFile[]=references.map(reference=>({name:`${reference.candidateId}.${extension(reference.mediaType)}`,sha256:reference.sha256,byteSize:Buffer.from(reference.bytesBase64,'base64').byteLength,purpose:'사용자가 선택한 보건교육 삽화 참고'}));
   const consentRequest:NewsletterAiConsentRequest={operation:references.length===0?'generate-image':'edit-image',provider:connection.provider,model:imageModel,mock:false,files,externalDataCategories:['보건교육 삽화 생성 지시문',...(references.length===0?[]:['선택한 참고 이미지'])],cost:{status:'unknown'},privacyReviewText:request.prompt};
   const imageRequest={baseline:request.baseline,requestId:request.requestId,topicId:request.topicId,target:request.target,prompt:request.prompt,references:references.map((reference,index)=>({name:files[index]?.name??'reference-image',sha256:reference.sha256,byteSize:files[index]?.byteSize??0,purpose:files[index]?.purpose??'선택한 참고 이미지',mediaType:reference.mediaType,bytesBase64:reference.bytesBase64}))};
   const result=await this.executeNewsletterConsent({request:consentRequest,currentFiles:files,signal,epoch,send:consentSignal=>network(()=>generateNewsletterImageCandidate(this.deps.fetch,{provider:connection.provider,key:connection.key,model:imageModel},imageRequest,consentSignal,this.deps.now??(()=>new Date())))});
   switch(result.status){
    case 'declined':throw new AiError('이미지 외부 전송이 승인되지 않았습니다.');
    case 'cancelled':throw new AiError(AI_ERROR.cancelled);
    case 'completed':{
     this.check(signal,epoch);const {candidate,bytesBase64}=result.value;
     return {candidateId:candidate.candidateId,baseline:candidate.baseline,mediaType:candidate.mediaType,bytesBase64,sha256:candidate.outputHash,width:candidate.width,height:candidate.height,provenance:candidate};
    }
    default:{const unreachable:never=result;throw unreachable;}
   }
  });
 }
 imageContext():ImageAiConnection|null{return this.connection&&!this.controller?{provider:this.connection.provider,connectionId:`${this.connection.provider}:${this.imageVersion}`,models:[...this.models]}:null;}
 async generateImages(expected:string,model:string,prompt:string,images:readonly OutboundImage[],outerSignal:AbortSignal){
  if(this.imageContext()?.connectionId!==expected)throw new AiError('AI 연결이 변경되었습니다.');
  return this.run(async(signal,epoch)=>{const c=this.connection;if(!c||!this.models.some(m=>m.id===model)||!supportsImage(c.provider,model)||outerSignal.aborted)throw new AiError('이미지 모델·권한을 확인해 주세요.');
   const abort=()=>this.cancel();outerSignal.addEventListener('abort',abort,{once:true});
   try{const text=await generateApiImages(this.deps.fetch,c.provider,c.key,model,prompt,images,signal);this.check(signal,epoch);return text;}finally{outerSignal.removeEventListener('abort',abort);}
  });
 }
 cancel(){this.epoch++;this.controller?.abort();return null;}
 async disconnect(){this.imageVersion++;this.cancel();this.connection=null;this.models=[];this.newsletterSelection=null;this.remembered=false;try{await this.credentialWork(()=>this.deps.vault.clear());}catch{throw new AiError('세션 연결은 해제했지만 저장된 인증정보를 삭제하지 못했습니다. 앱 설정에서 다시 해제해 주세요.');}return this.status();}
 dispose(){this.imageVersion++;this.cancel();this.connection=null;this.models=[];this.newsletterSelection=null;this.remembered=false;}
}
export function createAiHandlers(contents:{mainFrame:unknown;getURL():string},url:string,service:AiService){
 const wrap=<T>(count:number,fn:(input:unknown)=>Promise<T>|T)=>async(event:{sender:unknown;senderFrame:unknown},...args:unknown[]):Promise<IpcResult<T>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'AI 요청을 허용하지 않습니다.',retryable:false}};}
  if(args.length!==count)return {ok:false,error:{code:'INVALID_INPUT',message:INPUT_ERROR,retryable:false}};
  try{return {ok:true,data:await fn(args[0])};}catch(error){return {ok:false,error:{code:'INTERNAL_ERROR',message:error instanceof AiError?error.message:'AI 연결을 완료하지 못했습니다. 인증정보·원고는 로그에 기록하지 않습니다.',retryable:true}};}
 };
 return {status:wrap(0,()=>service.status()),connectFromClipboard:wrap(1,input=>service.connectFromClipboard(input)),restore:wrap(0,()=>service.restore()),selectModel:wrap(1,input=>service.selectModel(input)),generate:wrap(1,input=>service.generate(input)),cancel:wrap(0,()=>service.cancel()),disconnect:wrap(0,()=>service.disconnect())};
}
