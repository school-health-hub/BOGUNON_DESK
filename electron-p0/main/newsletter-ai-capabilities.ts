import type {AiModel,AiProvider} from '../protocol.js'
import type {NewsletterAiProviderCapability} from '../newsletter-ai-protocol.js'

export type NewsletterCapabilityKind='text'|'image'
export type NewsletterCapabilitySelection=Readonly<{
  provider:AiProvider
  textModel:string|null
  imageModel:string|null
  textModels:readonly AiModel[]
  imageModels:readonly AiModel[]
}>

const DISABLED_TEXT=Object.freeze({generate:false,structuredOutput:false,maxInputBytes:0})
const DISABLED_IMAGE=Object.freeze({generate:false,edit:false,referenceInput:false,maxInputBytes:0,maxOutputBytes:0,maxDimension:0})
const STRUCTURED_TEXT=Object.freeze({generate:true,structuredOutput:true,maxInputBytes:65_536})
const GENERATED_IMAGE=Object.freeze({generate:true,edit:true,referenceInput:true,maxInputBytes:100_000_000,maxOutputBytes:100_000_000,maxDimension:8_192})

const CAPABILITIES:Readonly<Record<AiProvider,Readonly<Record<string,Readonly<{text:NewsletterAiProviderCapability['text'];image:NewsletterAiProviderCapability['image']}>>>>>=Object.freeze({
  openai:Object.freeze({
    'gpt-5':Object.freeze({text:STRUCTURED_TEXT,image:DISABLED_IMAGE}),
    'gpt-5-mini':Object.freeze({text:STRUCTURED_TEXT,image:DISABLED_IMAGE}),
    'gpt-image-1':Object.freeze({text:DISABLED_TEXT,image:GENERATED_IMAGE}),
    'gpt-image-1.5':Object.freeze({text:DISABLED_TEXT,image:GENERATED_IMAGE}),
  }),
  gemini:Object.freeze({
    'gemini-2.5-pro':Object.freeze({text:STRUCTURED_TEXT,image:DISABLED_IMAGE}),
    'gemini-2.5-flash':Object.freeze({text:STRUCTURED_TEXT,image:DISABLED_IMAGE}),
    'gemini-2.5-flash-image':Object.freeze({text:DISABLED_TEXT,image:GENERATED_IMAGE}),
    'gemini-3-pro-image-preview':Object.freeze({text:DISABLED_TEXT,image:GENERATED_IMAGE}),
  }),
})

export function getNewsletterModelCapability(provider:AiProvider,model:string):NewsletterAiProviderCapability{
  const capability=CAPABILITIES[provider][model]
  return {provider,model,text:capability?.text??DISABLED_TEXT,image:capability?.image??DISABLED_IMAGE}
}

export function buildNewsletterCapabilitySelection(
  provider:AiProvider,
  discoveredModels:readonly AiModel[],
  restored:Readonly<{textModel:string|null;imageModel:string|null}>|null,
):NewsletterCapabilitySelection{
  const textModels=discoveredModels.filter(model=>getNewsletterModelCapability(provider,model.id).text.structuredOutput)
  const imageModels=discoveredModels.filter(model=>getNewsletterModelCapability(provider,model.id).image.generate)
  const restoredText=restored?.textModel??null
  const restoredImage=restored?.imageModel??null
  return {
    provider,
    textModel:textModels.some(model=>model.id===restoredText)?restoredText:textModels[0]?.id??null,
    imageModel:imageModels.some(model=>model.id===restoredImage)?restoredImage:imageModels[0]?.id??null,
    textModels,
    imageModels,
  }
}

export function selectNewsletterCapabilityModel(
  current:NewsletterCapabilitySelection,
  kind:NewsletterCapabilityKind,
  model:string,
):NewsletterCapabilitySelection{
  const supported=kind==='text'?current.textModels:current.imageModels
  if(!supported.some(candidate=>candidate.id===model))throw new Error('선택한 모델은 이 기능을 지원하지 않습니다.')
  return kind==='text'?{...current,textModel:model}:{...current,imageModel:model}
}
