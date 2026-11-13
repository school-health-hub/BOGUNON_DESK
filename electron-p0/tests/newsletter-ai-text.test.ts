import {describe,expect,it,vi} from 'vitest'
import type {AiFetch} from '../main/ai-network'
import {AiService} from '../main/ai-service'
import type {AiCredential,AiVault} from '../main/ai-vault'
import {
  buildNewsletterStructuredRequest,
  generateNewsletterTextProposal,
  regenerateNewsletterTopicText,
  NewsletterAiTextError,
} from '../main/newsletter-ai-text'

const baseline={
  projectId:'project-1',
  projectRevision:1,
  projectHash:'a'.repeat(64),
  designRevision:1,
  designHash:'b'.repeat(64),
} as const

const topics=Array.from({length:6},(_,index)=>({
  id:`topic-${index+1}`,
  title:`주제 ${index+1}`,
  lead:`안내 ${index+1}`,
  actions:Array.from({length:4},(_unused,action)=>`수칙 ${index+1}-${action+1}`),
  closing:`마무리 ${index+1}`,
  sources:[{title:'합성 교육자료',publisher:'합성 기관'}],
  currentFactReview:'verification-required' as const,
}))

const request={
  month:11,
  schoolType:'coeducational' as const,
  baseline,
  requestId:'request-1',
  brief:'11월 합성 보건교육 원고',
}

const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}})

