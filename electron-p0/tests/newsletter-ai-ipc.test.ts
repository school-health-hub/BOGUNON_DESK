import {describe,expect,it,vi} from 'vitest'
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {NewsletterAiCandidateStore} from '../main/newsletter-ai-candidate-store'
import {NewsletterAiAssetStorage} from '../main/newsletter-ai-asset-storage'
import {createNewsletterAiHandler,NewsletterAiProjectAuthority,type NewsletterAiIpcService} from '../main/newsletter-ai-ipc'

const baseline={projectId:'project-1',projectRevision:2,projectHash:'a'.repeat(64),designRevision:3,designHash:'b'.repeat(64)} as const
const pngBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',pngSha='431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460'
function authority(){const value=new NewsletterAiProjectAuthority();value.grant(41,'session-1','project-1');return value}

function sender(){
  const frame={}
  const contents={id:41,mainFrame:frame,getURL:()=> 'file:///newsletter/index.html'}
  return {contents,event:{sender:contents,senderFrame:frame}}
}

function service():NewsletterAiIpcService{
  return {
    status:vi.fn(async()=>({connected:true,provider:'openai' as const,textModel:'gpt-text',imageModel:'gpt-image',textAvailable:true,imageAvailable:true,textUnavailableReason:null,imageUnavailableReason:null})),
    proposeText:vi.fn(async request=>({proposalId:'proposal-1',baseline:request.baseline})),
    generateImageCandidate:vi.fn(async request=>({candidateId:'candidate-1',baseline:request.baseline,mediaType:'image/png' as const,bytesBase64:'iVBORw0KGgo=',sha256:'c'.repeat(64),width:16,height:16})),
    cancel:vi.fn(async()=>undefined),
  }
}

