import {createHash} from 'node:crypto'
import {z} from 'zod'
import {getNewsletterModelCapability} from './newsletter-ai-capabilities.js'
import {AI_ERROR,AiError,type AiFetch} from './ai-network.js'
import {
  NEWSLETTER_AI_MEDIA_LIMITS,
  newsletterAiBaselineSchema,
  parseNewsletterAiImageCandidate,
  type NewsletterAiImageCandidate,
} from '../newsletter-ai-protocol.js'
import type {AiProvider} from '../protocol.js'

const sha256=z.string().regex(/^[a-f0-9]{64}$/)
const referenceSchema=z.object({
  name:z.string().trim().min(1).max(255).refine(name=>!/[\\/]/.test(name)),
  sha256,
  byteSize:z.number().int().positive().max(NEWSLETTER_AI_MEDIA_LIMITS.maxBytes),
  purpose:z.string().trim().min(1).max(500),
  mediaType:z.enum(['image/png','image/jpeg','image/webp']),
  bytesBase64:z.string().min(1),
}).strict().readonly()
const requestSchema=z.object({
  baseline:newsletterAiBaselineSchema,
  requestId:z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
  topicId:z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
  target:z.discriminatedUnion('kind',[z.object({kind:z.literal('cover')}).strict(),z.object({kind:z.literal('topic'),topicId:z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/)}).strict(),z.object({kind:z.literal('action'),topicId:z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),actionIndex:z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3)])}).strict()]),
  prompt:z.string().trim().min(1).max(20_000),
  references:z.array(referenceSchema).max(8).readonly(),
}).strict().readonly()

export type NewsletterAiImageGenerationRequest=z.infer<typeof requestSchema>
export type NewsletterAiImageConnection=Readonly<{provider:AiProvider;key:string;model:string}>
export type NewsletterAiGeneratedImage=Readonly<{candidate:NewsletterAiImageCandidate;bytesBase64:string}>

export class NewsletterAiImageError extends AiError{
  constructor(message='AI 삽화 응답을 안전하게 확인할 수 없습니다.'){super(message);this.name='NewsletterAiImageError'}
}

const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const sameBytes=(left:Uint8Array,right:readonly number[])=>right.every((value,index)=>left[index]===value)

function decodeReference(reference:z.infer<typeof referenceSchema>):Uint8Array{
  const bytes=Buffer.from(reference.bytesBase64,'base64')
  if(bytes.byteLength!==reference.byteSize||createHash('sha256').update(bytes).digest('hex')!==reference.sha256)throw new NewsletterAiImageError('선택한 참고 이미지가 동의 시점과 일치하지 않습니다.')
  mediaInfo(bytes,reference.mediaType)
  return bytes
}

function jpegDimensions(bytes:Uint8Array):Readonly<{width:number;height:number}>|null{
  let offset=2
  while(offset+9<bytes.byteLength){
    if(bytes[offset]!==0xff)return null
    const marker=bytes[offset+1]
    if(marker===undefined)return null
    if(marker===0xd8||marker===0xd9){offset+=2;continue}
    const size=(bytes[offset+2]??0)*256+(bytes[offset+3]??0)
    if(size<2||offset+2+size>bytes.byteLength)return null
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
      return {height:(bytes[offset+5]??0)*256+(bytes[offset+6]??0),width:(bytes[offset+7]??0)*256+(bytes[offset+8]??0)}
    }
    offset+=2+size
  }
  return null
}

