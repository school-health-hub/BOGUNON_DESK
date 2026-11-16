import {createHash} from 'node:crypto'
import {describe,expect,it} from 'vitest'
import {NEWSLETTER_AI_OUTPUT_CONTRACT} from '../newsletter-ai-protocol'
import {
  NewsletterAiMockConfigurationError,
  createNewsletterAiMockProvider,
  type NewsletterAiMockMode,
} from '../main/newsletter-ai-mock'

const hash=(character:string)=>character.repeat(64)
const baseline={projectId:'mock-project',projectRevision:2,projectHash:hash('a'),designRevision:4,designHash:hash('b')}
const textRequest={baseline,month:11,schoolType:'coeducational' as const,requestId:'mock-request',requestFingerprint:hash('c')}
const imageRequest={baseline,requestId:'mock-image-request',requestFingerprint:hash('d'),topicId:'topic-1'}

describe('deterministic offline Newsletter AI provider',()=>{
  it('regenerates one deterministic topic without producing a six-topic replacement',async()=>{
    const provider=createNewsletterAiMockProvider({environment:'test',seed:'fixture-seed'})
    const input={...textRequest,proposalId:'proposal-1',targetTopicId:'topic-3',proposalHash:hash('d'),topicHash:hash('e')}
    const first=await provider.regenerateTopic(input),second=await provider.regenerateTopic(input)
    expect(first).toEqual(second)
    expect(first.kind).toBe('success')
    if(first.kind==='success'){
      expect(first.regeneration).toMatchObject({kind:'topic-regeneration',targetTopicId:'topic-3',topic:{id:'topic-3'}})
      expect(first.regeneration.topic.actions).toHaveLength(4)
    }
  })
  it('returns byte-identical six-topic proposals for the same seed and request fingerprint',async()=>{
    // Given
    const first=createNewsletterAiMockProvider({environment:'test',seed:'fixture-seed'})
    const second=createNewsletterAiMockProvider({environment:'test',seed:'fixture-seed'})
    // When
    const [left,right]=await Promise.all([first.generateText(textRequest),second.generateText(textRequest)])
    // Then
    expect(left).toEqual(right)
    expect(left.kind).toBe('success')
    if(left.kind==='success'){
      expect(left.proposal.topics).toHaveLength(NEWSLETTER_AI_OUTPUT_CONTRACT.topicCount)
      expect(left.proposal.topics.every(topic=>topic.actions.length===NEWSLETTER_AI_OUTPUT_CONTRACT.actionsPerTopic)).toBe(true)
      expect(left.proposal).toMatchObject({provider:'mock',model:'newsletter-offline-v1',mock:true,usage:{costStatus:'unknown'}})
    }
  })

  it('returns byte-identical valid PNG candidates and hashes for the same input',async()=>{
    // Given
    const provider=createNewsletterAiMockProvider({environment:'qa',seed:'image-seed'})
    // When
    const first=await provider.generateImage(imageRequest)
    const second=await provider.generateImage(imageRequest)
    // Then
    expect(first).toEqual(second)
    expect(first.kind).toBe('success')
    if(first.kind==='success'){
      expect([...first.bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10])
      expect(createHash('sha256').update(first.bytes).digest('hex')).toBe(first.candidate.outputHash)
      expect(first.candidate).toMatchObject({provider:'mock',mock:true,assetType:'AI_GENERATED',exportApproval:'pending',mediaType:'image/png'})
    }
  })

  it.each([
    ['timeout','timeout'],
    ['malformed','invalid-response'],
    ['unsupported','unsupported'],
    ['provider-error','provider-error'],
  ] satisfies ReadonlyArray<readonly [NewsletterAiMockMode,string]>)('returns deterministic %s text failure without a proposal',async(mode,status)=>{
    const provider=createNewsletterAiMockProvider({environment:'test',seed:'failure-seed'})
    const result=await provider.generateText(textRequest,mode)
    expect(result).toMatchObject({kind:'failure',failure:{status,transmissionStarted:false,retryAllowed:false}})
  })

  it.each([
    ['oversize','invalid-response'],
    ['bad-mime','invalid-response'],
    ['timeout','timeout'],
    ['unsupported','unsupported'],
    ['provider-error','provider-error'],
  ] satisfies ReadonlyArray<readonly [NewsletterAiMockMode,string]>)('rejects deterministic %s image output without candidate bytes',async(mode,status)=>{
    const provider=createNewsletterAiMockProvider({environment:'test',seed:'image-failure-seed'})
    const result=await provider.generateImage(imageRequest,mode)
    expect(result).toMatchObject({kind:'failure',failure:{status,transmissionStarted:false,retryAllowed:false}})
    if(result.kind==='failure')expect('bytes' in result).toBe(false)
  })

  it('distinguishes cancellation before and after local generation',async()=>{
    const provider=createNewsletterAiMockProvider({environment:'test',seed:'cancel-seed'})
    const controller=new AbortController()
    controller.abort()
    const before=await provider.generateText({...textRequest,signal:controller.signal})
    const after=await provider.generateImage(imageRequest,'cancel-after')
    expect(before).toMatchObject({kind:'failure',failure:{status:'cancelled',transmissionStarted:false}})
    expect(after).toMatchObject({kind:'failure',failure:{status:'cancelled',transmissionStarted:false}})
  })

  it('rejects construction in production so the mock cannot appear as a live provider',()=>{
    expect(()=>createNewsletterAiMockProvider({environment:'production',seed:'forbidden'})).toThrow(NewsletterAiMockConfigurationError)
  })
})
