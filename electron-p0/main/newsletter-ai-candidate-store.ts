import {randomUUID} from 'node:crypto'
import type {NewsletterAiAssetTarget} from '../newsletter-ai-bridge.js'
import type {NewsletterAiBaseline,NewsletterAiImageCandidate} from '../newsletter-ai-protocol.js'

export type NewsletterAiStoredCandidate=Readonly<{
  candidateId:string
  baseline:NewsletterAiBaseline
  mediaType:'image/png'|'image/jpeg'|'image/webp'
  bytesBase64:string
  sha256:string
  width:number
  height:number
  topicId:string
  target:NewsletterAiAssetTarget
  provenance?:NewsletterAiImageCandidate
}>

type CandidateRecord=Readonly<{
  ownerId:number
  sessionId:string
  connectionKey:string
  baseline:NewsletterAiBaseline
  byteSize:number
  expiresAt:number
  candidate:NewsletterAiStoredCandidate
}>

type CandidateStoreOptions=Readonly<{
  clock?:()=>number
  token?:()=>string
  ttlMs?:number
  maxCandidatesPerOwnerSession?:number
  maxBytesPerOwnerSession?:number
  maxCandidatesGlobal?:number
  maxBytesGlobal?:number
}>

function sameBaseline(left:NewsletterAiBaseline,right:NewsletterAiBaseline):boolean{
  return left.projectId===right.projectId&&left.projectRevision===right.projectRevision&&left.projectHash===right.projectHash&&left.designRevision===right.designRevision&&left.designHash===right.designHash
}

export class NewsletterAiCandidateStore{
  private readonly candidates=new Map<string,CandidateRecord>()
  private readonly clock:()=>number
  private readonly token:()=>string
  private readonly ttlMs:number
  private readonly maxCandidatesPerOwnerSession:number
  private readonly maxBytesPerOwnerSession:number
  private readonly maxCandidatesGlobal:number
  private readonly maxBytesGlobal:number

  constructor(options:CandidateStoreOptions={}){
    this.clock=options.clock??Date.now
    this.token=options.token??randomUUID
    this.ttlMs=options.ttlMs??15*60*1_000
    this.maxCandidatesPerOwnerSession=options.maxCandidatesPerOwnerSession??32
    this.maxBytesPerOwnerSession=options.maxBytesPerOwnerSession??128*1024*1024
    this.maxCandidatesGlobal=options.maxCandidatesGlobal??128
    this.maxBytesGlobal=options.maxBytesGlobal??512*1024*1024
  }

  issue(input:Readonly<{ownerId:number;sessionId:string;connectionKey:string;baseline:NewsletterAiBaseline;candidate:NewsletterAiStoredCandidate}>):string|null{
    this.sweepExpired()
    if(!sameBaseline(input.baseline,input.candidate.baseline))return null
    const byteSize=Buffer.byteLength(input.candidate.bytesBase64,'base64')
    if(byteSize===0)return null
    let ownerCount=0,ownerBytes=0,globalBytes=0
    for(const record of this.candidates.values()){
      globalBytes+=record.byteSize
      if(record.ownerId===input.ownerId&&record.sessionId===input.sessionId){ownerCount++;ownerBytes+=record.byteSize}
    }
    if(ownerCount>=this.maxCandidatesPerOwnerSession||ownerBytes+byteSize>this.maxBytesPerOwnerSession||this.candidates.size>=this.maxCandidatesGlobal||globalBytes+byteSize>this.maxBytesGlobal)return null
    const token=this.token()
    if(this.candidates.has(token))return null
    this.candidates.set(token,{ownerId:input.ownerId,sessionId:input.sessionId,connectionKey:input.connectionKey,baseline:input.baseline,byteSize,expiresAt:this.clock()+this.ttlMs,candidate:input.candidate})
    return token
  }

  peek(input:Readonly<{token:string;ownerId:number;sessionId:string;connectionKey:string;baseline:NewsletterAiBaseline}>):NewsletterAiStoredCandidate|null{
    this.sweepExpired()
    const record=this.candidates.get(input.token)
    if(record===undefined)return null
    if(record.ownerId!==input.ownerId||record.sessionId!==input.sessionId||record.connectionKey!==input.connectionKey||!sameBaseline(record.baseline,input.baseline)){this.candidates.delete(input.token);return null}
    return record.candidate
  }

  discard(token:string,ownerId:number,sessionId:string):boolean{
    const record=this.candidates.get(token)
    if(record===undefined||record.ownerId!==ownerId||record.sessionId!==sessionId)return false
    return this.candidates.delete(token)
  }

  invalidateOwner(ownerId:number):void{
    for(const [token,record] of this.candidates)if(record.ownerId===ownerId)this.candidates.delete(token)
  }

  dispose():void{this.candidates.clear()}
  size():number{return this.candidates.size}

  private sweepExpired():void{
    const now=this.clock()
    for(const [token,record] of this.candidates)if(record.expiresAt<=now)this.candidates.delete(token)
  }
}
