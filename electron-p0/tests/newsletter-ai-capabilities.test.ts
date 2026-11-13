import {describe,expect,it} from 'vitest'
import {
  buildNewsletterCapabilitySelection,
  getNewsletterModelCapability,
  selectNewsletterCapabilityModel,
} from '../main/newsletter-ai-capabilities'
import {validateCredential} from '../main/ai-vault'
import {discoverAiCatalog,type AiFetch} from '../main/ai-network'
import {AiService} from '../main/ai-service'
import type {AiCredential,AiVault} from '../main/ai-vault'
import {vi} from 'vitest'

describe('Newsletter AI capability selection',()=>{
  it('separates structured text and image generation models when account discovery includes both',()=>{
    const selection=buildNewsletterCapabilitySelection('openai',[
      {id:'gpt-5',label:'GPT 5'},
      {id:'gpt-image-1',label:'GPT Image'},
      {id:'unknown-future-model',label:'Unknown'},
    ],null)

    expect(selection.textModels.map(model=>model.id)).toEqual(['gpt-5'])
    expect(selection.imageModels.map(model=>model.id)).toEqual(['gpt-image-1'])
    expect(selection).toMatchObject({textModel:'gpt-5',imageModel:'gpt-image-1'})
  })

  it('defaults unknown and text-only models to unsupported image generation',()=>{
    expect(getNewsletterModelCapability('openai','unknown-future-model')).toMatchObject({text:{structuredOutput:false},image:{generate:false}})
    expect(getNewsletterModelCapability('gemini','gemini-2.5-pro')).toMatchObject({text:{structuredOutput:true},image:{generate:false}})
  })

  it('changes one selected capability without silently changing the other',()=>{
    const initial=buildNewsletterCapabilitySelection('gemini',[
      {id:'gemini-2.5-pro',label:'Gemini Pro'},
      {id:'gemini-2.5-flash',label:'Gemini Flash'},
      {id:'gemini-2.5-flash-image',label:'Gemini Image'},
    ],{textModel:'gemini-2.5-pro',imageModel:'gemini-2.5-flash-image'})

    expect(selectNewsletterCapabilityModel(initial,'text','gemini-2.5-flash')).toMatchObject({textModel:'gemini-2.5-flash',imageModel:'gemini-2.5-flash-image'})
    expect(()=>selectNewsletterCapabilityModel(initial,'image','gemini-2.5-pro')).toThrow('지원')
  })

  it('reads legacy credentials and the additive separate-model shape without losing the key',()=>{
    const legacy=validateCredential({provider:'openai',key:'synthetic-legacy-key',model:'gpt-5'})
    const current=validateCredential({provider:'openai',key:'synthetic-current-key',model:'gpt-5',textModel:'gpt-5',imageModel:'gpt-image-1'})

    expect(legacy).toEqual({provider:'openai',key:'synthetic-legacy-key',model:'gpt-5'})
    expect(current).toEqual({provider:'openai',key:'synthetic-current-key',model:'gpt-5',textModel:'gpt-5',imageModel:'gpt-image-1'})
  })

  it('discovers one provider catalog without treating membership as capability proof',async()=>{
    const fetch=vi.fn<AiFetch>(async()=>new Response(JSON.stringify({data:[
      {id:'gpt-5'},
      {id:'gpt-image-1'},
      {id:'unknown-future-model'},
    ]}),{headers:{'content-type':'application/json'}}))

    const catalog=await discoverAiCatalog(fetch,'openai','synthetic-key',new AbortController().signal)

    expect(catalog.models.map(model=>model.id)).toEqual(['gpt-5'])
    expect(catalog.capabilityModels.map(model=>model.id)).toEqual(['gpt-5','gpt-image-1'])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('exposes and persists separate selected models without returning the key',async()=>{
    let stored:AiCredential|null=null
    const vault:AiVault={available:true,exists:async()=>stored!==null,read:async()=>stored,write:async credential=>{stored=credential},clear:async()=>{stored=null}}
    const fetch=vi.fn<AiFetch>(async()=>new Response(JSON.stringify({data:[{id:'gpt-5'},{id:'gpt-5-mini'},{id:'gpt-image-1'}]}),{headers:{'content-type':'application/json'}}))
    const service=new AiService({vault,fetch,readClipboard:async()=>'synthetic-api-key',clearClipboard:async()=>{},reviewKey:async()=>true,reviewSend:async()=>true})

    const connected=await service.connectFromClipboard({provider:'openai',remember:true})
    expect(connected).toMatchObject({textModel:'gpt-5',imageModel:'gpt-image-1'})
    await service.selectNewsletterModel({kind:'text',model:'gpt-5-mini'})
    expect(await service.status()).toMatchObject({textModel:'gpt-5-mini',imageModel:'gpt-image-1'})
    expect(stored).toMatchObject({textModel:'gpt-5-mini',imageModel:'gpt-image-1'})
    expect(JSON.stringify(await service.status())).not.toContain('synthetic-api-key')
  })
})
