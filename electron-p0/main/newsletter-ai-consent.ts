import {z} from 'zod'
import {inspectOfficialDocumentPrivacy} from './ai-privacy.js'
import {AI_ERROR,AiError} from './ai-network.js'

const TERMINAL_RETENTION_MS=600_000
const MAX_TERMINAL_REQUESTS=64

const sha256=z.string().regex(/^[a-f0-9]{64}$/)
const requestId=z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/)
const providerSchema=z.enum(['openai','gemini','mock'])
const fileSchema=z.object({
  name:z.string().trim().min(1).max(255).refine(name=>!/[\\/]/.test(name),'base name required'),
  sha256,
  byteSize:z.number().int().nonnegative().max(100_000_000),
  purpose:z.string().trim().min(1).max(500),
}).strict().readonly()
const costSchema=z.object({
  status:z.enum(['estimated','reported','unknown']),
  currency:z.string().regex(/^[A-Z]{3}$/).optional(),
  amount:z.number().finite().nonnegative().optional(),
}).strict().superRefine((cost,context)=>{
  if(cost.status==='unknown'&&(cost.currency!==undefined||cost.amount!==undefined)){
    context.addIssue({code:'custom',message:'unknown cost cannot have an amount'})
  }
  if((cost.currency===undefined)!==(cost.amount===undefined)){
    context.addIssue({code:'custom',message:'currency and amount must be paired'})
  }
})
const prepareSchema=z.object({
  operation:z.enum(['generate-text','generate-image','edit-image']),
  provider:providerSchema,
  model:z.string().trim().min(1).max(200),
  mock:z.boolean(),
  files:z.array(fileSchema).max(32).readonly(),
  externalDataCategories:z.array(z.string().trim().min(1).max(200)).max(20).readonly(),
  cost:costSchema,
  privacyReviewText:z.string().max(100_000),
}).strict().readonly()

export type NewsletterAiConsentReview='approved'|'declined'
export type NewsletterAiConsentFile=z.infer<typeof fileSchema>
export type NewsletterAiConsentRequest=z.infer<typeof prepareSchema>
export type NewsletterAiPreparedConsent=Readonly<{
  requestId:string
  operation:z.infer<typeof prepareSchema>['operation']
  provider:z.infer<typeof providerSchema>
  model:string
  mock:boolean
  files:readonly NewsletterAiConsentFile[]
  totalByteSize:number
  externalDataCategories:readonly string[]
  cost:z.infer<typeof costSchema>
  noRecallAfterTransmission:true
  preparedAt:string
}>
type ConsentErrorCode='invalid-input'|'privacy-blocked'|'source-changed'|'invalid-state'|'provider-error'|'timeout'|'rate-limited'|'cancelled'
export type NewsletterAiConsentExecutionResult<T>=Readonly<{status:'completed';value:T}|{status:'declined'|'cancelled';transmissionStarted:boolean}>
type StoredRequest=Readonly<{
  prepared:NewsletterAiPreparedConsent
  state:'prepared'|'transmitting'|'failed'|'cancelled'|'completed'|'declined'
  updatedAtMs:number
  controller?:AbortController
}>

export class NewsletterAiConsentPolicyError extends Error{
  readonly code:ConsentErrorCode
  constructor(code:ConsentErrorCode){
    const messages:Record<ConsentErrorCode,string>={
      'invalid-input':'AI 요청의 안전 조건을 확인할 수 없습니다.',
      'privacy-blocked':'개인정보로 의심되는 내용이 있어 외부 전송을 차단했습니다.',
      'source-changed':'동의한 외부 전송 자료가 변경되었습니다.',
      'invalid-state':'AI 요청 상태를 확인할 수 없습니다.',
      'provider-error':'AI 서비스에 연결하지 못했습니다.',
      timeout:AI_ERROR.timeout,
      'rate-limited':AI_ERROR.limit,
      cancelled:AI_ERROR.cancelled,
    }
    super(messages[code])
    this.name='NewsletterAiConsentPolicyError'
    this.code=code
  }
}

type ConsentPolicyPorts=Readonly<{
  review:(manifest:NewsletterAiPreparedConsent)=>Promise<NewsletterAiConsentReview>
  nextRequestId:()=>string
  now:()=>Date
}>

export function formatNewsletterAiConsentDetail(manifest:NewsletterAiPreparedConsent):string{
  const cost=manifest.cost.status==='unknown'
    ?'알 수 없음'
    :manifest.cost.amount===undefined
      ?manifest.cost.status==='estimated'?'추정값 확인 필요':'보고값 확인 필요'
      :`${manifest.cost.amount} ${manifest.cost.currency}`
  const files=manifest.files.length===0
    ?'선택한 외부 파일 없음'
    :manifest.files.map(file=>`${file.name} · ${file.byteSize} bytes · ${file.sha256}\n용도: ${file.purpose}`).join('\n')
  return [
    `작업: ${manifest.operation}`,
    `공급자·모델: ${manifest.provider} · ${manifest.model}`,
    `실행 유형: ${manifest.mock?'Mock':'외부 AI'}`,
    `외부 전송 범주: ${manifest.externalDataCategories.join(', ')||'없음'}`,
    `파일 합계: ${manifest.totalByteSize} bytes`,
    files,
    `비용: ${cost}`,
    '전송 후에는 이미 전송된 자료를 회수할 수 없습니다.',
  ].join('\n')
}

const sameFiles=(expected:readonly NewsletterAiConsentFile[],current:readonly NewsletterAiConsentFile[])=>
  expected.length===current.length&&expected.every((file,index)=>{
    const candidate=current[index]
    return candidate!==undefined&&candidate.name===file.name&&candidate.sha256===file.sha256&&
      candidate.byteSize===file.byteSize&&candidate.purpose===file.purpose
  })