describe('Newsletter AI IPC boundary',()=>{
  it('routes bounded single-topic regeneration through proposeText and rejects malformed staged fingerprints',async()=>{
    const actor=sender(),port=service(),store=new NewsletterAiCandidateStore({clock:()=>0,token:()=> 'candidate-token-0001'})
    const handler=createNewsletterAiHandler({action:'proposeText',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,sessionId:'session-1'})
    const request={baseline,month:11,schoolType:'coeducational' as const,requestId:'request-1',brief:'세 번째 주제만 다시 작성',regenerate:{proposalId:'proposal-1',targetTopicId:'topic-3',proposalHash:'d'.repeat(64),topicHash:'e'.repeat(64)}}
    expect(await handler(actor.event,request)).toMatchObject({ok:true})
    expect(port.proposeText).toHaveBeenCalledWith(request)
    expect(await handler(actor.event,{...request,regenerate:{...request.regenerate,proposalHash:'invalid'}})).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}})
    expect(port.proposeText).toHaveBeenCalledTimes(1)
  })
  it('rejects unauthorized senders and unknown request fields before calling the service',async()=>{
    // Given
    const actor=sender(),port=service(),store=new NewsletterAiCandidateStore({clock:()=>0,token:()=> 'candidate-token-0001'})
    const handler=createNewsletterAiHandler({action:'proposeText',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,sessionId:'session-1'})
    // When
    const forbidden=await handler({sender:{},senderFrame:actor.contents.mainFrame},{baseline,month:9,schoolType:'girls',requestId:'request-1',brief:'합성 원고'})
    const extra=await handler(actor.event,{baseline,month:9,schoolType:'girls',requestId:'request-1',brief:'합성 원고',apiKey:'secret'})
    // Then
    expect(forbidden).toMatchObject({ok:false,error:{code:'FORBIDDEN'}})
    expect(extra).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}})
    expect(port.proposeText).not.toHaveBeenCalled()
  })

  it('issues an opaque owner-bound token and returns only sanitized candidate metadata',async()=>{
    // Given
    const actor=sender(),port=service(),store=new NewsletterAiCandidateStore({clock:()=>0,token:()=> 'candidate-token-0001'})
    const handler=createNewsletterAiHandler({action:'generateImageCandidate',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,sessionId:'session-1'})
    // When
    const result=await handler(actor.event,{baseline,requestId:'image-request-1',topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'},prompt:'합성 보건교육 삽화',provider:'openai',model:'gpt-image',referenceTokens:[]})
    // Then
    expect(result).toEqual({ok:true,data:{candidateToken:'candidate-token-0001',candidate:{candidateId:'candidate-1',baseline,mediaType:'image/png',sha256:'c'.repeat(64),width:16,height:16,topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'}}}})
    expect(JSON.stringify(result)).not.toContain('iVBORw0KGgo=')
  })

  it('rejects an image target whose topic differs from the request topic',async()=>{
    const actor=sender(),port=service(),store=new NewsletterAiCandidateStore(),handler=createNewsletterAiHandler({action:'generateImageCandidate',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,sessionId:'session-1'})
    const result=await handler(actor.event,{baseline,requestId:'image-request-1',topicId:'topic-1',target:{kind:'action',topicId:'topic-2',actionIndex:0},prompt:'합성 보건교육 삽화',provider:'openai',model:'gpt-image',referenceTokens:[]})
    expect(result).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}})
    expect(port.generateImageCandidate).not.toHaveBeenCalled()
    expect(store.size()).toBe(0)
  })

  it('rejects forged reference handles before image generation',async()=>{
    // Given
    const actor=sender(),port=service(),store=new NewsletterAiCandidateStore({clock:()=>0,token:()=> 'candidate-token-0001'})
    const handler=createNewsletterAiHandler({action:'generateImageCandidate',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,sessionId:'session-1'})
    // When
    const result=await handler(actor.event,{baseline,requestId:'image-request-1',topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'},prompt:'합성 보건교육 삽화',provider:'openai',model:'gpt-image',referenceTokens:['forged-token-0001']})
    // Then
    expect(result).toMatchObject({ok:false,error:{code:'CONFLICT'}})
    expect(port.generateImageCandidate).not.toHaveBeenCalled()
  })

  it('rejects a service candidate bound to a different project or design baseline without retaining bytes',async()=>{
    // Given
    const actor=sender(),port=service(),store=new NewsletterAiCandidateStore({clock:()=>0,token:()=> 'candidate-token-0001'})
    vi.mocked(port.generateImageCandidate).mockResolvedValue({candidateId:'candidate-1',baseline:{...baseline,projectHash:'d'.repeat(64),designHash:'e'.repeat(64)},mediaType:'image/png',bytesBase64:'iVBORw0KGgo=',sha256:'c'.repeat(64),width:16,height:16})
    const handler=createNewsletterAiHandler({action:'generateImageCandidate',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,sessionId:'session-1'})
    // When
    const result=await handler(actor.event,{baseline,requestId:'image-request-1',topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'},prompt:'합성 보건교육 삽화',provider:'openai',model:'gpt-image',referenceTokens:[]})
    // Then
    expect(result).toMatchObject({ok:false,error:{code:'CONFLICT'}})
    expect(store.size()).toBe(0)
    expect(store.peek({token:'candidate-token-0001',ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline})).toBeNull()
  })

  it('rejects cross-window, stale-baseline and expired preview access',async()=>{
    // Given
    let now=0
    const actor=sender(),port=service(),store=new NewsletterAiCandidateStore({clock:()=>now,token:()=> 'candidate-token-0001',ttlMs:100})
    const generate=createNewsletterAiHandler({action:'generateImageCandidate',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,sessionId:'session-1'})
    await generate(actor.event,{baseline,requestId:'image-request-1',topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'},prompt:'합성 보건교육 삽화',provider:'openai',model:'gpt-image',referenceTokens:[]})
    const preview=createNewsletterAiHandler({action:'previewCandidate',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,sessionId:'session-1'})
    // When / Then
    const other={...actor.contents,id:42}
    expect(await createNewsletterAiHandler({action:'previewCandidate',contents:other,url:'file:///newsletter/index.html',service:port,store,sessionId:'session-1'})({sender:other,senderFrame:other.mainFrame},{candidateToken:'candidate-token-0001',baseline})).toMatchObject({ok:false,error:{code:'CONFLICT'}})
    expect(await preview(actor.event,{candidateToken:'candidate-token-0001',baseline:{...baseline,projectRevision:4}})).toMatchObject({ok:false,error:{code:'CONFLICT'}})
    now=101
    expect(await preview(actor.event,{candidateToken:'candidate-token-0001',baseline})).toMatchObject({ok:false,error:{code:'CONFLICT'}})
  })

  it('invalidates candidate bytes on discard, provider disconnect and disposal',async()=>{
    // Given
    const store=new NewsletterAiCandidateStore({clock:()=>0,token:()=> 'candidate-token-0001'})
    store.issue({ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline,candidate:{candidateId:'candidate-1',baseline,mediaType:'image/png',bytesBase64:'iVBORw0KGgo=',sha256:'c'.repeat(64),width:16,height:16,topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'}}})
    // When / Then
    expect(store.discard('candidate-token-0001',41,'session-1')).toBe(true)
    expect(store.peek({token:'candidate-token-0001',ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline})).toBeNull()
    store.issue({ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline,candidate:{candidateId:'candidate-1',baseline,mediaType:'image/png',bytesBase64:'iVBORw0KGgo=',sha256:'c'.repeat(64),width:16,height:16,topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'}}})
    expect(store.peek({token:'candidate-token-0001',ownerId:41,sessionId:'session-1',connectionKey:'gemini:gemini-image',baseline})).toBeNull()
    expect(store.size()).toBe(0)
    store.issue({ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline,candidate:{candidateId:'candidate-1',baseline,mediaType:'image/png',bytesBase64:'iVBORw0KGgo=',sha256:'c'.repeat(64),width:16,height:16,topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'}}})
    store.invalidateOwner(41)
    expect(store.size()).toBe(0)
    store.dispose()
    expect(store.size()).toBe(0)
  })

  it('commits and reloads authorized candidate bytes only inside their project',async()=>{
    // Given
    const root=await mkdtemp(join(tmpdir(),'newsletter-ai-ipc-')),assets=new NewsletterAiAssetStorage(root),actor=sender(),port=service(),store=new NewsletterAiCandidateStore({clock:()=>0,token:()=> 'candidate-token-0001'})
    store.issue({ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline,candidate:{candidateId:'candidate-1',baseline,mediaType:'image/png',bytesBase64:pngBase64,sha256:pngSha,width:1,height:1,topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'}}})
    const access=authority(),commit=createNewsletterAiHandler({action:'commitCandidateAsset',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,assets,authority:access,sessionId:'session-1'})
    const load=createNewsletterAiHandler({action:'loadProjectAssets',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,assets,authority:access,sessionId:'session-1'})
    // When
    const committed=await commit(actor.event,{candidateToken:'candidate-token-0001',baseline,documentBaseline:baseline,projectId:'project-1'})
    const loaded=await load(actor.event,{projectId:'project-1',baseline,sha256:[pngSha]})
    // Then
    expect(committed).toEqual({ok:true,data:null})
    expect(loaded).toEqual({ok:true,data:[{sha256:pngSha,bytesBase64:pngBase64}]})
    expect(await load(actor.event,{projectId:'project-2',baseline,sha256:[pngSha]})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}})
  })

  it('authorizes the generated candidate project for the same owner session before commit',async()=>{
    // Given
    const root=await mkdtemp(join(tmpdir(),'newsletter-ai-ipc-')),assets=new NewsletterAiAssetStorage(root),actor=sender(),port=service(),store=new NewsletterAiCandidateStore({clock:()=>0,token:()=> 'candidate-token-0001'}),access=new NewsletterAiProjectAuthority()
    vi.mocked(port.generateImageCandidate).mockResolvedValue({candidateId:'candidate-1',baseline,mediaType:'image/png',bytesBase64:pngBase64,sha256:pngSha,width:1,height:1})
    const generate=createNewsletterAiHandler({action:'generateImageCandidate',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,assets,authority:access,sessionId:'session-1'})
    const commit=createNewsletterAiHandler({action:'commitCandidateAssets',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,assets,authority:access,sessionId:'session-1'})
    // When
    const generated=await generate(actor.event,{baseline,requestId:'image-request-1',topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'},prompt:'합성 보건교육 삽화',provider:'openai',model:'gpt-image',referenceTokens:[]})
    const committed=await commit(actor.event,{candidateTokens:['candidate-token-0001'],baseline,documentBaseline:baseline,projectId:'project-1'})
    // Then
    expect(generated).toMatchObject({ok:true})
    expect(committed).toEqual({ok:true,data:null})
  })

  it('rejects unauthorized and stale candidate commits before storage',async()=>{
    // Given
    const assets=new NewsletterAiAssetStorage(await mkdtemp(join(tmpdir(),'newsletter-ai-ipc-'))),actor=sender(),port=service(),store=new NewsletterAiCandidateStore({clock:()=>0,token:()=> 'candidate-token-0001'})
    store.issue({ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline,candidate:{candidateId:'candidate-1',baseline,mediaType:'image/png',bytesBase64:pngBase64,sha256:pngSha,width:1,height:1,topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'}}})
    const commit=createNewsletterAiHandler({action:'commitCandidateAsset',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,assets,authority:authority(),sessionId:'session-1'})
    // When / Then
    expect(await commit({sender:{},senderFrame:actor.contents.mainFrame},{candidateToken:'candidate-token-0001',baseline,projectId:'project-1'})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}})
    expect(await commit(actor.event,{candidateToken:'candidate-token-0001',baseline:{...baseline,designRevision:4},projectId:'project-1'})).toMatchObject({ok:false,error:{code:'CONFLICT'}})
  })

  it('fails closed for hash-mismatched and corrupt durable bytes',async()=>{
    // Given
    const root=await mkdtemp(join(tmpdir(),'newsletter-ai-ipc-')),assets=new NewsletterAiAssetStorage(root),actor=sender(),port=service();let issued=0
    const store=new NewsletterAiCandidateStore({clock:()=>0,token:()=>`candidate-token-000${++issued}`})
    store.issue({ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline,candidate:{candidateId:'candidate-1',baseline,mediaType:'image/png',bytesBase64:pngBase64,sha256:pngSha,width:1,height:1,topicId:'topic-1',target:{kind:'topic',topicId:'topic-1'}}})
    store.issue({ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline,candidate:{candidateId:'candidate-2',baseline,mediaType:'image/png',bytesBase64:pngBase64,sha256:'c'.repeat(64),width:1,height:1,topicId:'topic-1',target:{kind:'action',topicId:'topic-1',actionIndex:0}}})
    const access=authority(),commit=createNewsletterAiHandler({action:'commitCandidateAssets',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,assets,authority:access,sessionId:'session-1'})
    const load=createNewsletterAiHandler({action:'loadProjectAssets',contents:actor.contents,url:'file:///newsletter/index.html',service:port,store,assets,authority:access,sessionId:'session-1'})
    // When / Then
    expect(await commit(actor.event,{candidateTokens:['candidate-token-0001','candidate-token-0002'],baseline,documentBaseline:baseline,projectId:'project-1'})).toMatchObject({ok:false,error:{code:'INTERNAL_ERROR'}})
    expect(await load(actor.event,{projectId:'project-1',baseline,sha256:[pngSha]})).toMatchObject({ok:false,error:{code:'INTERNAL_ERROR'}})
    await mkdir(join(root,'project-1'),{recursive:true});await writeFile(join(root,'project-1',`${pngSha}.png`),'corrupt')
    expect(await load(actor.event,{projectId:'project-1',baseline,sha256:[pngSha]})).toMatchObject({ok:false,error:{code:'INTERNAL_ERROR'}})
    expect(await load(actor.event,{projectId:'project-1',baseline,sha256:['d'.repeat(64)]})).toMatchObject({ok:false,error:{code:'INTERNAL_ERROR'}})
  })

  it('enforces owner-session and global candidate count and decoded-byte budgets',()=>{
    // Given
    let sequence=0
    const store=new NewsletterAiCandidateStore({clock:()=>0,token:()=>`candidate-token-${String(++sequence).padStart(4,'0')}`,maxCandidatesPerOwnerSession:2,maxBytesPerOwnerSession:7,maxCandidatesGlobal:3,maxBytesGlobal:12})
    const candidate={candidateId:'candidate-1',baseline,mediaType:'image/png' as const,bytesBase64:'AQIDBA==',sha256:'c'.repeat(64),width:16,height:16,topicId:'topic-1',target:{kind:'topic' as const,topicId:'topic-1'}}
    const issue=(ownerId:number,sessionId:string)=>store.issue({ownerId,sessionId,connectionKey:'openai:gpt-image',baseline,candidate})
    // When / Then
    expect(issue(41,'session-1')).toBe('candidate-token-0001')
    expect(issue(41,'session-1')).toBeNull()
    expect(issue(42,'session-2')).toBe('candidate-token-0002')
    expect(issue(43,'session-3')).toBe('candidate-token-0003')
    expect(issue(44,'session-4')).toBeNull()
    expect(store.size()).toBe(3)
  })

  it('sweeps expired candidates before applying issue and peek budgets',()=>{
    // Given
    let now=0,sequence=0
    const store=new NewsletterAiCandidateStore({clock:()=>now,token:()=>`candidate-token-${String(++sequence).padStart(4,'0')}`,ttlMs:100,maxCandidatesGlobal:1})
    const candidate={candidateId:'candidate-1',baseline,mediaType:'image/png' as const,bytesBase64:'AQIDBA==',sha256:'c'.repeat(64),width:16,height:16,topicId:'topic-1',target:{kind:'topic' as const,topicId:'topic-1'}}
    expect(store.issue({ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline,candidate})).toBe('candidate-token-0001')
    // When
    now=101
    const next=store.issue({ownerId:42,sessionId:'session-2',connectionKey:'openai:gpt-image',baseline,candidate})
    // Then
    expect(next).toBe('candidate-token-0002')
    expect(store.peek({token:'candidate-token-0001',ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline})).toBeNull()
    expect(store.size()).toBe(1)
  })

  it('keeps owner-session budgets isolated',()=>{
    // Given
    let sequence=0
    const store=new NewsletterAiCandidateStore({clock:()=>0,token:()=>`candidate-token-${String(++sequence).padStart(4,'0')}`,maxCandidatesPerOwnerSession:1})
    const candidate={candidateId:'candidate-1',baseline,mediaType:'image/png' as const,bytesBase64:'AQIDBA==',sha256:'c'.repeat(64),width:16,height:16,topicId:'topic-1',target:{kind:'topic' as const,topicId:'topic-1'}}
    // When / Then
    expect(store.issue({ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline,candidate})).not.toBeNull()
    expect(store.issue({ownerId:41,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline,candidate})).toBeNull()
    expect(store.issue({ownerId:41,sessionId:'session-2',connectionKey:'openai:gpt-image',baseline,candidate})).not.toBeNull()
    expect(store.issue({ownerId:42,sessionId:'session-1',connectionKey:'openai:gpt-image',baseline,candidate})).not.toBeNull()
  })
})
