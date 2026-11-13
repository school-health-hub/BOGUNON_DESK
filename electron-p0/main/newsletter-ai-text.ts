import {createHash} from 'node:crypto'
import {z} from 'zod'
import {
  NEWSLETTER_AI_OUTPUT_CONTRACT,
  newsletterAiBaselineSchema,
  parseNewsletterAiProposal,
  parseNewsletterAiTopicRegeneration,
  type NewsletterAiProposal,
  type NewsletterAiTopicRegeneration,
} from '../newsletter-ai-protocol.js'
import type {AiProvider} from '../protocol.js'
import {AI_ERROR,AiError,aiJson,type AiFetch,validModel} from './ai-network.js'
import {inspectOfficialDocumentPrivacy} from './ai-privacy.js'

const requestSchema=z.object({
  month:z.number().int().min(1).max(12),
  schoolType:z.enum(['girls','boys','coeducational']),
  baseline:newsletterAiBaselineSchema,
  requestId:z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
  brief:z.string().trim().min(1).max(20_000).refine(value=>Buffer.byteLength(value)<=65_536),
  regenerate:z.object({proposalId:z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),targetTopicId:z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),proposalHash:z.string().regex(/^[a-f0-9]{64}$/),topicHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict().readonly().optional(),
}).strict().readonly()

export type NewsletterAiTextRequest=z.infer<typeof requestSchema>
export type NewsletterAiTextConnection=Readonly<{provider:AiProvider;key:string;model:string}>
export type NewsletterStructuredRequest=Readonly<{url:string;body:Readonly<Record<string,unknown>>}>

export class NewsletterAiTextError extends AiError{
  constructor(){super('AI 원고 응답이 보건소식지 계약과 일치하지 않습니다.');this.name='NewsletterAiTextError'}
}

const topicJsonSchema={
  type:'object',
  additionalProperties:false,
  required:['id','title','lead','actions','closing','sources','currentFactReview'],
  properties:{
    id:{type:'string'},title:{type:'string'},lead:{type:'string'},
    actions:{type:'array',minItems:NEWSLETTER_AI_OUTPUT_CONTRACT.actionsPerTopic,maxItems:NEWSLETTER_AI_OUTPUT_CONTRACT.actionsPerTopic,items:{type:'string'}},
    closing:{type:'string'},
    sources:{type:'array',items:{type:'object',additionalProperties:false,required:['title','publisher'],properties:{title:{type:'string'},publisher:{type:'string'},url:{type:'string'},sha256:{type:'string'}}}},
    currentFactReview:{type:'string',enum:['verified-source-selected','verification-required']},
  },
} as const

const outputJsonSchema={
  type:'object',additionalProperties:false,required:['topics'],
  properties:{topics:{type:'array',minItems:NEWSLETTER_AI_OUTPUT_CONTRACT.topicCount,maxItems:NEWSLETTER_AI_OUTPUT_CONTRACT.topicCount,items:topicJsonSchema}},
} as const

export function parseNewsletterAiTextRequest(value:unknown):NewsletterAiTextRequest{
  const result=requestSchema.safeParse(value)
  if(!result.success)throw new NewsletterAiTextError()
  return result.data
}

