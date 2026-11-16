import {describe,expect,it,vi} from 'vitest'
import type {ChatGptStatus} from '../chatgpt-protocol'
import {NewsletterChatGptAdapter} from '../main/newsletter-chatgpt-adapter'

const hash=(value:string)=>value.repeat(64)
const baseline={projectId:'newsletter-project',projectRevision:1,projectHash:hash('a'),designRevision:1,designHash:hash('b')}
const request={baseline,month:11,schoolType:'coeducational' as const,requestId:'chatgpt-request',brief:'합성 보건소식지 원고'}
const ready:ChatGptStatus={supported:true,phase:'ready',busy:false,accountId:hash('c'),identity:'ChatGPT 계정',planUsageEnabled:true,models:[{id:'account-model',label:'Account model'}],model:'account-model',textCallVerified:false,showPlanNotice:true,notice:'모델 조회 완료'}
const topics=Array.from({length:6},(_,index)=>({id:`topic-${index+1}`,title:`주제 ${index+1}`,lead:`도입 ${index+1}`,actions:Array.from({length:4},(__,action)=>`수칙 ${index+1}-${action+1}`),closing:`마무리 ${index+1}`,sources:[],currentFactReview:'verification-required'}))

const service=(text=JSON.stringify({topics}))=>({status:vi.fn(async()=>ready),generate:vi.fn(async()=>({text})),cancel:vi.fn()})

describe('Newsletter ChatGPT account adapter',()=>{
  it('converts a valid account response into the six-topic local contract without claiming image support',async()=>{
    const account=service(),adapter=new NewsletterChatGptAdapter(account)
    expect(await adapter.status()).toMatchObject({connected:true,provider:'chatgpt',textAvailable:true,imageAvailable:false,selectedConnection:'chatgpt'})
    const proposal=await adapter.proposeText(request)
    expect('topics' in proposal&&proposal.topics).toHaveLength(6)
    if('topics' in proposal)expect(proposal.topics.every(topic=>topic.actions.length===4)).toBe(true)
    expect(account.generate).toHaveBeenCalledWith(expect.objectContaining({tool:'newsletter'}))
  })

  it('rejects malformed structured output instead of applying it',async()=>{
    const adapter=new NewsletterChatGptAdapter(service(JSON.stringify({topics:topics.slice(0,5)})))
    await expect(adapter.proposeText(request)).rejects.toThrow()
  })

  it('distinguishes a signed-in account from a usable generation permission',async()=>{
    const denied={...ready,phase:'permission-required' as const,planUsageEnabled:false,model:null},account=service(),adapter=new NewsletterChatGptAdapter({...account,status:vi.fn(async()=>denied)})
    expect(await adapter.status()).toMatchObject({connected:false,textAvailable:false,imageAvailable:false})
    await expect(adapter.proposeText(request)).rejects.toThrow('요금제 사용 권한')
    expect(account.generate).not.toHaveBeenCalled()
  })

  it('preserves the requested topic id during single-topic regeneration',async()=>{
    const account=service(JSON.stringify({topic:{...topics[0],id:'provider-changed-id'}})),adapter=new NewsletterChatGptAdapter(account)
    const result=await adapter.proposeText({...request,regenerate:{proposalId:'proposal-1',targetTopicId:'topic-4',proposalHash:hash('d'),topicHash:hash('e')}})
    expect(result).toMatchObject({kind:'topic-regeneration',targetTopicId:'topic-4',topic:{id:'topic-4'}})
  })

  it('keeps unsupported account image generation blocked',async()=>{
    const adapter=new NewsletterChatGptAdapter(service())
    await expect(adapter.generateImageCandidate({baseline,requestId:'image-request',topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'},prompt:'합성 삽화',provider:'openai',model:'image-model',referenceTokens:[]},[])).rejects.toThrow('지원이 확인되지 않았습니다')
  })
})
