import {describe,expect,it,vi} from 'vitest'
import {createNewsletterAiHandler,type NewsletterAiIpcService} from '../main/newsletter-ai-ipc'
import {NewsletterAiCandidateStore} from '../main/newsletter-ai-candidate-store'
import {createNewsletterAiComposition} from '../main/newsletter-ai-composition'

const baseline={projectId:'qa-project',projectRevision:2,projectHash:'a'.repeat(64),designRevision:3,designHash:'b'.repeat(64)} as const
const live=():NewsletterAiIpcService=>({
  status:vi.fn(async()=>({connected:false,provider:null,textModel:null,imageModel:null,textAvailable:false,imageAvailable:false,textUnavailableReason:'연결 없음',imageUnavailableReason:'연결 없음'})),
  proposeText:vi.fn(async()=>null),
  generateImageCandidate:vi.fn(async()=>{throw new Error('live path must not run')}),
  cancel:vi.fn(async()=>undefined),
})
const actor=()=>{const frame={},contents={id:51,mainFrame:frame,getURL:()=> 'file:///newsletter/index.html'};return{contents,event:{sender:contents,senderFrame:frame}}}

describe('Newsletter AI Electron QA composition',()=>{
  it('routes status, text, image, and preview through the deterministic Mock without the live service',async()=>{
    // Given
    const liveService=live()
    const service=createNewsletterAiComposition({qaProfile:true,packaged:false,nodeEnv:'development',mockOptIn:'1',seed:'windows-qa',live:liveService})
    const sender=actor(),store=new NewsletterAiCandidateStore({clock:()=>0,token:()=> 'qa-candidate-token-0001'})
    const handler=(action:Parameters<typeof createNewsletterAiHandler>[0]['action'])=>createNewsletterAiHandler({action,contents:sender.contents,url:'file:///newsletter/index.html',service,store,sessionId:'qa-session'})
    // When
    const status=await handler('status')(sender.event)
    const text=await handler('proposeText')(sender.event,{baseline,month:11,schoolType:'coeducational',requestId:'qa-text-1',brief:'합성 QA 보건소식지'})
    const image=await handler('generateImageCandidate')(sender.event,{baseline,requestId:'qa-image-1',topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'},prompt:'합성 QA 학생 건강 행동',provider:'mock',model:'newsletter-offline-v1',referenceTokens:[]})
    const token=image.ok&&typeof image.data==='object'&&image.data!==null&&'candidateToken' in image.data?String(image.data.candidateToken):''
    const preview=await handler('previewCandidate')(sender.event,{candidateToken:token,baseline})
    const cancelled=await handler('cancel')(sender.event,{requestId:'qa-image-1'})
    // Then
    expect(status).toEqual({ok:true,data:{connected:true,provider:'mock',textModel:'newsletter-offline-v1',imageModel:'newsletter-offline-v1',textAvailable:true,imageAvailable:true,textUnavailableReason:null,imageUnavailableReason:null}})
    expect(text).toMatchObject({ok:true,data:{provider:'mock',mock:true,usage:{costStatus:'unknown'}}})
    if(text.ok&&typeof text.data==='object'&&text.data!==null&&'topics' in text.data&&Array.isArray(text.data.topics)){
      expect(text.data.topics).toHaveLength(6)
      expect(text.data.topics.every(topic=>typeof topic==='object'&&topic!==null&&'actions' in topic&&Array.isArray(topic.actions)&&topic.actions.length===4)).toBe(true)
    }else throw new Error('Mock proposal topics missing')
    expect(image).toMatchObject({ok:true,data:{candidate:{provenance:{provider:'mock',mock:true,exportApproval:'pending',usage:{costStatus:'unknown'}}}}})
    expect(preview).toMatchObject({ok:true,data:{candidateToken:'qa-candidate-token-0001',mediaType:'image/png'}})
    expect(cancelled).toEqual({ok:true,data:null})
    expect(vi.mocked(liveService.status)).not.toHaveBeenCalled()
    expect(vi.mocked(liveService.proposeText)).not.toHaveBeenCalled()
    expect(vi.mocked(liveService.generateImageCandidate)).not.toHaveBeenCalled()
  })

  it.each([
    {qaProfile:false,packaged:false,nodeEnv:'development'},
    {qaProfile:true,packaged:true,nodeEnv:'development'},
    {qaProfile:true,packaged:false,nodeEnv:'production'},
  ])('rejects explicit Mock activation outside an unpackaged non-production QA profile',input=>{
    expect(()=>createNewsletterAiComposition({...input,mockOptIn:'1',seed:'forbidden',live:live()})).toThrow('Mock 공급자는 격리된 비프로덕션 QA 프로필에서만 사용할 수 있습니다.')
  })

  it('keeps the live service unchanged when Mock opt-in is absent',()=>{
    const liveService=live()
    expect(createNewsletterAiComposition({qaProfile:true,packaged:false,nodeEnv:'development',mockOptIn:undefined,seed:'unused',live:liveService})).toBe(liveService)
  })
})
