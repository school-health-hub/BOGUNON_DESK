import {z} from 'zod'
import {assertSender} from './policy.js'
import {newsletterAiBaselineSchema} from '../newsletter-ai-protocol.js'
import type {IpcResult} from '../protocol.js'
import type {NewsletterAiCandidatePreview,NewsletterAiCandidateResult,NewsletterAiImageRequest,NewsletterAiStatus,NewsletterAiTextRequest} from '../newsletter-ai-bridge.js'
import type {NewsletterAiCandidateStore,NewsletterAiStoredCandidate} from './newsletter-ai-candidate-store.js'
import type {NewsletterAiAssetStorage} from './newsletter-ai-asset-storage.js'

export const NEWSLETTER_AI_ACTIONS=['status','proposeText','generateImageCandidate','cancel','discardCandidate','previewCandidate','commitCandidateAsset','commitCandidateAssets','loadProjectAssets'] as const
export type NewsletterAiAction=typeof NEWSLETTER_AI_ACTIONS[number]

const identifier=z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/)
const provider=z.enum(['openai','gemini','mock'])
const assetTarget=z.discriminatedUnion('kind',[z.object({kind:z.literal('cover')}).strict(),z.object({kind:z.literal('topic'),topicId:identifier}).strict(),z.object({kind:z.literal('action'),topicId:identifier,actionIndex:z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3)])}).strict()])
const textRequestSchema=z.object({
  baseline:newsletterAiBaselineSchema,
  month:z.number().int().min(1).max(12),
  schoolType:z.enum(['girls','boys','coeducational']),
  requestId:identifier,
  brief:z.string().trim().min(1).max(4_000),
  regenerate:z.object({proposalId:identifier,targetTopicId:identifier,proposalHash:z.string().regex(/^[a-f0-9]{64}$/),topicHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict().readonly().optional(),
}).strict().readonly()
const imageRequestSchema=z.object({
  baseline:newsletterAiBaselineSchema,
  requestId:identifier,
  topicId:identifier,
  target:assetTarget,
  prompt:z.string().trim().min(1).max(20_000),
  provider,
  model:z.string().trim().min(1).max(200),
  referenceTokens:z.array(z.string().min(16).max(200)).max(32).readonly(),
}).strict().superRefine((request,context)=>{if(request.target.kind!=='cover'&&request.target.topicId!==request.topicId)context.addIssue({code:'custom',message:'target topic must match request topic'})}).readonly()
const cancelRequestSchema=z.object({requestId:identifier}).strict().readonly()
const candidateRequestSchema=z.object({candidateToken:z.string().min(16).max(200)}).strict().readonly()
const previewRequestSchema=z.object({candidateToken:z.string().min(16).max(200),baseline:newsletterAiBaselineSchema}).strict().readonly()
const commitRequestSchema=z.object({candidateToken:z.string().min(16).max(200),baseline:newsletterAiBaselineSchema,documentBaseline:newsletterAiBaselineSchema.optional(),projectId:identifier}).strict().readonly()
const commitBatchRequestSchema=z.object({candidateTokens:z.array(z.string().min(16).max(200)).min(1).max(16).refine(tokens=>new Set(tokens).size===tokens.length).readonly(),baseline:newsletterAiBaselineSchema,documentBaseline:newsletterAiBaselineSchema.optional(),projectId:identifier}).strict().readonly()
const loadRequestSchema=z.object({projectId:identifier,baseline:newsletterAiBaselineSchema,sha256:z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(16).readonly()}).strict().readonly()

export interface NewsletterAiIpcService{
  status():Promise<NewsletterAiStatus>
  proposeText(request:NewsletterAiTextRequest):Promise<unknown>
  generateImageCandidate(request:NewsletterAiImageRequest,references:readonly NewsletterAiStoredCandidate[]):Promise<Omit<NewsletterAiStoredCandidate,'topicId'|'target'>>
  cancel(request:Readonly<{requestId:string}>):Promise<void>
}

type SenderContents=Readonly<{id:number;mainFrame:unknown;getURL():string}>
type SenderEvent=Readonly<{sender:unknown;senderFrame:unknown}>
export class NewsletterAiProjectAuthority{
  private readonly projects=new Map<string,Set<string>>()
  grant(ownerId:number,sessionId:string,projectId:string):void{const key=`${ownerId}:${sessionId}`,current=this.projects.get(key)??new Set<string>();current.add(projectId);this.projects.set(key,current)}
  allows(ownerId:number,sessionId:string,projectId:string):boolean{return this.projects.get(`${ownerId}:${sessionId}`)?.has(projectId)===true}
  disposeOwner(ownerId:number):void{for(const key of this.projects.keys())if(key.startsWith(`${ownerId}:`))this.projects.delete(key)}
}
type NewsletterAiHandlerOptions=Readonly<{action:NewsletterAiAction;contents:SenderContents;url:string;service:NewsletterAiIpcService;store:NewsletterAiCandidateStore;assets?:NewsletterAiAssetStorage;authority?:NewsletterAiProjectAuthority;sessionId:string}>

const invalidInput=():IpcResult<never>=>({ok:false,error:{code:'INVALID_INPUT',message:'Newsletter AI 요청 형식을 확인해 주세요.',retryable:false}})
const forbidden=():IpcResult<never>=>({ok:false,error:{code:'FORBIDDEN',message:'허용되지 않은 Newsletter AI 호출입니다.',retryable:false}})
const conflict=():IpcResult<never>=>({ok:false,error:{code:'CONFLICT',message:'후보가 만료되었거나 현재 원고 기준과 일치하지 않습니다.',retryable:false}})
const internalError=():IpcResult<never>=>({ok:false,error:{code:'INTERNAL_ERROR',message:'Newsletter AI 요청을 완료하지 못했습니다.',retryable:true}})

function singleArgument(args:readonly unknown[]):unknown{
  if(args.length!==1)throw new TypeError('Invalid Newsletter AI request arity')
  return args[0]
}

function candidateMetadata(candidate:NewsletterAiStoredCandidate):Omit<NewsletterAiStoredCandidate,'bytesBase64'>{
  const {bytesBase64:_,...metadata}=candidate
  return metadata
}

export function createNewsletterAiHandler(options:NewsletterAiHandlerOptions){
  return async(event:SenderEvent,...args:unknown[]):Promise<IpcResult<unknown>>=>{
    try{assertSender(event,options.contents,options.url)}catch{return forbidden()}
    try{
      switch(options.action){
        case 'status':{
          if(args.length!==0)return invalidInput()
          return {ok:true,data:await options.service.status()}
        }
        case 'proposeText':{
          const request=textRequestSchema.parse(singleArgument(args))
          return {ok:true,data:await options.service.proposeText(request)}
        }
        case 'generateImageCandidate':{
          const request=imageRequestSchema.parse(singleArgument(args))
          const connectionKey=`${request.provider}:${request.model}`
          const references:NewsletterAiStoredCandidate[]=[]
          for(const token of request.referenceTokens){const reference=options.store.peek({token,ownerId:options.contents.id,sessionId:options.sessionId,connectionKey,baseline:request.baseline});if(reference===null)return conflict();references.push(reference)}
          const generated=await options.service.generateImageCandidate(request,references)
          const candidate:NewsletterAiStoredCandidate={...generated,topicId:request.topicId,target:request.target}
          const candidateToken=options.store.issue({ownerId:options.contents.id,sessionId:options.sessionId,connectionKey,baseline:request.baseline,candidate})
          if(candidateToken===null)return conflict()
          options.authority?.grant(options.contents.id,options.sessionId,request.baseline.projectId)
          const data:NewsletterAiCandidateResult={candidateToken,candidate:candidateMetadata(candidate)}
          return {ok:true,data}
        }
        case 'cancel':{
          const request=cancelRequestSchema.parse(singleArgument(args))
          await options.service.cancel(request)
          return {ok:true,data:null}
        }
        case 'discardCandidate':{
          const request=candidateRequestSchema.parse(singleArgument(args))
          return options.store.discard(request.candidateToken,options.contents.id,options.sessionId)?{ok:true,data:null}:conflict()
        }
        case 'previewCandidate':{
          const request=previewRequestSchema.parse(singleArgument(args))
          const status=await options.service.status()
          const connectionKey=status.connected&&status.provider!==null&&status.imageModel!==null?`${status.provider}:${status.imageModel}`:'disconnected'
          const candidate=options.store.peek({token:request.candidateToken,ownerId:options.contents.id,sessionId:options.sessionId,connectionKey,baseline:request.baseline})
          if(candidate===null)return conflict()
          const data:NewsletterAiCandidatePreview={candidateToken:request.candidateToken,...candidate}
          return {ok:true,data}
        }
        case 'commitCandidateAsset':{
          if(options.assets===undefined)return internalError()
          const request=commitRequestSchema.parse(singleArgument(args))
          if(options.authority?.allows(options.contents.id,options.sessionId,request.projectId)!==true)return forbidden()
          const documentBaseline=request.documentBaseline??request.baseline
          if(request.projectId!==request.baseline.projectId||request.projectId!==documentBaseline.projectId)return conflict()
          const status=await options.service.status()
          const connectionKey=status.connected&&status.provider!==null&&status.imageModel!==null?`${status.provider}:${status.imageModel}`:'disconnected'
          const candidate=options.store.peek({token:request.candidateToken,ownerId:options.contents.id,sessionId:options.sessionId,connectionKey,baseline:request.baseline})
          if(candidate===null)return conflict()
          await options.assets.save({projectId:request.projectId,sha256:candidate.sha256,mediaType:candidate.mediaType,bytesBase64:candidate.bytesBase64},documentBaseline)
          return {ok:true,data:null}
        }
        case 'commitCandidateAssets':{
          if(options.assets===undefined)return internalError()
          const request=commitBatchRequestSchema.parse(singleArgument(args))
          if(options.authority?.allows(options.contents.id,options.sessionId,request.projectId)!==true)return forbidden()
          const documentBaseline=request.documentBaseline??request.baseline
          if(request.projectId!==request.baseline.projectId||request.projectId!==documentBaseline.projectId)return conflict()
          const status=await options.service.status()
          const connectionKey=status.connected&&status.provider!==null&&status.imageModel!==null?`${status.provider}:${status.imageModel}`:'disconnected'
          const candidates=[],targets=new Set<string>()
          for(const token of request.candidateTokens){const candidate=options.store.peek({token,ownerId:options.contents.id,sessionId:options.sessionId,connectionKey,baseline:request.baseline});if(candidate===null)return conflict();const target=candidate.target,targetId=target.kind==='cover'?'cover':target.kind==='topic'?`topic:${target.topicId}`:`action:${target.topicId}:${target.actionIndex}`;if(targets.has(targetId))return conflict();targets.add(targetId);candidates.push(candidate)}
          await options.assets.saveBatch(candidates.map(candidate=>({projectId:request.projectId,sha256:candidate.sha256,mediaType:candidate.mediaType,bytesBase64:candidate.bytesBase64})),documentBaseline)
          return {ok:true,data:null}
        }
        case 'loadProjectAssets':{
          if(options.assets===undefined)return internalError()
          const request=loadRequestSchema.parse(singleArgument(args))
          if(options.authority?.allows(options.contents.id,options.sessionId,request.projectId)!==true)return forbidden()
          const data=await options.assets.loadBatch(request)
          return {ok:true,data}
        }
      }
    }catch(error){
      if(error instanceof z.ZodError||error instanceof TypeError)return invalidInput()
      return internalError()
    }
  }
}