function mediaInfo(bytes:Uint8Array,claimed:string):Readonly<{mediaType:'image/png'|'image/jpeg'|'image/webp';width:number;height:number}>{
  let actual:'image/png'|'image/jpeg'|'image/webp'|null=null
  let width=0,height=0
  if(bytes.byteLength>=24&&sameBytes(bytes,[137,80,78,71,13,10,26,10])){
    actual='image/png';width=Buffer.from(bytes).readUInt32BE(16);height=Buffer.from(bytes).readUInt32BE(20)
  }else if(bytes.byteLength>=11&&sameBytes(bytes,[0xff,0xd8,0xff])){
    actual='image/jpeg';const dimensions=jpegDimensions(bytes);if(dimensions!==null){width=dimensions.width;height=dimensions.height}
  }else if(bytes.byteLength>=25&&Buffer.from(bytes.subarray(0,4)).toString('ascii')==='RIFF'&&Buffer.from(bytes.subarray(8,12)).toString('ascii')==='WEBP'){
    actual='image/webp'
    const chunk=Buffer.from(bytes.subarray(12,16)).toString('ascii')
    if(chunk==='VP8X'&&bytes.byteLength>=30){width=1+(bytes[24]??0)+((bytes[25]??0)<<8)+((bytes[26]??0)<<16);height=1+(bytes[27]??0)+((bytes[28]??0)<<8)+((bytes[29]??0)<<16)}
    else if(chunk==='VP8L'&&bytes[20]===0x2f){width=1+(bytes[21]??0)+(((bytes[22]??0)&0x3f)<<8);height=1+((bytes[22]??0)>>6)+((bytes[23]??0)<<2)+(((bytes[24]??0)&0x0f)<<10)}
    else if(chunk==='VP8 '&&bytes.byteLength>=30&&sameBytes(bytes.subarray(23),[0x9d,0x01,0x2a])){width=((bytes[26]??0)+((bytes[27]??0)<<8))&0x3fff;height=((bytes[28]??0)+((bytes[29]??0)<<8))&0x3fff}
  }
  if(actual===null||actual!==claimed||width<1||height<1||width>NEWSLETTER_AI_MEDIA_LIMITS.maxDimension||height>NEWSLETTER_AI_MEDIA_LIMITS.maxDimension)throw new NewsletterAiImageError()
  return {mediaType:actual,width,height}
}

async function boundedJson(fetcher:AiFetch,url:string,connection:NewsletterAiImageConnection,body:unknown,signal:AbortSignal):Promise<unknown>{
  if(signal.aborted)throw new NewsletterAiImageError(AI_ERROR.cancelled)
  let response:Response|undefined
  try{
    response=await fetcher(url,{method:'POST',redirect:'error',credentials:'omit',signal,headers:{Accept:'application/json','Content-Type':'application/json',...(connection.provider==='openai'?{Authorization:`Bearer ${connection.key}`}:{'x-goog-api-key':connection.key})},body:JSON.stringify(body)})
    if(signal.aborted)throw new NewsletterAiImageError(AI_ERROR.cancelled)
    if(!response.ok||response.redirected){await response.body?.cancel();throw new NewsletterAiImageError()}
    if(!response.headers.get('content-type')?.toLowerCase().includes('application/json')||!response.body)throw new NewsletterAiImageError()
    const maxEncoded=Math.ceil(NEWSLETTER_AI_MEDIA_LIMITS.maxBytes*4/3)+2_000_000
    const length=response.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>maxEncoded))throw new NewsletterAiImageError()
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0
    try{while(true){const chunk=await reader.read();if(signal.aborted)throw new NewsletterAiImageError(AI_ERROR.cancelled);if(chunk.done)break;size+=chunk.value.byteLength;if(size>maxEncoded)throw new NewsletterAiImageError();chunks.push(chunk.value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))
  }catch(error){if(error instanceof NewsletterAiImageError)throw error;throw new NewsletterAiImageError(signal.aborted?AI_ERROR.cancelled:undefined)}
  finally{if(response?.body&&!response.body.locked)await response.body.cancel().catch(()=>{})}
}

function outbound(connection:NewsletterAiImageConnection,request:NewsletterAiImageGenerationRequest,referenceBytes:readonly Uint8Array[]):Readonly<{url:string;body:unknown}>{
  const prompt=`학교 보건교육용 삽화만 생성하세요. 이미지 안에 제목·본문·한글 문장을 넣지 마세요. ${request.prompt}`
  if(connection.provider==='openai'&&referenceBytes.length===0)return {url:'https://api.openai.com/v1/images/generations',body:{model:connection.model,prompt,response_format:'b64_json'}}
  if(connection.provider==='openai')return {url:'https://api.openai.com/v1/responses',body:{model:connection.model,input:[{role:'user',content:[{type:'input_text',text:prompt},...referenceBytes.map((bytes,index)=>({type:'input_image',image_url:`data:${request.references[index]?.mediaType};base64,${Buffer.from(bytes).toString('base64')}`}))]}],tools:[{type:'image_generation'}]}}
  return {url:`https://generativelanguage.googleapis.com/v1beta/models/${connection.model}:generateContent`,body:{contents:[{parts:[{text:prompt},...referenceBytes.map((bytes,index)=>({inlineData:{mimeType:request.references[index]?.mediaType,data:Buffer.from(bytes).toString('base64')}}))]}],generationConfig:{responseModalities:['IMAGE']}}}
}