export function buildNewsletterStructuredRequest(provider:AiProvider,model:string,input:NewsletterAiTextRequest):NewsletterStructuredRequest{
  if(!validModel(model))throw new NewsletterAiTextError()
  const instruction=input.regenerate===undefined
    ? `${input.month}월 학교 보건소식지 후보를 생성하세요. 학교 유형: ${input.schoolType}. 정확히 6개 주제와 주제별 행동 수칙 4개를 작성하고, 선택한 검증 자료가 없는 최신 건강 사실은 verification-required로 표시하세요. 요청: ${input.brief}`
    : `${input.month}월 후보 중 ${input.regenerate.targetTopicId} 한 주제만 다시 작성하세요. 주제 ID를 변경하지 말고 행동 수칙은 정확히 4개로 작성하세요. 요청: ${input.brief}`
  const schema=input.regenerate===undefined?outputJsonSchema:{type:'object',additionalProperties:false,required:['topic'],properties:{topic:topicJsonSchema}}
  if(provider==='openai')return {
    url:'https://api.openai.com/v1/responses',
    body:{model,input:instruction,text:{format:{type:'json_schema',name:input.regenerate===undefined?'newsletter_topics':'newsletter_topic',strict:true,schema}}},
  }
  return {
    url:`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    body:{contents:[{parts:[{text:instruction}]}],generationConfig:{responseMimeType:'application/json',responseSchema:schema}},
  }
}

export async function regenerateNewsletterTopicText(
  fetcher:AiFetch,connection:NewsletterAiTextConnection,rawRequest:unknown,signal:AbortSignal,
):Promise<NewsletterAiTopicRegeneration>{
  const request=parseNewsletterAiTextRequest(rawRequest)
  if(request.regenerate===undefined)throw new NewsletterAiTextError()
  if(signal.aborted)throw new AiError(AI_ERROR.cancelled)
  if(!inspectOfficialDocumentPrivacy(request.brief).isSafe)throw new AiError('개인정보 가능 항목이 있습니다. 제거한 뒤 다시 확인해 주세요.')
  const outbound=buildNewsletterStructuredRequest(connection.provider,connection.model,request)
  const response=await aiJson(fetcher,outbound.url,connection.provider,connection.key,signal,outbound.body)
  const extracted=connection.provider==='openai'?extractOpenAi(response):extractGemini(response)
  if(extracted.text.includes(connection.key))throw new NewsletterAiTextError()
  const parsed=parseJson(extracted.text)
  if(!record(parsed))throw new NewsletterAiTextError()
  const promptHash=createHash('sha256').update(request.brief,'utf8').digest('hex')
  try{
   const candidate=parseNewsletterAiTopicRegeneration({schemaVersion:1,kind:'topic-regeneration',proposalId:request.regenerate.proposalId,targetTopicId:request.regenerate.targetTopicId,proposalHash:request.regenerate.proposalHash,topicHash:request.regenerate.topicHash,provider:connection.provider,model:connection.model,mock:false,baseline:request.baseline,topic:parsed.topic,requestId:request.requestId,promptHash,usage:{costStatus:'unknown',...(extracted.inputTokens===undefined?{}:{inputTokens:extracted.inputTokens}),...(extracted.outputTokens===undefined?{}:{outputTokens:extracted.outputTokens})}})
   return parseNewsletterAiTopicRegeneration({...candidate,topic:{...candidate.topic,currentFactReview:'verification-required'}})
  }catch(error){if(error instanceof Error)throw new NewsletterAiTextError();throw error}
}

type ExtractedText=Readonly<{text:string;inputTokens?:number;outputTokens?:number}>
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)

function extractOpenAi(result:unknown):ExtractedText{
  if(!record(result)||result.status!=='completed'||!Array.isArray(result.output))throw new NewsletterAiTextError()
  const texts=result.output.flatMap(item=>record(item)&&Array.isArray(item.content)?item.content.filter(part=>record(part)&&part.type==='output_text'&&typeof part.text==='string').map(part=>part.text):[])
  if(texts.length!==1)throw new NewsletterAiTextError()
  const usage=record(result.usage)?result.usage:null
  return {text:texts[0],...(typeof usage?.input_tokens==='number'?{inputTokens:usage.input_tokens}:{}),...(typeof usage?.output_tokens==='number'?{outputTokens:usage.output_tokens}:{})}
}

function extractGemini(result:unknown):ExtractedText{
  if(!record(result)||!Array.isArray(result.candidates)||result.candidates.length!==1)throw new NewsletterAiTextError()
  const candidate=result.candidates[0]
  if(!record(candidate)||candidate.finishReason!=='STOP'||!record(candidate.content)||!Array.isArray(candidate.content.parts))throw new NewsletterAiTextError()
  const texts=candidate.content.parts.filter(part=>record(part)&&part.thought!==true&&typeof part.text==='string').map(part=>part.text)
  if(texts.length!==1)throw new NewsletterAiTextError()
  const usage=record(result.usageMetadata)?result.usageMetadata:null
  return {text:texts[0],...(typeof usage?.promptTokenCount==='number'?{inputTokens:usage.promptTokenCount}:{}),...(typeof usage?.candidatesTokenCount==='number'?{outputTokens:usage.candidatesTokenCount}:{})}
}

function parseJson(value:string):unknown{
  try{return JSON.parse(value)}catch(error){if(error instanceof SyntaxError)throw new NewsletterAiTextError();throw error}
}

export async function generateNewsletterTextProposal(
  fetcher:AiFetch,
  connection:NewsletterAiTextConnection,
  rawRequest:unknown,
  signal:AbortSignal,
):Promise<NewsletterAiProposal>{
  if(signal.aborted)throw new AiError(AI_ERROR.cancelled)
  const request=parseNewsletterAiTextRequest(rawRequest)
  if(!inspectOfficialDocumentPrivacy(request.brief).isSafe)throw new AiError('개인정보 가능 항목이 있습니다. 제거한 뒤 다시 확인해 주세요.')
  const outbound=buildNewsletterStructuredRequest(connection.provider,connection.model,request)
  const response=await aiJson(fetcher,outbound.url,connection.provider,connection.key,signal,outbound.body)
  const extracted=connection.provider==='openai'?extractOpenAi(response):extractGemini(response)
  if(extracted.text.includes(connection.key))throw new NewsletterAiTextError()
  const parsed=parseJson(extracted.text)
  if(!record(parsed))throw new NewsletterAiTextError()
  const promptHash=createHash('sha256').update(request.brief,'utf8').digest('hex')
  try{
   const proposal=parseNewsletterAiProposal({
    schemaVersion:1,proposalId:request.requestId,provider:connection.provider,model:connection.model,mock:false,
    month:request.month,schoolType:request.schoolType,baseline:request.baseline,topics:parsed.topics,
    requestId:request.requestId,promptHash,
    usage:{costStatus:'unknown',...(extracted.inputTokens===undefined?{}:{inputTokens:extracted.inputTokens}),...(extracted.outputTokens===undefined?{}:{outputTokens:extracted.outputTokens})},
   })
   // Provider-authored citations are candidates, not proof. A future trusted-source
   // selection must be user-selected and hash-bound before this flag can be elevated.
   return parseNewsletterAiProposal({...proposal,topics:proposal.topics.map(topic=>({...topic,currentFactReview:'verification-required'}))})
  }catch(error){if(error instanceof Error)throw new NewsletterAiTextError();throw error}
}
