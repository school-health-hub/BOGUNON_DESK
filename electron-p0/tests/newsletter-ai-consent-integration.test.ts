import {describe,expect,it,vi} from 'vitest'
import {AiService} from '../main/ai-service'
import type {AiFetch} from '../main/ai-network'
import type {AiCredential,AiVault} from '../main/ai-vault'

const baseline={projectId:'project-1',projectRevision:1,projectHash:'a'.repeat(64),designRevision:1,designHash:'b'.repeat(64)} as const
const topics=Array.from({length:6},(_,index)=>({
  id:`topic-${index+1}`,title:`주제 ${index+1}`,lead:`안내 ${index+1}`,
  actions:Array.from({length:4},(_unused,action)=>`수칙 ${index+1}-${action+1}`),
  closing:`마무리 ${index+1}`,sources:[],currentFactReview:'verification-required' as const,
}))
const request={month:11,schoolType:'coeducational' as const,baseline,requestId:'proposal-one',brief:'합성 보건교육 원고'}
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}})

describe('AiService Newsletter consent integration',()=>{
  it.each([429,500])('makes one provider call after consent for HTTP %i and retries only after renewed consent',async status=>{
    // Given
    let stored:AiCredential|null=null
    const vault:AiVault={available:true,exists:async()=>stored!==null,read:async()=>stored,write:async value=>{stored=value},clear:async()=>{stored=null}}
    let outboundAttempts=0
    const fetcher=vi.fn<AiFetch>(async(_url,init)=>{
      if(init.method==='GET')return response({data:[{id:'gpt-5'}]})
      outboundAttempts++
      return outboundAttempts===1
        ?response({error:{message:'provider diagnostics must not escape'}},status)
        :response({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({topics})}]}]})
    })
    const reviewNewsletter=vi.fn(async()=> 'approved' as const)
    const ids=['consent-one','consent-two'][Symbol.iterator]()
    const service=new AiService({
      vault,fetch:fetcher,readClipboard:async()=> 'synthetic-api-key',clearClipboard:async()=>{},
      reviewKey:async()=>true,reviewSend:async()=>true,reviewNewsletter,
      nextNewsletterRequestId:()=>ids.next().value ?? 'consent-fallback',
    })
    await service.connectFromClipboard({provider:'openai',remember:false})
    expect(outboundAttempts).toBe(0)

    // When: first explicitly approved request fails
    await expect(service.proposeNewsletterText(request)).rejects.toThrow()

    // Then: no automatic retry occurs
    expect(outboundAttempts).toBe(1)
    expect(reviewNewsletter).toHaveBeenCalledTimes(1)
    expect(reviewNewsletter).toHaveBeenLastCalledWith(expect.objectContaining({
      requestId:'consent-one',operation:'generate-text',files:[],totalByteSize:0,
      provider:'openai',model:'gpt-5',cost:{status:'unknown'},noRecallAfterTransmission:true,
    }))

    // When: the user explicitly requests generation again
    const proposal=await service.proposeNewsletterText({...request,requestId:'proposal-two'})

    // Then: a new consent is shown and exactly one new provider call occurs
    expect(proposal).toMatchObject({topics})
    expect(outboundAttempts).toBe(2)
    expect(reviewNewsletter).toHaveBeenCalledTimes(2)
    expect(reviewNewsletter).toHaveBeenLastCalledWith(expect.objectContaining({requestId:'consent-two'}))
  })

  it('fails closed when the exact Newsletter consent review port is unavailable',async()=>{
    // Given
    let stored:AiCredential|null=null
    const vault:AiVault={available:true,exists:async()=>stored!==null,read:async()=>stored,write:async value=>{stored=value},clear:async()=>{stored=null}}
    const fetcher=vi.fn<AiFetch>(async(_url,init)=>init.method==='GET'?response({data:[{id:'gpt-5'}]}):response({}))
    const service=new AiService({vault,fetch:fetcher,readClipboard:async()=> 'synthetic-api-key',clearClipboard:async()=>{},reviewKey:async()=>true,reviewSend:async()=>true})
    await service.connectFromClipboard({provider:'openai',remember:false})

    // When / Then
    await expect(service.proposeNewsletterText(request)).rejects.toThrow(/검토/)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
