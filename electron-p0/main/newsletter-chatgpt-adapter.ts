import {createHash} from 'node:crypto'
import {z} from 'zod'
import type {ChatGptStatus} from '../chatgpt-protocol.js'
import {parseNewsletterAiProposal,parseNewsletterAiTopicRegeneration,type NewsletterAiTextResult} from '../newsletter-ai-protocol.js'
import type {NewsletterAiImageRequest,NewsletterAiStatus,NewsletterAiTextRequest} from '../newsletter-ai-bridge.js'
import type {NewsletterAiStoredCandidate} from './newsletter-ai-candidate-store.js'

const topicSchema=z.object({
  id:z.string().min(1),title:z.string().trim().min(1),lead:z.string().trim().min(1),
  actions:z.array(z.string().trim().min(1)).length(4),closing:z.string().trim().min(1),
  sources:z.array(z.object({title:z.string().trim().min(1),publisher:z.string().trim().min(1),url:z.string().url().optional(),sha256:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict()).default([]),
  currentFactReview:z.enum(['verified-source-selected','verification-required']).default('verification-required'),
  visualConcept:z.object({summary:z.string().trim().min(1),containsEditableKoreanText:z.boolean()}).strict().optional(),
}).strict()
const proposalPayloadSchema=z.object({topics:z.array(topicSchema).length(6)}).strict()
const regenerationPayloadSchema=z.object({topic:topicSchema}).strict()

export type NewsletterChatGptService=Readonly<{
  status():Promise<ChatGptStatus>
  generate(request:Readonly<{tool:'newsletter';prompt:string}>):Promise<Readonly<{text:string}>|null>
  cancel():unknown
}>

const statusReason=(status:ChatGptStatus):string=>{
  if(!status.supported)return '이 Windows 실행본은 ChatGPT 계정 연결을 지원하지 않습니다.'
  if(status.phase==='permission-required')return 'ChatGPT 계정의 요금제 사용 권한을 확인해 주세요.'
  if(status.phase==='usage-limit')return 'ChatGPT 계정 사용 한도에 도달했습니다.'
  if(status.phase==='reauthentication-required')return 'ChatGPT 계정을 다시 인증해 주세요.'
  if(status.model===null)return 'ChatGPT 계정 모델을 조회하고 선택해 주세요.'
  return 'ChatGPT 계정 연결과 모델 상태를 확인해 주세요.'
}

const promptFor=(request:NewsletterAiTextRequest):string=>{
  const contract='JSON만 응답하세요. 주제는 정확히 6개, 각 actions는 정확히 4개여야 합니다. 원문에 없는 건강 사실은 만들지 말고 currentFactReview를 verification-required로 설정하세요.'
  if(request.regenerate!==undefined)return `${contract}\n한 주제만 {"topic":...} 형식으로 다시 작성하세요. topic.id는 반드시 ${request.regenerate.targetTopicId} 이어야 합니다.\n${request.month}월 · ${request.schoolType}\n요청: ${request.brief}`
  return `${contract}\n{"topics":[...]} 형식을 사용하세요. 각 topic 필드: id, title, lead, actions, closing, sources, currentFactReview, 선택적 visualConcept.\n${request.month}월 · ${request.schoolType}\n요청: ${request.brief}`
}

const parseJson=(text:string):unknown=>{
  try{return JSON.parse(text)}catch{throw new Error('ChatGPT 원고 응답이 구조화 계약과 일치하지 않습니다.')}
}

export class NewsletterChatGptAdapter{
  constructor(private readonly service:NewsletterChatGptService){}
  async status():Promise<NewsletterAiStatus>{
    const account=await this.service.status(),available=account.phase==='ready'&&account.planUsageEnabled&&account.model!==null&&account.models.some(model=>model.id===account.model)
    return {connected:available,provider:'chatgpt',textModel:account.model,imageModel:null,textAvailable:available,imageAvailable:false,textUnavailableReason:available?null:statusReason(account),imageUnavailableReason:'ChatGPT 계정 연결의 바이너리 이미지 생성 권한은 공식적으로 확인되지 않았습니다.',selectedConnection:'chatgpt',connections:[{kind:'chatgpt',label:'ChatGPT 계정',configured:account.accountId!==null,textAvailable:available,imageAvailable:false,actualTextCallVerified:account.textCallVerified,actualImageCallVerified:false,costStatus:'unknown',detail:account.notice}]}
  }
  async proposeText(request:NewsletterAiTextRequest):Promise<NewsletterAiTextResult>{
    const account=await this.service.status()
    if(account.phase!=='ready'||!account.planUsageEnabled||account.model===null||!account.models.some(model=>model.id===account.model))throw new Error(statusReason(account))
    const prompt=promptFor(request),result=await this.service.generate({tool:'newsletter',prompt})
    if(result===null)throw new Error('ChatGPT 외부 전송이 취소되었습니다.')
    const promptHash=createHash('sha256').update(prompt,'utf8').digest('hex')
    if(request.regenerate!==undefined){
      const parsed=regenerationPayloadSchema.parse(parseJson(result.text)),topic={...parsed.topic,id:request.regenerate.targetTopicId,currentFactReview:'verification-required' as const}
      return parseNewsletterAiTopicRegeneration({schemaVersion:1,kind:'topic-regeneration',...request.regenerate,provider:'chatgpt',model:account.model,mock:false,baseline:request.baseline,topic,requestId:request.requestId,promptHash,usage:{costStatus:'unknown'}})
    }
    const parsed=proposalPayloadSchema.parse(parseJson(result.text))
    return parseNewsletterAiProposal({schemaVersion:1,proposalId:request.requestId,provider:'chatgpt',model:account.model,mock:false,month:request.month,schoolType:request.schoolType,baseline:request.baseline,topics:parsed.topics.map(topic=>({...topic,currentFactReview:'verification-required' as const})),requestId:request.requestId,promptHash,usage:{costStatus:'unknown'}})
  }
  async generateImageCandidate(_request:NewsletterAiImageRequest,_references:readonly NewsletterAiStoredCandidate[]):Promise<never>{throw new Error('ChatGPT 계정 연결의 이미지 생성은 지원이 확인되지 않았습니다.')}
  async cancel():Promise<void>{this.service.cancel()}
}
