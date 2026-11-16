import type {AiModel,AiProvider} from '../protocol.js';
import {getNewsletterModelCapability} from './newsletter-ai-capabilities.js';
// Source: src-tauri/src/{ai.rs,ai_generation.rs}@26fcb929efcdcc5176812372ecf179430a901b15.
// Preserve provider endpoints, Responses/generateContent envelopes and normalized errors.
// Models are discovered for the user's API account instead of trusting legacy static IDs.
export const AI_ERROR={auth:'API Key를 확인해 주세요.',limit:'요청 한도를 확인해 주세요.',timeout:'AI 연결 확인 시간이 초과되었습니다.',connection:'AI 서비스에 연결하지 못했습니다.',cancelled:'AI 요청을 취소했습니다.',invalid:'AI 응답을 확인할 수 없습니다.'} as const;
export class AiError extends Error{}
export type AiFetch=(url:string,init:RequestInit)=>Promise<Response>;
const MAX_RESPONSE=1024*1024;
export const validModel=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
export function allowedAiUrl(value:string){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash)return false;
  if(u.origin==='https://api.openai.com')return ['/v1/models','/v1/responses'].includes(u.pathname)&&u.search==='';
  if(u.origin==='https://generativelanguage.googleapis.com'){
   if(u.pathname==='/v1beta/models')return [...u.searchParams.keys()].every(k=>['pageSize','pageToken'].includes(k))&&u.searchParams.get('pageSize')==='100';
   const match=/^\/v1beta\/models\/([^/]+):generateContent$/.exec(u.pathname);return !!match&&validModel(match[1])&&u.search==='';
  }return false;
 }catch{return false;}
}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export async function aiJson(fetcher:AiFetch,url:string,provider:AiProvider,key:string,signal:AbortSignal,body?:unknown):Promise<unknown>{
 if(!allowedAiUrl(url))throw new AiError(AI_ERROR.connection);
 let response:Response|undefined;
 try{
  response=await fetcher(url,{method:body===undefined?'GET':'POST',redirect:'error',credentials:'omit',signal,headers:{Accept:'application/json',...(provider==='openai'?{Authorization:`Bearer ${key}`}:{'x-goog-api-key':key}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(signal.aborted)throw new AiError(AI_ERROR.cancelled);
  if(!response.ok){await response.body?.cancel();throw new AiError(response.status===401||response.status===403?AI_ERROR.auth:response.status===429?AI_ERROR.limit:AI_ERROR.connection);}
  if(response.redirected||response.url&&!allowedAiUrl(response.url))throw new AiError(AI_ERROR.connection);
  if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new AiError(AI_ERROR.invalid);
  const length=response.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>MAX_RESPONSE))throw new AiError(AI_ERROR.invalid);
  if(!response.body)throw new AiError(AI_ERROR.invalid);
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const chunk=await reader.read();if(signal.aborted)throw new AiError(AI_ERROR.cancelled);if(chunk.done)break;size+=chunk.value.byteLength;if(size>MAX_RESPONSE)throw new AiError(AI_ERROR.invalid);chunks.push(chunk.value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
 }catch(error){if(error instanceof AiError)throw error;throw new AiError(signal.aborted?AI_ERROR.cancelled:AI_ERROR.connection);}
 finally{if(response?.body&&!response.body.locked)await response.body.cancel().catch(()=>{});}
}
export type AiCatalog=Readonly<{models:readonly AiModel[];capabilityModels:readonly AiModel[]}>;
export async function discoverAiCatalog(fetcher:AiFetch,provider:AiProvider,key:string,signal:AbortSignal):Promise<AiCatalog>{
 const models:AiModel[]=[];const capabilityModels:AiModel[]=[];let token='';const seen=new Set<string>();
 for(let page=0;page<3;page++){
  const url=provider==='openai'?'https://api.openai.com/v1/models':`https://generativelanguage.googleapis.com/v1beta/models?pageSize=100${token?`&pageToken=${encodeURIComponent(token)}`:''}`;
  const result=await aiJson(fetcher,url,provider,key,signal);if(!object(result))throw new AiError(AI_ERROR.invalid);
  const values=provider==='openai'?result.data:result.models;if(!Array.isArray(values)||values.length>1000)throw new AiError(AI_ERROR.invalid);
  for(const value of values){if(!object(value))throw new AiError(AI_ERROR.invalid);const id=provider==='openai'?value.id:typeof value.name==='string'?value.name.replace(/^models\//,''):null;
   if(!validModel(id))continue;
   const label=typeof value.displayName==='string'&&value.displayName.length<=200?value.displayName:id;
   const supportsGenerateContent=provider==='openai'||Array.isArray(value.supportedGenerationMethods)&&value.supportedGenerationMethods.includes('generateContent');
   if(!supportsGenerateContent)continue;
   const capability=getNewsletterModelCapability(provider,id);
   if((capability.text.structuredOutput||capability.image.generate)&&!capabilityModels.some(model=>model.id===id))capabilityModels.push({id,label});
   if(provider==='openai'&&(/^(gpt-|o[1-9])/.test(id)&&!/audio|realtime|transcrib|tts|image|embedding|instruct/.test(id))&&!models.some(model=>model.id===id))models.push({id,label});
   if(provider==='gemini'&&!models.some(model=>model.id===id)&&!capability.image.generate)models.push({id,label});
  }
  if(provider==='openai'||!result.nextPageToken)break;
  if(typeof result.nextPageToken!=='string'||result.nextPageToken.length>2048||seen.has(result.nextPageToken)||page===2)throw new AiError(AI_ERROR.invalid);
  token=result.nextPageToken;seen.add(token);
 }
 if(!models.length||models.length>500||capabilityModels.length>500)throw new AiError('이 계정에서 사용할 텍스트 모델을 찾지 못했습니다.');return {models,capabilityModels};
}
export async function discoverAiModels(fetcher:AiFetch,provider:AiProvider,key:string,signal:AbortSignal):Promise<AiModel[]>{return [...(await discoverAiCatalog(fetcher,provider,key,signal)).models];}
export async function generateAiText(fetcher:AiFetch,provider:AiProvider,key:string,model:string,prompt:string,signal:AbortSignal):Promise<string>{
 const url=provider==='openai'?'https://api.openai.com/v1/responses':`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
 // Responses reasoning models can reject temperature. Leave provider default for OpenAI.
 const body=provider==='openai'?{model,input:prompt}:{contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2}};
 const result=await aiJson(fetcher,url,provider,key,signal,body);return extractAiText(provider,result);
}
export function extractAiText(provider:AiProvider,result:unknown):string{
 if(!object(result))throw new AiError(AI_ERROR.invalid);
 let texts:unknown[]=[];
 if(provider==='openai'){
  if(result.error||result.status&&result.status!=='completed'||!Array.isArray(result.output))throw new AiError(AI_ERROR.invalid);
  texts=result.output.flatMap(item=>object(item)&&Array.isArray(item.content)?item.content.filter(part=>object(part)&&part.type==='output_text').map(part=>part.text):[]);
 }else{
  if(!Array.isArray(result.candidates)||result.candidates.length!==1)throw new AiError(AI_ERROR.invalid);
  const candidate=result.candidates[0];if(!object(candidate)||candidate.finishReason!=='STOP'||!object(candidate.content)||!Array.isArray(candidate.content.parts))throw new AiError(AI_ERROR.invalid);
  texts=candidate.content.parts.filter(p=>object(p)&&!p.thought).map(p=>p.text);
 }
 if(!texts.length||texts.some(t=>typeof t!=='string'))throw new AiError(AI_ERROR.invalid);
 const text=texts.join('\n').trim();if(!text||text.length>60000)throw new AiError(AI_ERROR.invalid);return text;
}
