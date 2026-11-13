import {describe,expect,it,vi} from 'vitest'
import {AI_ERROR,AiError} from '../main/ai-network'
import {
  NewsletterAiConsentPolicy,
  NewsletterAiConsentPolicyError,
  formatNewsletterAiConsentDetail,
  type NewsletterAiConsentReview,
} from '../main/newsletter-ai-consent'

const hash=(character:string)=>character.repeat(64)
const files=[{name:'참고자료.png',sha256:hash('a'),byteSize:321,purpose:'삽화 참고'}] as const

const setup=(decision:NewsletterAiConsentReview='approved')=>{
  const review=vi.fn(async()=>decision)
  const requestIds=['request-one','request-two','request-three'][Symbol.iterator]()
  const policy=new NewsletterAiConsentPolicy({
    review,
    nextRequestId:()=>requestIds.next().value ?? 'request-fallback',
    now:()=>new Date('2026-11-13T01:02:03.000Z'),
  })
  return {policy,review}
}

const request=(overrides:Readonly<Record<string,unknown>>={})=>({
  operation:'generate-image',
  provider:'openai',
  model:'gpt-image-1',
  mock:false,
  files,
  externalDataCategories:['사용자가 선택한 참고 이미지'],
  cost:{status:'unknown'},
  privacyReviewText:'개인정보가 없는 합성 보건교육 자료',
  ...overrides,
})

