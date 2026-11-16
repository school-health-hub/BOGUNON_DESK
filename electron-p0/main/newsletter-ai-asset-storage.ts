import {createHash} from 'node:crypto'
import {lstat,mkdir,readFile,realpath,rename,rm,stat,writeFile} from 'node:fs/promises'
import {isAbsolute,join,relative} from 'node:path'
import type {NewsletterAiBaseline} from '../newsletter-ai-protocol.js'

const PROJECT_ID=/^[a-z0-9][a-z0-9-]{0,127}$/
const SHA256=/^[a-f0-9]{64}$/
const EXTENSIONS={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'} as const
export const NEWSLETTER_AI_ASSET_LIMITS={maxCount:16,maxAssetBytes:12*1024*1024,maxAggregateBytes:32*1024*1024} as const
type MediaType=keyof typeof EXTENSIONS
type SaveInput=Readonly<{projectId:string;sha256:string;mediaType:MediaType;bytesBase64:string}>
type LoadInput=Readonly<{projectId:string;sha256:string;baseline:NewsletterAiBaseline}>
type BatchLoadInput=Readonly<{projectId:string;sha256:readonly string[];baseline:NewsletterAiBaseline}>

export class NewsletterAiAssetStorageError extends Error{readonly name='NewsletterAiAssetStorageError'}
function parseIdentity(projectId:string,sha256:string):void{if(!PROJECT_ID.test(projectId)||!SHA256.test(sha256))throw new NewsletterAiAssetStorageError('Invalid Newsletter AI asset identity')}
function decodedSize(value:string):number{
  if(value.length===0||value.length%4!==0)throw new NewsletterAiAssetStorageError('Invalid Newsletter AI asset encoding')
  const padding=value.endsWith('==')?2:value.endsWith('=')?1:0,contentLength=value.length-padding
  for(let index=0;index<value.length;index+=1){const code=value.charCodeAt(index),isAlphabet=code>=65&&code<=90||code>=97&&code<=122,isDigit=code>=48&&code<=57,isSymbol=code===43||code===47,isPadding=code===61&&index>=contentLength;if(!isAlphabet&&!isDigit&&!isSymbol&&!isPadding)throw new NewsletterAiAssetStorageError('Invalid Newsletter AI asset encoding')}
  return value.length/4*3-padding
}
function inside(parent:string,child:string):boolean{const path=relative(parent,child);return path===''||(!path.startsWith('..')&&!isAbsolute(path))}

export class NewsletterAiAssetStorage{
  constructor(private readonly root:string){}
  private async safeProject(projectId:string,create:boolean):Promise<string>{
    if(!PROJECT_ID.test(projectId))throw new NewsletterAiAssetStorageError('Invalid Newsletter AI asset identity')
    if(create)await mkdir(this.root,{recursive:true})
    const rootInfo=await lstat(this.root)
    if(rootInfo.isSymbolicLink()||!rootInfo.isDirectory())throw new NewsletterAiAssetStorageError('Unsafe Newsletter AI asset path')
    const rootPath=await realpath(this.root),project=join(this.root,projectId)
    if(create)await mkdir(project,{recursive:true})
    const projectInfo=await lstat(project)
    if(projectInfo.isSymbolicLink()||!projectInfo.isDirectory())throw new NewsletterAiAssetStorageError('Unsafe Newsletter AI asset path')
    const projectPath=await realpath(project)
    if(!inside(rootPath,projectPath))throw new NewsletterAiAssetStorageError('Unsafe Newsletter AI asset path')
    return projectPath
  }
  async save(input:SaveInput,baseline:NewsletterAiBaseline):Promise<void>{await this.saveBatch([input],baseline)}
  async saveBatch(inputs:readonly SaveInput[],baseline:NewsletterAiBaseline):Promise<void>{
    if(inputs.length<1||inputs.length>NEWSLETTER_AI_ASSET_LIMITS.maxCount)throw new NewsletterAiAssetStorageError('Newsletter AI asset batch limit exceeded')
    let aggregate=0
    for(const input of inputs){parseIdentity(input.projectId,input.sha256);if(input.projectId!==baseline.projectId)throw new NewsletterAiAssetStorageError('Newsletter AI asset authority mismatch');const size=decodedSize(input.bytesBase64);if(size>NEWSLETTER_AI_ASSET_LIMITS.maxAssetBytes)throw new NewsletterAiAssetStorageError('Newsletter AI asset size limit exceeded');aggregate+=size}
    if(aggregate>NEWSLETTER_AI_ASSET_LIMITS.maxAggregateBytes)throw new NewsletterAiAssetStorageError('Newsletter AI asset aggregate limit exceeded')
    const project=await this.safeProject(baseline.projectId,true)
    const prepared=inputs.map((input,index)=>{const bytes=Buffer.from(input.bytesBase64,'base64');if(createHash('sha256').update(bytes).digest('hex')!==input.sha256)throw new NewsletterAiAssetStorageError('Newsletter AI asset hash mismatch');const destination=join(project,`${input.sha256}.${EXTENSIONS[input.mediaType]}`);return{bytes,destination,sha256:input.sha256,temporary:`${destination}.${process.pid}.${index}.tmp`}})
    const staged:string[]=[],created:string[]=[]
    try{
      for(const item of prepared){await writeFile(item.temporary,item.bytes,{flag:'wx'});staged.push(item.temporary)}
      for(const item of prepared){let exists=true;try{const info=await lstat(item.destination);if(info.isSymbolicLink()||!info.isFile())throw new NewsletterAiAssetStorageError('Unsafe Newsletter AI asset path')}catch(error){if(error instanceof Error&&'code' in error&&error.code==='ENOENT')exists=false;else throw error}if(exists){const current=await readFile(item.destination);if(createHash('sha256').update(current).digest('hex')!==item.sha256)throw new NewsletterAiAssetStorageError('Newsletter AI asset hash mismatch');continue}await rename(item.temporary,item.destination);staged.splice(staged.indexOf(item.temporary),1);created.push(item.destination)}
      for(const sha256 of [...new Set(inputs.map(input=>input.sha256))].sort()){
        const grant=join(project,`.grant-${sha256}`),temporary=`${grant}.${process.pid}.tmp`
        let exists=true
        try{const info=await lstat(grant);if(info.isSymbolicLink()||!info.isFile())throw new NewsletterAiAssetStorageError('Unsafe Newsletter AI asset path')}catch(error){if(error instanceof Error&&'code' in error&&error.code==='ENOENT')exists=false;else throw error}
        if(exists)continue
        await writeFile(temporary,'authorized',{flag:'wx'});staged.push(temporary);await rename(temporary,grant);staged.splice(staged.indexOf(temporary),1);created.push(grant)
      }
    }catch(error){await Promise.all([...staged,...created].map(path=>rm(path,{force:true})));throw error}
    await Promise.all(staged.map(path=>rm(path,{force:true})))
  }
  async load(input:LoadInput):Promise<string>{const result=await this.loadBatch({projectId:input.projectId,sha256:[input.sha256],baseline:input.baseline});const first=result[0];if(first===undefined)throw new NewsletterAiAssetStorageError('Newsletter AI asset not found');return first.bytesBase64}
  async loadBatch(input:BatchLoadInput):Promise<readonly Readonly<{sha256:string;bytesBase64:string}>[]>{
    if(input.sha256.length>NEWSLETTER_AI_ASSET_LIMITS.maxCount)throw new NewsletterAiAssetStorageError('Newsletter AI asset batch limit exceeded')
    for(const sha of input.sha256)parseIdentity(input.projectId,sha)
    if(input.projectId!==input.baseline.projectId)throw new NewsletterAiAssetStorageError('Newsletter AI asset authority mismatch')
    const project=await this.safeProject(input.projectId,false)
    for(const sha256 of input.sha256){const grant=join(project,`.grant-${sha256}`);try{const info=await lstat(grant);if(info.isSymbolicLink()||!info.isFile())throw new NewsletterAiAssetStorageError('Unsafe Newsletter AI asset path')}catch(error){if(error instanceof Error&&'code' in error&&error.code==='ENOENT')throw new NewsletterAiAssetStorageError('Newsletter AI asset authority mismatch');throw error}}
    const found:Readonly<{sha256:string;path:string;size:number}>[]=[]
    for(const sha256 of input.sha256){let match:Readonly<{path:string;size:number}>|undefined;for(const extension of Object.values(EXTENSIONS)){const path=join(project,`${sha256}.${extension}`);try{const info=await lstat(path);if(info.isSymbolicLink()||!info.isFile())throw new NewsletterAiAssetStorageError('Unsafe Newsletter AI asset path');const canonical=await realpath(path);if(!inside(project,canonical))throw new NewsletterAiAssetStorageError('Unsafe Newsletter AI asset path');match={path:canonical,size:(await stat(canonical)).size};break}catch(error){if(error instanceof Error&&'code' in error&&error.code==='ENOENT')continue;throw error}}if(match===undefined)throw new NewsletterAiAssetStorageError('Newsletter AI asset not found');if(match.size>NEWSLETTER_AI_ASSET_LIMITS.maxAssetBytes)throw new NewsletterAiAssetStorageError('Newsletter AI asset size limit exceeded');found.push({sha256,...match})}
    if(found.reduce((sum,item)=>sum+item.size,0)>NEWSLETTER_AI_ASSET_LIMITS.maxAggregateBytes)throw new NewsletterAiAssetStorageError('Newsletter AI asset aggregate limit exceeded')
    return Promise.all(found.map(async item=>{const bytes=await readFile(item.path);if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new NewsletterAiAssetStorageError('Newsletter AI asset hash mismatch');return{sha256:item.sha256,bytesBase64:bytes.toString('base64')}}))
  }
}