function extract(provider:AiProvider,value:unknown):Readonly<{mediaType:string;base64:string}>{
  if(!record(value))throw new NewsletterAiImageError()
  if(provider==='openai'){
    if(Array.isArray(value.data)&&value.data.length===1&&record(value.data[0])&&typeof value.data[0].b64_json==='string')return {mediaType:'image/png',base64:value.data[0].b64_json}
    if(Array.isArray(value.output)){const images=value.output.filter(item=>record(item)&&item.type==='image_generation_call'&&typeof item.result==='string');if(images.length===1){const image=images[0];if(record(image)&&typeof image.result==='string')return {mediaType:'image/png',base64:image.result}}
    }
    throw new NewsletterAiImageError()
  }
  if(!Array.isArray(value.candidates)||value.candidates.length!==1)throw new NewsletterAiImageError()
  const candidate=value.candidates[0]
  if(!record(candidate)||candidate.finishReason!=='STOP'||!record(candidate.content)||!Array.isArray(candidate.content.parts))throw new NewsletterAiImageError()
  const images=candidate.content.parts.filter(part=>record(part)&&record(part.inlineData)&&typeof part.inlineData.mimeType==='string'&&typeof part.inlineData.data==='string')
  if(images.length!==1)throw new NewsletterAiImageError()
  const data=images[0]?.inlineData
  if(!record(data)||typeof data.mimeType!=='string'||typeof data.data!=='string')throw new NewsletterAiImageError()
  return {mediaType:data.mimeType,base64:data.data}
}

export async function generateNewsletterImageCandidate(fetcher:AiFetch,connection:NewsletterAiImageConnection,rawRequest:unknown,signal:AbortSignal,now:()=>Date):Promise<NewsletterAiGeneratedImage>{
  const parsed=requestSchema.safeParse(rawRequest);if(!parsed.success)throw new NewsletterAiImageError()
  const request=parsed.data,capability=getNewsletterModelCapability(connection.provider,connection.model).image
  if(!capability.generate||(request.references.length>0&&!capability.referenceInput))throw new NewsletterAiImageError('선택한 모델은 이 이미지 기능을 지원하지 않습니다.')
  let inputBytes=0
  for(const reference of request.references){
    if(reference.byteSize>capability.maxInputBytes-inputBytes)throw new NewsletterAiImageError('선택한 참고 이미지 합계가 모델 입력 한도를 초과합니다.')
    inputBytes+=reference.byteSize
  }
  const references=request.references.map(decodeReference),built=outbound(connection,request,references)
  const result=extract(connection.provider,await boundedJson(fetcher,built.url,connection,built.body,signal))
  if(result.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(result.base64)||result.base64.length>Math.ceil(capability.maxOutputBytes*4/3)+8)throw new NewsletterAiImageError()
  const bytes=Buffer.from(result.base64,'base64');if(bytes.byteLength<1||bytes.byteLength>capability.maxOutputBytes)throw new NewsletterAiImageError()
  const info=mediaInfo(bytes,result.mediaType),outputHash=createHash('sha256').update(bytes).digest('hex'),promptHash=createHash('sha256').update(request.prompt,'utf8').digest('hex')
  const candidate=parseNewsletterAiImageCandidate({schemaVersion:1,candidateId:request.requestId,assetType:'AI_GENERATED',exportApproval:'pending',provider:connection.provider,model:connection.model,mock:false,requestId:request.requestId,createdAt:now().toISOString(),promptHash,inputHashes:request.references.map(reference=>reference.sha256),outputHash,mediaType:info.mediaType,byteSize:bytes.byteLength,width:info.width,height:info.height,baseline:request.baseline,usage:{costStatus:'unknown'}})
  return {candidate,bytesBase64:bytes.toString('base64')}
}