describe('Newsletter structured text adapters',()=>{
  it('builds official structured-output envelopes without embedding credentials',()=>{
    const openai=buildNewsletterStructuredRequest('openai','gpt-5',request)
    const gemini=buildNewsletterStructuredRequest('gemini','gemini-2.5-pro',request)

    expect(openai.url).toBe('https://api.openai.com/v1/responses')
    expect(openai.body).toMatchObject({model:'gpt-5',text:{format:{type:'json_schema',strict:true}}})
    expect(gemini.url).toContain('gemini-2.5-pro:generateContent')
    expect(gemini.body).toMatchObject({generationConfig:{responseMimeType:'application/json',responseSchema:{type:'object'}}})
    expect(JSON.stringify([openai,gemini])).not.toContain('api-key')
  })

  it.each([
    ['openai',{status:'completed',usage:{input_tokens:25,output_tokens:50},output:[{content:[{type:'output_text',text:JSON.stringify({topics})}]}]}],
    ['gemini',{usageMetadata:{promptTokenCount:30,candidatesTokenCount:60},candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({topics})}]}}]}],
  ] as const)('normalizes valid %s output to the same strict proposal contract',async(provider,payload)=>{
    const fetcher=vi.fn<AiFetch>(async()=>response(payload))
    const proposal=await generateNewsletterTextProposal(fetcher,{provider,key:'synthetic-api-key',model:provider==='openai'?'gpt-5':'gemini-2.5-pro'},request,new AbortController().signal)

    expect(proposal.topics).toEqual(topics)
    expect(proposal).toMatchObject({provider,model:provider==='openai'?'gpt-5':'gemini-2.5-pro',mock:false,month:11,schoolType:'coeducational',baseline,requestId:'request-1',usage:{costStatus:'unknown'}})
    expect(proposal.promptHash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(proposal)).not.toContain('synthetic-api-key')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['refusal',{status:'completed',output:[{content:[{type:'refusal',refusal:'no'}]}]}],
    ['truncated',{status:'incomplete',output:[]}],
    ['malformed',{status:'completed',output:[{content:[{type:'output_text',text:'{'}]}]}],
    ['five topics',{status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({topics:topics.slice(0,5)})}]}]}],
  ])('fails closed for %s without a second request',async(_label,payload)=>{
    const fetcher=vi.fn<AiFetch>(async()=>response(payload))
    await expect(generateNewsletterTextProposal(fetcher,{provider:'openai',key:'synthetic-api-key',model:'gpt-5'},request,new AbortController().signal)).rejects.toBeInstanceOf(NewsletterAiTextError)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('normalizes provider failures and cancellation without echoing response secrets',async()=>{
    const limited=vi.fn<AiFetch>(async()=>response({error:'synthetic-api-key'},429))
    await expect(generateNewsletterTextProposal(limited,{provider:'openai',key:'synthetic-api-key',model:'gpt-5'},request,new AbortController().signal)).rejects.toThrow('요청 한도')
    expect(limited).toHaveBeenCalledTimes(1)

    const controller=new AbortController()
    controller.abort()
    const cancelled=vi.fn<AiFetch>()
    await expect(generateNewsletterTextProposal(cancelled,{provider:'gemini',key:'synthetic-api-key',model:'gemini-2.5-pro'},request,controller.signal)).rejects.toThrow('취소')
    expect(cancelled).not.toHaveBeenCalled()
  })

  it('blocks personal data at the adapter boundary before any request',async()=>{
    const fetcher=vi.fn<AiFetch>()
    await expect(generateNewsletterTextProposal(fetcher,{provider:'openai',key:'synthetic-api-key',model:'gpt-5'},{...request,brief:'학생명: 홍길동'},new AbortController().signal)).rejects.toThrow('개인정보')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not let provider-authored source claims self-certify current health facts',async()=>{
    const spoofed=topics.map(topic=>({...topic,currentFactReview:'verified-source-selected' as const,sources:[{title:'모델이 주장한 자료',publisher:'검증되지 않은 기관',sha256:'c'.repeat(64)}]}))
    const fetcher=vi.fn<AiFetch>(async()=>response({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({topics:spoofed})}]}]}))
    const proposal=await generateNewsletterTextProposal(fetcher,{provider:'openai',key:'synthetic-api-key',model:'gpt-5'},request,new AbortController().signal)

    expect(proposal.topics.every(topic=>topic.currentFactReview==='verification-required')).toBe(true)
  })

  it('rejects caller-asserted verified sources until a hash-bound selection contract exists',async()=>{
    const fetcher=vi.fn<AiFetch>()
    await expect(generateNewsletterTextProposal(fetcher,{provider:'openai',key:'synthetic-api-key',model:'gpt-5'},{...request,verifiedSources:[{id:'source-1',sha256:'c'.repeat(64)}]},new AbortController().signal)).rejects.toBeInstanceOf(NewsletterAiTextError)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each(['openai','gemini'] as const)('regenerates exactly the requested topic through the %s structured adapter',async provider=>{
    const topic={...topics[2],currentFactReview:'verified-source-selected' as const}
    const payload=provider==='openai'?{status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({topic})}]}]}:{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({topic})}]}}]}
    const fetcher=vi.fn<AiFetch>(async()=>response(payload))
    const regeneration=await regenerateNewsletterTopicText(fetcher,{provider,key:'synthetic-api-key',model:provider==='openai'?'gpt-5':'gemini-2.5-pro'},{...request,regenerate:{proposalId:'proposal-1',targetTopicId:'topic-3',proposalHash:'d'.repeat(64),topicHash:'e'.repeat(64)}},new AbortController().signal)
    expect(regeneration).toMatchObject({kind:'topic-regeneration',targetTopicId:'topic-3',proposalHash:'d'.repeat(64),topicHash:'e'.repeat(64),topic:{id:'topic-3',actions:topic.actions,currentFactReview:'verification-required'}})
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects a regenerated topic with a different ID without mutating staged context',async()=>{
    const staged=structuredClone(topics),before=JSON.stringify(staged)
    const fetcher=vi.fn<AiFetch>(async()=>response({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({topic:{...topics[0],id:'topic-6'}})}]}]}))
    await expect(regenerateNewsletterTopicText(fetcher,{provider:'openai',key:'synthetic-api-key',model:'gpt-5'},{...request,regenerate:{proposalId:'proposal-1',targetTopicId:'topic-1',proposalHash:'d'.repeat(64),topicHash:'e'.repeat(64)}},new AbortController().signal)).rejects.toBeInstanceOf(NewsletterAiTextError)
    expect(JSON.stringify(staged)).toBe(before)
  })

  it('uses the selected structured-text model through AiService and rejects privacy before review',async()=>{
    let stored:AiCredential|null=null
    const vault:AiVault={available:true,exists:async()=>stored!==null,read:async()=>stored,write:async value=>{stored=value},clear:async()=>{stored=null}}
    const fetcher=vi.fn<AiFetch>(async(_url,init)=>init.method==='GET'
      ? response({data:[{id:'gpt-5'}]})
      : response({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({topics})}]}]}))
    const reviewSend=vi.fn(async()=>true)
    const reviewNewsletter=vi.fn(async()=> 'approved' as const)
    const service=new AiService({vault,fetch:fetcher,readClipboard:async()=> 'synthetic-api-key',clearClipboard:async()=>{},reviewKey:async()=>true,reviewSend,reviewNewsletter})
    await service.connectFromClipboard({provider:'openai',remember:false})

    const proposal=await service.proposeNewsletterText(request)
    expect(proposal).toMatchObject({provider:'openai',model:'gpt-5',topics})
    expect(reviewNewsletter).toHaveBeenCalledWith(expect.objectContaining({operation:'generate-text',provider:'openai',model:'gpt-5',cost:{status:'unknown'}}))
    expect(fetcher).toHaveBeenCalledTimes(2)

    expect(()=>service.proposeNewsletterText({...request,brief:'학생명: 홍길동'})).toThrow('개인정보')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
