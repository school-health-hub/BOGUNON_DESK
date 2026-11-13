import {createHash} from 'node:crypto'
import {describe,expect,it,vi} from 'vitest'
import {AiService} from '../main/ai-service'
import type {AiCredential,AiVault} from '../main/ai-vault'
import {
  generateNewsletterImageCandidate,
  NewsletterAiImageError,
  type NewsletterAiImageGenerationRequest,
} from '../main/newsletter-ai-image'

const baseline={projectId:'project-1',projectRevision:2,projectHash:'a'.repeat(64),designRevision:3,designHash:'b'.repeat(64)} as const
const request:NewsletterAiImageGenerationRequest={
  baseline,
  requestId:'image-request-1',
  topicId:'topic-1',
  target:{kind:'topic',topicId:'topic-1'},
  prompt:'학생이 올바른 손 씻기를 실천하는 교육 장면. 이미지 안에는 한글 본문을 넣지 않음.',
  references:[],
}

// 1x1 RGBA PNG. Synthetic fixture; it contains no user or school data.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAF/wJ+Y9Z2AAAAAElFTkSuQmCC','base64')

const response=(body:unknown)=>new Response(JSON.stringify(body),{
  status:200,
  headers:{'content-type':'application/json'},
})

describe('Newsletter live image adapters',()=>{
  it.each([
    ['openai',{data:[{b64_json:png.toString('base64')}]},'https://api.openai.com/v1/images/generations'],
    ['gemini',{candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType:'image/png',data:png.toString('base64')}}]}}]},'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent'],
  ] as const)('normalizes a bounded %s image response into pending provenance',async(provider,body,url)=>{
    // Given
    const fetcher=vi.fn(async(_url:string)=>response(body))
    // When
    const result=await generateNewsletterImageCandidate(fetcher,{provider,key:'test-key-value',model:provider==='openai'?'gpt-image-1':'gemini-2.5-flash-image'},request,new AbortController().signal,()=>new Date('2026-11-13T00:00:00.000Z'))
    // Then
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]?.[0]).toBe(url)
    expect(result.candidate).toMatchObject({assetType:'AI_GENERATED',exportApproval:'pending',provider,baseline,mediaType:'image/png',width:1,height:1,inputHashes:[]})
    expect(result.candidate.outputHash).toBe(createHash('sha256').update(png).digest('hex'))
    expect(result.bytesBase64).toBe(png.toString('base64'))
    expect(JSON.stringify(result)).not.toContain('test-key-value')
    expect(JSON.stringify(result)).not.toContain(request.prompt)
  })

  it('sends only the explicitly approved reference bytes and hashes',async()=>{
    // Given
    const reference={name:'approved-reference.png',sha256:createHash('sha256').update(png).digest('hex'),byteSize:png.byteLength,purpose:'선택한 스타일 참고',mediaType:'image/png' as const,bytesBase64:png.toString('base64')}
    const fetcher=vi.fn(async(_url:string,init:RequestInit)=>{
      const body=JSON.parse(String(init.body)) as {input?:readonly {image_url?:string}[]}
      expect(JSON.stringify(body)).toContain(reference.bytesBase64)
      return response({data:[{b64_json:png.toString('base64')}]})
    })
    // When
    const result=await generateNewsletterImageCandidate(fetcher,{provider:'openai',key:'test-key-value',model:'gpt-image-1'},{...request,references:[reference]},new AbortController().signal,()=>new Date('2026-11-13T00:00:00.000Z'))
    // Then
    expect(result.candidate.inputHashes).toEqual([reference.sha256])
  })

  it.each([
    ['HTML masquerading as an image','image/png',Buffer.from('<html>bad</html>')],
    ['a MIME mismatch','image/jpeg',png],
  ] as const)('rejects %s without returning candidate bytes',async(_label,mimeType,bytes)=>{
    // Given
    const fetcher=vi.fn(async()=>response({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType,data:bytes.toString('base64')}}]}}]}))
    // When / Then
    await expect(generateNewsletterImageCandidate(fetcher,{provider:'gemini',key:'test-key-value',model:'gemini-2.5-flash-image'},request,new AbortController().signal,()=>new Date())).rejects.toBeInstanceOf(NewsletterAiImageError)
  })

  it('rejects an oversized response from its declared length before reading bytes',async()=>{
    const fetcher=vi.fn(async()=>new Response('{}',{status:200,headers:{'content-type':'application/json','content-length':'200000000'}}))
    await expect(generateNewsletterImageCandidate(fetcher,{provider:'openai',key:'test-key-value',model:'gpt-image-1'},request,new AbortController().signal,()=>new Date())).rejects.toBeInstanceOf(NewsletterAiImageError)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid base64, changed references, and dimension bombs before retaining bytes',async()=>{
    const invalid=vi.fn(async()=>response({data:[{b64_json:'%%%='}]}))
    await expect(generateNewsletterImageCandidate(invalid,{provider:'openai',key:'test-key-value',model:'gpt-image-1'},request,new AbortController().signal,()=>new Date())).rejects.toBeInstanceOf(NewsletterAiImageError)

    const changed={name:'changed.png',sha256:'f'.repeat(64),byteSize:png.byteLength,purpose:'선택 참고',mediaType:'image/png' as const,bytesBase64:png.toString('base64')}
    const neverCalled=vi.fn()
    await expect(generateNewsletterImageCandidate(neverCalled,{provider:'openai',key:'test-key-value',model:'gpt-image-1'},{...request,references:[changed]},new AbortController().signal,()=>new Date())).rejects.toThrow('동의 시점')
    expect(neverCalled).not.toHaveBeenCalled()

    const bomb=Buffer.from(png);bomb.writeUInt32BE(8_193,16)
    const dimension=vi.fn(async()=>response({data:[{b64_json:bomb.toString('base64')}]}))
    await expect(generateNewsletterImageCandidate(dimension,{provider:'openai',key:'test-key-value',model:'gpt-image-1'},request,new AbortController().signal,()=>new Date())).rejects.toBeInstanceOf(NewsletterAiImageError)
  })

  it('rejects aggregate reference bytes above the model input bound before decoding or fetching',async()=>{
    // Given
    const reference=(suffix:string)=>({name:`reference-${suffix}.png`,sha256:suffix.repeat(64),byteSize:60_000_000,purpose:'선택 참고',mediaType:'image/png' as const,bytesBase64:png.toString('base64')})
    const fetcher=vi.fn()
    // When / Then
    await expect(generateNewsletterImageCandidate(fetcher,{provider:'openai',key:'test-key-value',model:'gpt-image-1'},{...request,references:[reference('a'),reference('b')]},new AbortController().signal,()=>new Date())).rejects.toThrow('입력 한도')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects redirects and cancellation without retrying',async()=>{
    // Given
    const redirected=vi.fn(async()=>new Response('',{status:302,headers:{location:'https://example.invalid/image'}}))
    const cancelled=vi.fn(async()=>response({data:[{b64_json:png.toString('base64')}]}))
    const controller=new AbortController();controller.abort()
    // When / Then
    await expect(generateNewsletterImageCandidate(redirected,{provider:'openai',key:'test-key-value',model:'gpt-image-1'},request,new AbortController().signal,()=>new Date())).rejects.toBeInstanceOf(NewsletterAiImageError)
    await expect(generateNewsletterImageCandidate(cancelled,{provider:'openai',key:'test-key-value',model:'gpt-image-1'},request,controller.signal,()=>new Date())).rejects.toBeInstanceOf(NewsletterAiImageError)
    expect(redirected).toHaveBeenCalledTimes(1)
    expect(cancelled).not.toHaveBeenCalled()
  })

  it('routes the selected image model through exact consent and returns pending provenance',async()=>{
    // Given
    let stored:AiCredential|null=null
    const vault:AiVault={available:true,exists:async()=>stored!==null,read:async()=>stored,write:async value=>{stored=value},clear:async()=>{stored=null}}
    const fetcher=vi.fn(async(_url:string,init:RequestInit)=>init.method==='GET'
      ?response({data:[{id:'gpt-5'},{id:'gpt-image-1'}]})
      :response({data:[{b64_json:png.toString('base64')}]}))
    const reviewNewsletter=vi.fn(async()=> 'approved' as const)
    const service=new AiService({vault,fetch:fetcher,readClipboard:async()=> 'synthetic-api-key',clearClipboard:async()=>{},reviewKey:async()=>true,reviewSend:async()=>true,reviewNewsletter,now:()=>new Date('2026-11-13T00:00:00.000Z')})
    await service.connectFromClipboard({provider:'openai',remember:false})
    // When
    const candidate=await service.generateNewsletterImageCandidate({...request,provider:'openai',model:'gpt-image-1',referenceTokens:[]},[])
    // Then
    expect(reviewNewsletter).toHaveBeenCalledWith(expect.objectContaining({operation:'generate-image',provider:'openai',model:'gpt-image-1',files:[],cost:{status:'unknown'},noRecallAfterTransmission:true}))
    expect(candidate).toMatchObject({candidateId:'image-request-1',baseline,mediaType:'image/png',width:1,height:1,provenance:{assetType:'AI_GENERATED',exportApproval:'pending'}})
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
