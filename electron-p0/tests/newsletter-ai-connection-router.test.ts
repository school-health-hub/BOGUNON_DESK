import {describe,expect,it,vi} from 'vitest'
import {NewsletterAiConnectionRouter} from '../main/newsletter-ai-connection-router'
import type {NewsletterAiIpcService} from '../main/newsletter-ai-ipc'

const port=(provider:'openai'|'chatgpt'):NewsletterAiIpcService=>({
  status:vi.fn(async()=>({connected:true,provider,textModel:'text-model',imageModel:provider==='openai'?'image-model':null,textAvailable:true,imageAvailable:provider==='openai',textUnavailableReason:null,imageUnavailableReason:provider==='openai'?null:'미지원'})),
  proposeText:vi.fn(async()=>({provider})),generateImageCandidate:vi.fn(async()=>{throw new Error('not used')}),cancel:vi.fn(async()=>{}),
})

describe('Newsletter AI explicit connection router',()=>{
  it('selects ChatGPT explicitly and never silently falls back to an API key',async()=>{
    const api=port('openai'),chatgpt=port('chatgpt'),router=new NewsletterAiConnectionRouter(api,chatgpt)
    await router.selectConnection('chatgpt')
    await router.proposeText({baseline:{projectId:'project',projectRevision:1,projectHash:'a'.repeat(64),designRevision:1,designHash:'b'.repeat(64)},month:11,schoolType:'coeducational',requestId:'request',brief:'합성 원고'})
    expect(chatgpt.proposeText).toHaveBeenCalledOnce()
    expect(api.proposeText).not.toHaveBeenCalled()
  })

  it('reports ChatGPT, OpenAI key, and Gemini key as distinct choices',async()=>{
    const router=new NewsletterAiConnectionRouter(port('openai'),port('chatgpt'))
    expect((await router.status()).connections?.map(value=>value.kind)).toEqual(['chatgpt','openai-api-key','gemini-api-key'])
  })
})
