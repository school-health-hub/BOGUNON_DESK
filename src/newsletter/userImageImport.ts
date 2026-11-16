import {parseNewsletterDesignStateV2,type NewsletterDesignStateV2} from "./rendering/designSchema"

const MAX_BYTES=20*1024*1024
const MAX_PIXELS=33_554_432
const mediaTypes=["image/png","image/jpeg","image/webp"] as const
type MediaType=typeof mediaTypes[number]
type ImageFile={readonly name:string;readonly type:string;readonly size:number;arrayBuffer():Promise<ArrayBuffer>}
type Decode=(bytes:Uint8Array,mediaType:MediaType)=>Promise<Readonly<{width:number;height:number}>>
export type ImportedUserImage=Readonly<{assetId:string;originalName:string;mediaType:MediaType;sha256:string;width:number;height:number;byteSize:number;bytes:Uint8Array}>

const matches=(bytes:Uint8Array,type:MediaType):boolean=>type==="image/png"
  ? bytes.length>=24&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)
  : type==="image/jpeg"
    ? bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9
    : bytes.length>=16&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP"

const defaultDecode:Decode=async(bytes,mediaType)=>{
  const bitmap=await createImageBitmap(new Blob([bytes.slice().buffer],{type:mediaType}))
  try{return{width:bitmap.width,height:bitmap.height}}finally{bitmap.close()}
}
const digest=async(bytes:Uint8Array):Promise<string>=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes.slice().buffer))].map(value=>value.toString(16).padStart(2,"0")).join("")
const snapshot=(design:NewsletterDesignStateV2)=>({designSchemaVersion:2 as const,canonicalProjectRevision:design.canonicalProjectRevision,templateId:design.templateId,templateVersion:design.templateVersion,publicationMeta:design.publicationMeta,assetManifest:design.assetManifest,a4Layout:design.a4Layout,cardLayouts:design.cardLayouts})

export async function inspectUserImage(file:ImageFile,decode:Decode=defaultDecode):Promise<ImportedUserImage>{
  if(!mediaTypes.includes(file.type as MediaType))throw Error("PNG, JPEG 또는 WebP 이미지를 선택해 주세요.")
  if(file.size<=0||file.size>MAX_BYTES)throw Error("이미지 파일 크기를 확인해 주세요.")
  const mediaType=file.type as MediaType,bytes=new Uint8Array(await file.arrayBuffer())
  if(bytes.byteLength!==file.size||!matches(bytes,mediaType))throw Error("파일 바이트와 MIME 형식이 일치하지 않습니다.")
  const {width,height}=await decode(bytes,mediaType)
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<64||height<64||width>8192||height>8192||width*height>MAX_PIXELS)throw Error("이미지 해상도를 확인해 주세요.")
  const sha256=await digest(bytes)
  return{assetId:`chatgpt-import-${sha256.slice(0,16)}`,originalName:file.name,mediaType,sha256,width,height,byteSize:bytes.byteLength,bytes}
}

export function registerImportedChatGptImage(design:NewsletterDesignStateV2,image:ImportedUserImage,now:string):NewsletterDesignStateV2{
  const existing=design.assetManifest.find(asset=>asset.sha256===image.sha256)
  if(existing!==undefined)return design
  const asset={id:image.assetId,sha256:image.sha256,mediaType:image.mediaType,approvalStatus:"reference-only" as const,exportApproval:"pending" as const,originalName:image.originalName,localReference:`asset:${image.sha256}` as const,registry:{classification:"AI_GENERATED" as const,purpose:"illustration" as const,usageScope:"newsletter-output" as const,imported:{source:"chatgpt-user-import" as const,importedAt:now,width:image.width,height:image.height}}}
  const next={...design,assetManifest:[...design.assetManifest,asset]}
  const revision=design.designRevision+1,current=snapshot(next)
  return parseNewsletterDesignStateV2({...next,designRevision:revision,revisionHistory:[...design.revisionHistory,{revision,createdAt:now,changedPageIds:[],snapshotVersion:2 as const,snapshot:current}]})
}

export function approveAndPlaceImportedImage(design:NewsletterDesignStateV2,input:Readonly<{assetId:string;topicIndex:number;now:string}>):NewsletterDesignStateV2{
  const asset=design.assetManifest.find(value=>value.id===input.assetId)
  if(asset?.registry?.classification!=="AI_GENERATED"||asset.registry.imported?.source!=="chatgpt-user-import"||asset.exportApproval!=="pending")throw Error("ChatGPT 사용자 가져오기 자산을 다시 확인해 주세요.")
  const module=design.a4Layout.modules[input.topicIndex],card=design.cardLayouts[input.topicIndex+1]
  if(module===undefined||card===undefined)throw Error("배치할 주제를 다시 확인해 주세요.")
  const manifest=design.assetManifest.map(value=>value.id===input.assetId?{...value,approvalStatus:"approved" as const}:value)
  const a4Layout={...design.a4Layout,modules:design.a4Layout.modules.map((value,index)=>index===input.topicIndex?{...value,image:{...value.image,assetId:input.assetId,visible:true}}:value)}
  const cardLayouts=design.cardLayouts.map((value,index)=>index===input.topicIndex+1?{...value,image:{...value.image,assetId:input.assetId,visible:true},...(value.editorial===undefined?{}:{editorial:{...value.editorial,foregroundMask:undefined}})}:value)
  const next={...design,assetManifest:manifest,a4Layout,cardLayouts},revision=design.designRevision+1,current=snapshot(next)
  return parseNewsletterDesignStateV2({...next,designRevision:revision,revisionHistory:[...design.revisionHistory,{revision,createdAt:input.now,changedPageIds:["a4-page",card.pageId],snapshotVersion:2 as const,snapshot:current}]})
}
