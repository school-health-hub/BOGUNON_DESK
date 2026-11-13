import {createHash} from 'node:crypto'
import {
  parseNewsletterAiImageCandidate,
  parseNewsletterAiProposal,
  parseNewsletterAiTopicRegeneration,
  type NewsletterAiBaseline,
  type NewsletterAiImageCandidate,
  type NewsletterAiProposal,
  type NewsletterAiTopicRegeneration,
} from '../newsletter-ai-protocol.js'

export const NEWSLETTER_AI_MOCK_MODEL='newsletter-offline-v1' as const

export type NewsletterAiMockMode=
  |'success'
  |'cancel-after'
  |'timeout'
  |'malformed'
  |'oversize'
  |'bad-mime'
  |'unsupported'
  |'provider-error'

type MockEnvironment='test'|'qa'|'production'
type FailureStatus='cancelled'|'timeout'|'provider-error'|'invalid-response'|'unsupported'
type MockFailure={
  readonly kind:'failure'
  readonly failure:{
    readonly status:FailureStatus
    readonly safeMessage:string
    readonly transmissionStarted:false
    readonly retryAllowed:false
  }
}
type TextSuccess={readonly kind:'success';readonly proposal:NewsletterAiProposal}
type TopicSuccess={readonly kind:'success';readonly regeneration:NewsletterAiTopicRegeneration}
type ImageSuccess={readonly kind:'success';readonly candidate:NewsletterAiImageCandidate;readonly bytes:Uint8Array}

export type NewsletterAiMockTextRequest={
  readonly baseline:NewsletterAiBaseline
  readonly month:number
  readonly schoolType:'girls'|'boys'|'coeducational'
  readonly requestId:string
  readonly requestFingerprint:string
  readonly signal?:AbortSignal
}
export type NewsletterAiMockImageRequest={
  readonly baseline:NewsletterAiBaseline
  readonly requestId:string
  readonly requestFingerprint:string
  readonly topicId:string
  readonly signal?:AbortSignal
}
export type NewsletterAiMockTopicRequest=NewsletterAiMockTextRequest&Readonly<{proposalId:string;targetTopicId:string;proposalHash:string;topicHash:string}>

export interface NewsletterAiMockProvider{
  generateText(request:NewsletterAiMockTextRequest,mode?:NewsletterAiMockMode):Promise<TextSuccess|MockFailure>
  regenerateTopic(request:NewsletterAiMockTopicRequest,mode?:NewsletterAiMockMode):Promise<TopicSuccess|MockFailure>
  generateImage(request:NewsletterAiMockImageRequest,mode?:NewsletterAiMockMode):Promise<ImageSuccess|MockFailure>
}

export class NewsletterAiMockConfigurationError extends Error{
  constructor(){super('오프라인 Mock 공급자는 테스트 또는 QA 환경에서만 사용할 수 있습니다.');this.name='NewsletterAiMockConfigurationError'}
}

const pngBytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kZkAAAAASUVORK5CYII=','base64'))
const outputHash=createHash('sha256').update(pngBytes).digest('hex')
const fixedCreatedAt='2026-11-13T00:00:00.000Z'

const digest=(...parts:readonly string[])=>createHash('sha256').update(parts.join('\u0000'),'utf8').digest('hex')
const identifier=(...parts:readonly string[])=>`mock-${digest(...parts).slice(0,24)}`

const failure=(status:FailureStatus):MockFailure=>({
  kind:'failure',
  failure:{
    status,
    safeMessage:status==='cancelled'?'Mock 생성이 취소되었습니다.':`Mock ${status} 시나리오입니다.`,
    transmissionStarted:false,
    retryAllowed:false,
  },
})

const statusForMode=(mode:Exclude<NewsletterAiMockMode,'success'>):FailureStatus=>{
  switch(mode){
    case 'cancel-after':return 'cancelled'
    case 'timeout':return 'timeout'
    case 'malformed':
    case 'oversize':
    case 'bad-mime':return 'invalid-response'
    case 'unsupported':return 'unsupported'
    case 'provider-error':return 'provider-error'
  }
}

const failureFor=(signal:AbortSignal|undefined,mode:NewsletterAiMockMode):MockFailure|undefined=>{
  if(signal?.aborted===true)return failure('cancelled')
  return mode==='success'?undefined:failure(statusForMode(mode))
}

const createTopics=(seed:string,fingerprint:string)=>Array.from({length:6},(_,topicIndex)=>{
  const number=topicIndex+1
  const receipt=digest(seed,fingerprint,String(number)).slice(0,8)
  return {
    id:`topic-${number}-${receipt}`,
    title:`Mock 건강 주제 ${number}`,
    lead:`오프라인 검증용 안내 ${number}`,
    actions:Array.from({length:4},(_,actionIndex)=>`${number}-${actionIndex+1} 검증 수칙`),
    closing:`Mock 마무리 ${number}`,
    sources:[],
    currentFactReview:'verification-required' as const,
    visualConcept:{summary:`Mock 학생 건강 행동 ${number}`,containsEditableKoreanText:false as const},
  }
})

export const createNewsletterAiMockProvider=(config:{readonly environment:MockEnvironment;readonly seed:string}):NewsletterAiMockProvider=>{
  if(config.environment==='production')throw new NewsletterAiMockConfigurationError()
  return {
    async generateText(request,mode='success'){
      const failed=failureFor(request.signal,mode)
      if(failed!==undefined)return failed
      const proposal=parseNewsletterAiProposal({
        schemaVersion:1,
        proposalId:identifier(config.seed,request.requestFingerprint,'proposal'),
        provider:'mock',
        model:NEWSLETTER_AI_MOCK_MODEL,
        mock:true,
        month:request.month,
        schoolType:request.schoolType,
        baseline:request.baseline,
        topics:createTopics(config.seed,request.requestFingerprint),
        requestId:request.requestId,
        promptHash:request.requestFingerprint,
        usage:{costStatus:'unknown'},
      })
      return {kind:'success',proposal}
    },
    async regenerateTopic(request,mode='success'){
      const failed=failureFor(request.signal,mode)
      if(failed!==undefined)return failed
      const topic={...createTopics(config.seed,request.requestFingerprint)[0],id:request.targetTopicId}
      const regeneration=parseNewsletterAiTopicRegeneration({schemaVersion:1,kind:'topic-regeneration',proposalId:request.proposalId,targetTopicId:request.targetTopicId,proposalHash:request.proposalHash,topicHash:request.topicHash,provider:'mock',model:NEWSLETTER_AI_MOCK_MODEL,mock:true,baseline:request.baseline,topic,requestId:request.requestId,promptHash:request.requestFingerprint,usage:{costStatus:'unknown'}})
      return {kind:'success',regeneration}
    },
    async generateImage(request,mode='success'){
      const failed=failureFor(request.signal,mode)
      if(failed!==undefined)return failed
      const candidate=parseNewsletterAiImageCandidate({
        schemaVersion:1,
        candidateId:identifier(config.seed,request.requestFingerprint,request.topicId,'image'),
        assetType:'AI_GENERATED',
        exportApproval:'pending',
        provider:'mock',
        model:NEWSLETTER_AI_MOCK_MODEL,
        mock:true,
        requestId:request.requestId,
        createdAt:fixedCreatedAt,
        promptHash:request.requestFingerprint,
        inputHashes:[],
        outputHash,
        mediaType:'image/png',
        byteSize:pngBytes.byteLength,
        width:1,
        height:1,
        baseline:request.baseline,
        usage:{costStatus:'unknown'},
      })
      return {kind:'success',candidate,bytes:pngBytes.slice()}
    },
  }
}
