import {randomUUID,createHash} from 'node:crypto';
import type {ImageSource,ImageBox} from '../purchase-image-protocol.js';
import type {ImageAiConnection,ImageAiPrepare,ImageAiPrepared,ImageAiAnalysis,ImageAiProvider} from '../purchase-ai-protocol.js';
import type {IpcResult} from '../protocol.js';
import {assertSender} from './policy.js';
import {exact,supportsImage,IMAGE_AI_LIMITS as LIMIT,CART_AI_PROMPT,parseImageAiResponse,type OutboundImage} from './ai-image-contract.js';
export type ImageAiBackend={context:()=>ImageAiConnection|null;generate:(connectionId:string,model:string,prompt:string,images:readonly OutboundImage[],signal:AbortSignal)=>Promise<string>};
export type ImageOwner={isCurrent:(token:string)=>boolean;readSource:(token:string,sourceId:string)=>Promise<{source:ImageSource;bytes:Buffer}>};
const failureMessages={timeout:'AI 이미지 요청 시간이 초과되었습니다. 결과가 불명확하므로 자동 재요청하지 않습니다.',cancelled:'AI 이미지 요청을 취소했습니다. 이미 전송된 이미지는 회수할 수 없습니다.',auth:'AI 인증이 만료되었거나 확인되지 않습니다. 다시 연결해 주세요.',permission:'선택 계정·모델의 이미지 권한을 확인해 주세요.',limit:'AI 사용 한도 또는 요청 제한에 도달했습니다. 자동 재요청하지 않습니다.',connection:'AI 연결을 완료하지 못했습니다. 결과가 불명확할 수 있으므로 재요청 전에 상태를 확인하세요.',response:'AI 결과 형식·이미지 근거를 검증하지 못했습니다. 기존 검토와 구매 목록을 유지합니다.'};
export class ImageAiFailure extends Error{constructor(readonly reason:keyof typeof failureMessages){super(failureMessages[reason]);}}
type Prepared={public:ImageAiPrepared;token:string;connectionId:string;generation:number};
export class PurchaseAiService{
 private generation=0;
 private prepared:Prepared|null=null;
 private controller:AbortController|null=null;
 private busy=false;
 private attempts=new Map<string,number>();
 constructor(private readonly deps:{images:ImageOwner;backends:Record<ImageAiProvider,ImageAiBackend>;redact:(bytes:Buffer,boxes:readonly ImageBox[])=>{png:Buffer;width:number;height:number};review:(prepared:ImageAiPrepared)=>Promise<boolean>;now?:()=>number}){}
 connections():readonly ImageAiConnection[]{return (['chatgpt','openai','gemini'] as const).flatMap(provider=>{const c=this.deps.backends[provider].context();if(!c||c.provider!==provider)return [];return [{...c,models:c.models.filter(m=>supportsImage(provider,m.id,this.now()))}];});}
 private now(){return this.deps.now?.()??Date.now();}
 private check(gen:number,token:string){if(gen!==this.generation||this.controller?.signal.aborted||!this.deps.images.isCurrent(token))throw Error('취소되었거나 이미지 선택이 변경되었습니다. 기존 품목은 유지합니다.');}
 async prepare(input:unknown):Promise<ImageAiPrepared>{
  if(this.busy)throw Error('다른 이미지 요청이 진행 중입니다.');
  if(!exact(input,['token','provider','model','sources'])||typeof input.token!=='string'||typeof input.model!=='string'||!['chatgpt','openai','gemini'].includes(String(input.provider))||!Array.isArray(input.sources)||!input.sources.length||input.sources.length>LIMIT.files)throw Error('이미지 전송 설정을 확인해 주세요.');
  const request=input as unknown as ImageAiPrepare;
  const backend=this.deps.backends[request.provider],connection=backend.context();
  if(!connection||connection.provider!==request.provider||!connection.models.some(m=>m.id===request.model)||!supportsImage(request.provider,request.model,this.now()))throw Error('연결 계정과 공식 이미지 지원이 확인된 모델을 선택해 주세요.');
  const seen=new Set<string>();for(const source of request.sources){if(!exact(source,['sourceId','redactions'])||typeof source.sourceId!=='string'||seen.has(source.sourceId)||!Array.isArray(source.redactions)||source.redactions.length>24)throw Error('중복 또는 잘못된 이미지 참조입니다.');seen.add(source.sourceId);}
  for(const token of this.attempts.keys())if(token!==request.token)this.attempts.delete(token);this.prepared=null;this.busy=true;const generation=++this.generation;const images:ImageAiPrepared['images'][number][]=[];let bytes=0,pixels=0;
  try{
   this.check(generation,request.token);
   for(const config of request.sources){const {source,bytes:original}=await this.deps.images.readSource(request.token,config.sourceId);this.check(generation,request.token);pixels+=source.width*source.height;if(pixels>LIMIT.batchPixels)throw Error('AI 전송본의 전체 픽셀 제한을 초과했습니다. 이미지를 제외해 주세요.');const encoded=this.deps.redact(original,config.redactions);
    if(!encoded.png.length||encoded.png.length>LIMIT.imageBytes||encoded.width!==source.width||encoded.height!==source.height)throw Error('전송본은 장당 4MiB 이하여야 합니다. 원본은 유지했습니다.');bytes+=encoded.png.length;if(bytes>LIMIT.batchBytes)throw Error('AI 전송본 합계는 8MiB 이하입니다. 전송 이미지를 줄여 주세요.');
    images.push({sourceId:source.id,name:source.name,dataUrl:'data:image/png;base64,'+encoded.png.toString('base64'),sha256:createHash('sha256').update(encoded.png).digest('hex'),originalSha256:source.sha256,width:encoded.width,height:encoded.height,redactions:config.redactions.length});
   }
   this.check(generation,request.token);if(backend.context()?.connectionId!==connection.connectionId)throw Error('AI 연결이 변경되었습니다. 다시 검토해 주세요.');
   const prepared:ImageAiPrepared={id:randomUUID(),provider:request.provider,model:request.model,expiresAt:this.now()+LIMIT.consentMs,images};
   this.prepared={public:prepared,token:request.token,connectionId:connection.connectionId,generation};return prepared;
  }finally{this.busy=false;}
 }
 async execute(input:unknown):Promise<ImageAiAnalysis|null>{
  if(this.busy||!exact(input,['preparedId'])||typeof input.preparedId!=='string'||!this.prepared||this.prepared.public.id!==input.preparedId)throw Error('현재 전송본을 먼저 준비해 주세요.');
  const owned=this.prepared,view=owned.public,backend=this.deps.backends[view.provider];
  const validate=()=>{this.check(owned.generation,owned.token);const c=backend.context();if(this.now()>=view.expiresAt||c?.connectionId!==owned.connectionId||!c.models.some(m=>m.id===view.model)||!supportsImage(view.provider,view.model,this.now()))throw Error('전송 승인 또는 연결·모델 상태가 변경되었습니다. 다시 준비해 주세요.');for(const image of view.images)if(createHash('sha256').update(Buffer.from(image.dataUrl.split(',')[1],'base64')).digest('hex')!==image.sha256)throw Error('전송본 무결성을 확인하지 못했습니다.');};
  validate();if((this.attempts.get(owned.token)??0)>=LIMIT.attempts)throw Error('한 이미지 선택의 AI 요청은 최대 3회입니다. 자동 재시도하지 않습니다.');
  this.busy=true;this.controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,timedOut=false;
  try{
   if(!await this.deps.review(view))return null;validate();
   // Consume before first outbound call: replay can never generate another billable request.
   this.prepared=null;this.attempts.set(owned.token,(this.attempts.get(owned.token)??0)+1);
   const prompt=CART_AI_PROMPT+'\nImage/sourceId order: '+JSON.stringify(view.images.map(i=>i.sourceId));
   const outbound=view.images.map(i=>({sourceId:i.sourceId,dataUrl:i.dataUrl}));
   if(Buffer.byteLength(JSON.stringify({prompt,images:outbound}))>LIMIT.requestBytes)throw Error('AI 요청 크기 제한을 초과했습니다.');
   timer=setTimeout(()=>{timedOut=true;this.controller?.abort();},LIMIT.timeoutMs);
   const raw=await backend.generate(owned.connectionId,view.model,prompt,outbound,this.controller.signal);validate();
   let results;try{results=parseImageAiResponse(raw,view.images.map(i=>i.sourceId));}catch{throw new ImageAiFailure('response');}
   return {provider:view.provider,model:view.model,requestId:view.id,transmissions:view.images.map(i=>({sourceId:i.sourceId,sha256:i.sha256})),results};
  }catch(error){
   if(error instanceof ImageAiFailure)throw error;if(timedOut)throw new ImageAiFailure('timeout');if(this.controller?.signal.aborted||owned.generation!==this.generation)throw new ImageAiFailure('cancelled');
   const message=error instanceof Error?error.message:'';
   if(/API Key|다시 인증|인증이|다시 연결/.test(message))throw new ImageAiFailure('auth');
   if(/권한/.test(message))throw new ImageAiFailure('permission');if(/한도|요청 제한/.test(message))throw new ImageAiFailure('limit');
   throw new ImageAiFailure('connection');
  }finally{if(timer)clearTimeout(timer);this.controller=null;this.busy=false;}
 }
 cancel(){this.generation++;this.prepared=null;this.controller?.abort();return null;}
 dispose(){this.cancel();this.attempts.clear();}
}
export function createPurchaseAiHandlers(contents:Parameters<typeof assertSender>[1],url:string,service:PurchaseAiService){
 const wrap=<T>(count:number,work:(input:unknown)=>T|Promise<T>)=>async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<T>>=>{
  try{assertSender(event,contents,url);}catch{return {ok:false,error:{code:'FORBIDDEN',message:'허용하지 않는 이미지 요청입니다.',retryable:false}};}
  if(args.length!==count)return {ok:false,error:{code:'INVALID_INPUT',message:'이미지 요청 인자를 확인해 주세요.',retryable:false}};
  try{return {ok:true,data:await work(args[0])};}catch(error){if(error instanceof ImageAiFailure)return {ok:false,error:{code:'INTERNAL_ERROR',message:error.message,retryable:false}};return {ok:false,error:{code:'INVALID_INPUT',message:'이미지 AI 분석을 완료하지 못했습니다. 연결·모델 권한·전송본·크기·금액 근거를 확인하세요. 취소·시간 초과·API 한도 시 자동 재요청하지 않습니다. 기존 구매 목록과 검토 수정은 유지됩니다.',retryable:false}};}
 };
 return {connections:wrap(0,()=>service.connections()),prepare:wrap(1,input=>service.prepare(input)),execute:wrap(1,input=>service.execute(input)),cancel:wrap(0,()=>service.cancel())};
}