describe('NewsletterAiConsentPolicy',()=>{
  it('calls the provider only after exact-file approval',async()=>{
    // Given
    const {policy,review}=setup()
    const prepared=policy.prepare(request())
    const send=vi.fn(async()=>({ok:true as const}))
    expect(send).not.toHaveBeenCalled()

    // When
    const result=await policy.execute(prepared.requestId,files,send)

    // Then
    expect(result).toEqual({status:'completed',value:{ok:true}})
    expect(review).toHaveBeenCalledWith(expect.objectContaining({
      requestId:'request-one',
      files,
      totalByteSize:321,
      cost:{status:'unknown'},
      noRecallAfterTransmission:true,
      externalDataCategories:['사용자가 선택한 참고 이미지'],
    }))
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('formats only the safe manifest details required for native review',()=>{
    // Given
    const prepared=setup().policy.prepare(request())

    // When
    const detail=formatNewsletterAiConsentDetail(prepared)

    // Then
    expect(detail).toContain('참고자료.png · 321 bytes · '+hash('a'))
    expect(detail).toContain('비용: 알 수 없음')
    expect(detail).toContain('전송 후에는 이미 전송된 자료를 회수할 수 없습니다.')
    expect(detail).not.toContain('개인정보가 없는 합성 보건교육 자료')
  })

  it.each([
    ['generate-text',[]],
    ['generate-image',[]],
  ] as const)('reviews %s requests with no reference files',async(operation,emptyFiles)=>{
    // Given
    const {policy,review}=setup()
    const prepared=policy.prepare(request({operation,files:emptyFiles}))

    // When
    await policy.execute(prepared.requestId,emptyFiles,async()=>({ok:true as const}))

    // Then
    expect(review).toHaveBeenCalledWith(expect.objectContaining({operation,files:[],totalByteSize:0}))
  })

  it('keeps decline distinct and never calls the provider',async()=>{
    // Given
    const {policy}=setup('declined')
    const prepared=policy.prepare(request())
    const send=vi.fn(async()=>({ok:true as const}))

    // When
    const result=await policy.execute(prepared.requestId,files,send)

    // Then
    expect(result).toEqual({status:'declined',transmissionStarted:false})
    expect(send).not.toHaveBeenCalled()
  })

  it('invalidates consent when an exact file hash changes',async()=>{
    // Given
    const {policy,review}=setup()
    const prepared=policy.prepare(request())
    const changed=[{...files[0],sha256:hash('b')}]
    const send=vi.fn(async()=>({ok:true as const}))

    // When / Then
    await expect(policy.execute(prepared.requestId,changed,send)).rejects.toMatchObject({code:'source-changed'})
    expect(review).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('blocks personal health data before consent without echoing it',()=>{
    // Given
    const {policy,review}=setup()
    const secret='학생명 홍길동 질병: 결핵 API_KEY=do-not-echo'

    // When / Then
    expect(()=>policy.prepare(request({privacyReviewText:secret}))).toThrow(NewsletterAiConsentPolicyError)
    try{policy.prepare(request({privacyReviewText:secret}))}catch(error){
      expect(error).toMatchObject({code:'privacy-blocked'})
      expect(String(error)).not.toContain('홍길동')
      expect(String(error)).not.toContain('do-not-echo')
    }
    expect(review).not.toHaveBeenCalled()
  })

  it('reports cancellation before and after transmission separately',async()=>{
    // Given: cancellation before execution
    const before=setup().policy
    const beforePrepared=before.prepare(request())

    // When
    const beforeResult=before.cancel(beforePrepared.requestId)

    // Then
    expect(beforeResult).toEqual({status:'cancelled',transmissionStarted:false})

    // Given: cancellation after transmission
    const after=setup().policy
    const afterPrepared=after.prepare(request())
    let release:((value:string)=>void)|undefined
    const send=vi.fn((_signal:AbortSignal)=>new Promise<string>(resolve=>{release=resolve}))
    const pending=after.execute(afterPrepared.requestId,files,send)
    await vi.waitFor(()=>expect(send).toHaveBeenCalledOnce())

    // When
    const afterResult=after.cancel(afterPrepared.requestId)
    release?.('late response')

    // Then
    expect(afterResult).toEqual({status:'cancelled',transmissionStarted:true})
    await expect(pending).resolves.toEqual({status:'cancelled',transmissionStarted:true})
  })

  it('retries only after explicit action with a new request and renewed consent',async()=>{
    // Given
    const {policy,review}=setup()
    const first=policy.prepare(request())
    const failedSend=vi.fn(async()=>{throw new Error('provider secret diagnostics')})
    await expect(policy.execute(first.requestId,files,failedSend)).rejects.toMatchObject({code:'provider-error'})

    // When
    const second=policy.retry({failedRequestId:first.requestId,userInitiated:true})
    const successSend=vi.fn(async()=>({ok:true as const}))
    await policy.execute(second.requestId,files,successSend)

    // Then
    expect(second.requestId).toBe('request-two')
    expect(second.provider).toBe(first.provider)
    expect(second.model).toBe(first.model)
    expect(review).toHaveBeenCalledTimes(2)
    expect(failedSend).toHaveBeenCalledOnce()
    expect(successSend).toHaveBeenCalledOnce()
  })

  it('rejects automatic retry, fake zero cost, paths, and provider changes',()=>{
    // Given
    const {policy}=setup()
    const prepared=policy.prepare(request())

    // When / Then
    expect(()=>policy.retry({failedRequestId:prepared.requestId,userInitiated:false})).toThrow(NewsletterAiConsentPolicyError)
    expect(()=>policy.prepare(request({cost:{status:'unknown',amount:0,currency:'KRW'}}))).toThrow(NewsletterAiConsentPolicyError)
    expect(()=>policy.prepare(request({files:[{...files[0],name:'C:\\private\\student.png'}]}))).toThrow(NewsletterAiConsentPolicyError)
    expect(()=>policy.retry({failedRequestId:prepared.requestId,userInitiated:true,provider:'gemini'})).toThrow(NewsletterAiConsentPolicyError)
  })

  it.each([
    [AI_ERROR.timeout,'timeout'],
    [AI_ERROR.limit,'rate-limited'],
    [AI_ERROR.cancelled,'cancelled'],
  ] as const)('preserves safe error category %s without provider diagnostics',async(message,code)=>{
    // Given
    const {policy}=setup()
    const prepared=policy.prepare(request())

    // When / Then
    await expect(policy.execute(prepared.requestId,files,async()=>{throw new AiError(message)})).rejects.toMatchObject({code})
  })

  it('expires terminal failures while preserving a bounded explicit-retry window',async()=>{
    // Given
    let now=Date.parse('2026-11-13T01:02:03.000Z')
    let sequence=0
    const policy=new NewsletterAiConsentPolicy({
      review:async()=> 'approved',
      nextRequestId:()=>`request-${++sequence}`,
      now:()=>new Date(now),
    })
    const failed=policy.prepare(request())
    await expect(policy.execute(failed.requestId,files,async()=>{throw new AiError(AI_ERROR.limit)})).rejects.toMatchObject({code:'rate-limited'})

    // When
    now+=600_001
    policy.prepare(request())

    // Then
    expect(()=>policy.retry({failedRequestId:failed.requestId,userInitiated:true})).toThrow(NewsletterAiConsentPolicyError)
  })

  it('caps retained terminal requests without removing the newest retryable failure',async()=>{
    // Given
    let sequence=0
    const policy=new NewsletterAiConsentPolicy({
      review:async()=> 'approved',
      nextRequestId:()=>`request-${++sequence}`,
      now:()=>new Date('2026-11-13T01:02:03.000Z'),
    })
    const failedIds:string[]=[]
    for(let index=0;index<65;index++){
      const prepared=policy.prepare(request())
      failedIds.push(prepared.requestId)
      await expect(policy.execute(prepared.requestId,files,async()=>{throw new AiError(AI_ERROR.limit)})).rejects.toMatchObject({code:'rate-limited'})
    }

    // When / Then
    expect(()=>policy.retry({failedRequestId:failedIds[0]??'',userInitiated:true})).toThrow(NewsletterAiConsentPolicyError)
    expect(policy.retry({failedRequestId:failedIds.at(-1)??'',userInitiated:true}).requestId).toBe('request-66')
  })
})
