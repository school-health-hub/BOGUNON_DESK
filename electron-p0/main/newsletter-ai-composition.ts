import {createHash} from 'node:crypto'
import {NEWSLETTER_AI_MOCK_MODEL,createNewsletterAiMockProvider} from './newsletter-ai-mock.js'
import type {NewsletterAiIpcService} from './newsletter-ai-ipc.js'

type CompositionOptions=Readonly<{
  qaProfile:boolean
  packaged:boolean
  nodeEnv:string|undefined
  mockOptIn:string|undefined
  seed:string
  live:NewsletterAiIpcService
}>

export class NewsletterAiMockActivationError extends Error{
  constructor(){super('Mock 공급자는 격리된 비프로덕션 QA 프로필에서만 사용할 수 있습니다.');this.name='NewsletterAiMockActivationError'}
}

const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex')

export function createNewsletterAiComposition(options:CompositionOptions):NewsletterAiIpcService{
  if(options.mockOptIn!=='1')return options.live
  if(!options.qaProfile||options.packaged||options.nodeEnv==='production')throw new NewsletterAiMockActivationError()
  const mock=createNewsletterAiMockProvider({environment:'qa',seed:options.seed})
  const requests=new Map<string,AbortController>()
  return {
    async status(){return{connected:true,provider:'mock',textModel:NEWSLETTER_AI_MOCK_MODEL,imageModel:NEWSLETTER_AI_MOCK_MODEL,textAvailable:true,imageAvailable:true,textUnavailableReason:null,imageUnavailableReason:null}},
    async proposeText(request){
      const controller=new AbortController();requests.set(request.requestId,controller)
      try{
        const result=request.regenerate===undefined
          ? await mock.generateText({...request,requestFingerprint:fingerprint(request),signal:controller.signal})
          : await mock.regenerateTopic({...request,...request.regenerate,requestFingerprint:fingerprint(request),signal:controller.signal})
        if(result.kind==='failure')throw new NewsletterAiMockActivationError()
        return 'proposal' in result?result.proposal:result.regeneration
      }finally{requests.delete(request.requestId)}
    },
    async generateImageCandidate(request,references){
      if(request.provider!=='mock'||request.model!==NEWSLETTER_AI_MOCK_MODEL||references.length!==0)throw new NewsletterAiMockActivationError()
      const controller=new AbortController();requests.set(request.requestId,controller)
      try{
        const result=await mock.generateImage({baseline:request.baseline,requestId:request.requestId,topicId:request.topicId,requestFingerprint:fingerprint(request),signal:controller.signal})
        if(result.kind==='failure')throw new NewsletterAiMockActivationError()
        return {candidateId:result.candidate.candidateId,baseline:result.candidate.baseline,mediaType:result.candidate.mediaType,bytesBase64:Buffer.from(result.bytes).toString('base64'),sha256:result.candidate.outputHash,width:result.candidate.width,height:result.candidate.height,provenance:result.candidate}
      }finally{requests.delete(request.requestId)}
    },
    async cancel(request){requests.get(request.requestId)?.abort()},
  }
}