export class NewsletterAiConsentPolicy{
  readonly #ports:ConsentPolicyPorts
  readonly #requests=new Map<string,StoredRequest>()

  constructor(ports:ConsentPolicyPorts){this.#ports=ports}

  #terminal(state:StoredRequest['state']):boolean{return state==='failed'||state==='cancelled'||state==='completed'||state==='declined'}

  #sweep(nowMs:number):void{
    for(const [id,request] of this.#requests){
      if(this.#terminal(request.state)&&nowMs-request.updatedAtMs>TERMINAL_RETENTION_MS)this.#requests.delete(id)
    }
    const terminal=[...this.#requests.entries()]
      .filter((entry)=>this.#terminal(entry[1].state))
      .sort((left,right)=>left[1].updatedAtMs-right[1].updatedAtMs)
    for(const [id] of terminal.slice(0,Math.max(0,terminal.length-MAX_TERMINAL_REQUESTS)))this.#requests.delete(id)
  }

  #store(prepared:NewsletterAiPreparedConsent,state:StoredRequest['state'],controller?:AbortController):void{
    const nowMs=this.#ports.now().getTime()
    this.#requests.set(prepared.requestId,{prepared,state,updatedAtMs:nowMs,...(controller===undefined?{}:{controller})})
    this.#sweep(nowMs)
  }

  prepare(input:unknown):NewsletterAiPreparedConsent{
    const parsed=prepareSchema.safeParse(input)
    if(!parsed.success)throw new NewsletterAiConsentPolicyError('invalid-input')
    if(!inspectOfficialDocumentPrivacy(parsed.data.privacyReviewText).isSafe){
      throw new NewsletterAiConsentPolicyError('privacy-blocked')
    }
    const now=this.#ports.now()
    this.#sweep(now.getTime())
    const id=this.#ports.nextRequestId()
    if(!requestId.safeParse(id).success||this.#requests.has(id))throw new NewsletterAiConsentPolicyError('invalid-state')
    const prepared:NewsletterAiPreparedConsent={
      requestId:id,
      operation:parsed.data.operation,
      provider:parsed.data.provider,
      model:parsed.data.model,
      mock:parsed.data.mock,
      files:parsed.data.files,
      totalByteSize:parsed.data.files.reduce((total,file)=>total+file.byteSize,0),
      externalDataCategories:parsed.data.externalDataCategories,
      cost:parsed.data.cost,
      noRecallAfterTransmission:true,
      preparedAt:now.toISOString(),
    }
    this.#store(prepared,'prepared')
    return prepared
  }

  async execute<T>(request:string,currentFiles:unknown,send:(signal:AbortSignal)=>Promise<T>):Promise<NewsletterAiConsentExecutionResult<T>>{
    const stored=this.#requests.get(request)
    const parsedFiles=z.array(fileSchema).max(32).readonly().safeParse(currentFiles)
    if(stored===undefined||stored.state!=='prepared')throw new NewsletterAiConsentPolicyError('invalid-state')
    if(!parsedFiles.success||!sameFiles(stored.prepared.files,parsedFiles.data)){
      throw new NewsletterAiConsentPolicyError('source-changed')
    }
    const review=await this.#ports.review(stored.prepared)
    switch(review){
      case 'declined':
        this.#store(stored.prepared,'declined')
        return {status:'declined',transmissionStarted:false}
      case 'approved':
        break
      default: {
        const unreachable:never=review
        throw unreachable
      }
    }
    const controller=new AbortController()
    this.#store(stored.prepared,'transmitting',controller)
    try{
      const value=await send(controller.signal)
      const current=this.#requests.get(request)
      if(current?.state==='cancelled')return {status:'cancelled',transmissionStarted:true}
      this.#store(stored.prepared,'completed')
      return {status:'completed',value}
    }catch(error){
      const current=this.#requests.get(request)
      if(current?.state==='cancelled')return {status:'cancelled',transmissionStarted:true}
      this.#store(stored.prepared,'failed')
      if(error instanceof NewsletterAiConsentPolicyError)throw error
      if(error instanceof AiError){
        if(error.message===AI_ERROR.timeout)throw new NewsletterAiConsentPolicyError('timeout')
        if(error.message===AI_ERROR.limit)throw new NewsletterAiConsentPolicyError('rate-limited')
        if(error.message===AI_ERROR.cancelled)throw new NewsletterAiConsentPolicyError('cancelled')
      }
      throw new NewsletterAiConsentPolicyError('provider-error')
    }
  }

  cancel(request:string):NewsletterAiConsentExecutionResult<never>{
    const stored=this.#requests.get(request)
    if(stored===undefined||!['prepared','transmitting'].includes(stored.state)){
      throw new NewsletterAiConsentPolicyError('invalid-state')
    }
    const transmissionStarted=stored.state==='transmitting'
    stored.controller?.abort()
    this.#store(stored.prepared,'cancelled')
    return {status:'cancelled',transmissionStarted}
  }

  retry(input:Readonly<{failedRequestId:string;userInitiated:boolean;provider?:string}>):NewsletterAiPreparedConsent{
    const stored=this.#requests.get(input.failedRequestId)
    if(stored===undefined||stored.state!=='failed'||!input.userInitiated||
      (input.provider!==undefined&&input.provider!==stored.prepared.provider)){
      throw new NewsletterAiConsentPolicyError('invalid-state')
    }
    return this.prepare({
      operation:stored.prepared.operation,
      provider:stored.prepared.provider,
      model:stored.prepared.model,
      mock:stored.prepared.mock,
      files:stored.prepared.files,
      externalDataCategories:stored.prepared.externalDataCategories,
      cost:stored.prepared.cost,
      privacyReviewText:'재시도 전 개인정보 없음 확인',
    })
  }
}
