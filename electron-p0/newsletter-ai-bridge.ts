import type {IpcResult} from './protocol.js'
import type {NewsletterAiBaseline,NewsletterAiImageCandidate,NewsletterAiTextResult} from './newsletter-ai-protocol.js'

export type NewsletterAiStatus=Readonly<{
  connected:boolean
  provider:'openai'|'gemini'|'mock'|null
  textModel:string|null
  imageModel:string|null
  textAvailable:boolean
  imageAvailable:boolean
  textUnavailableReason:string|null
  imageUnavailableReason:string|null
}>

export type NewsletterAiTextRequest=Readonly<{
  baseline:NewsletterAiBaseline
  month:number
  schoolType:'girls'|'boys'|'coeducational'
  requestId:string
  brief:string
  regenerate?:Readonly<{proposalId:string;targetTopicId:string;proposalHash:string;topicHash:string}>
}>

export type NewsletterAiImageRequest=Readonly<{
  baseline:NewsletterAiBaseline
  requestId:string
  topicId:string
  target:NewsletterAiAssetTarget
  prompt:string
  provider:'openai'|'gemini'|'mock'
  model:string
  referenceTokens:readonly string[]
}>
export type NewsletterAiAssetTarget=Readonly<{kind:'cover'}>|Readonly<{kind:'topic';topicId:string}>|Readonly<{kind:'action';topicId:string;actionIndex:0|1|2|3}>

export type NewsletterAiCancelRequest=Readonly<{requestId:string}>
export type NewsletterAiCandidateRequest=Readonly<{candidateToken:string}>
export type NewsletterAiPreviewRequest=Readonly<{candidateToken:string;baseline:NewsletterAiBaseline}>
export type NewsletterAiCommitAssetRequest=Readonly<{candidateToken:string;baseline:NewsletterAiBaseline;documentBaseline?:NewsletterAiBaseline;projectId:string}>
export type NewsletterAiCommitAssetsRequest=Readonly<{candidateTokens:readonly string[];baseline:NewsletterAiBaseline;documentBaseline?:NewsletterAiBaseline;projectId:string}>
export type NewsletterAiLoadAssetsRequest=Readonly<{projectId:string;baseline:NewsletterAiBaseline;sha256:readonly string[]}>
export type NewsletterAiLoadedAsset=Readonly<{sha256:string;bytesBase64:string}>
export type NewsletterAiCandidateMetadata=Readonly<{
  candidateId:string
  baseline:NewsletterAiBaseline
  mediaType:'image/png'|'image/jpeg'|'image/webp'
  sha256:string
  width:number
  height:number
  topicId:string
  target:NewsletterAiAssetTarget
  provenance?:NewsletterAiImageCandidate
}>
export type NewsletterAiCandidateResult=Readonly<{candidateToken:string;candidate:NewsletterAiCandidateMetadata}>
export type NewsletterAiCandidatePreview=NewsletterAiCandidateMetadata&Readonly<{candidateToken:string;bytesBase64:string}>

export type NewsletterAiBridge=Readonly<{
  status():Promise<IpcResult<NewsletterAiStatus>>
  proposeText(request:NewsletterAiTextRequest):Promise<IpcResult<NewsletterAiTextResult>>
  generateImageCandidate(request:NewsletterAiImageRequest):Promise<IpcResult<NewsletterAiCandidateResult>>
  cancel(request:NewsletterAiCancelRequest):Promise<IpcResult<null>>
  discardCandidate(request:NewsletterAiCandidateRequest):Promise<IpcResult<null>>
  previewCandidate(request:NewsletterAiPreviewRequest):Promise<IpcResult<NewsletterAiCandidatePreview>>
  commitCandidateAsset(request:NewsletterAiCommitAssetRequest):Promise<IpcResult<null>>
  commitCandidateAssets(request:NewsletterAiCommitAssetsRequest):Promise<IpcResult<null>>
  loadProjectAssets(request:NewsletterAiLoadAssetsRequest):Promise<IpcResult<readonly NewsletterAiLoadedAsset[]>>
}>
