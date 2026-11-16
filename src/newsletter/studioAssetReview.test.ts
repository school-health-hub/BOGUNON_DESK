import {expect,it} from "vitest"
import {createNewsletterProject} from "./project"
import {createNewsletterDesignState} from "./rendering/designSchema"
import {upgradeNewsletterDesignStateV2} from "./rendering/designState"
import {inspectUserImage,registerImportedChatGptImage} from "./userImageImport"
import {addStudioAssetFiles,createStudioAssetResolver,parseStudioDocument,serializeStudioDocument} from "./studioDocument"
import {assetExportPending,resolveDesignAssets} from "./rendering/assetResolution"
const now="2026-11-16T04:00:00.000Z"
const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,4,0,0,0,4,0])
const file={name:"synthetic.png",type:"image/png",size:bytes.length,arrayBuffer:async()=>bytes.buffer}
async function fixture(){
 const project=await createNewsletterProject({projectId:"review-reconnect",title:"검토 문서",now})
 const base=upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now}),now)
 const image=await inspectUserImage(file,async()=>({width:1024,height:1024}))
 const registered=registerImportedChatGptImage(base,image,now)
 const cards=registered.cardLayouts.map((card,index)=>index===1?{...card,image:{...card.image,assetId:image.assetId}}:card)
 const design={...registered,cardLayouts:cards,revisionHistory:registered.revisionHistory.map(entry=>entry.revision===registered.designRevision?{...entry,snapshot:{...entry.snapshot,cardLayouts:cards}}:entry)}
 return {project,design}
}
it("reconnects matching reference-only bytes only for review without changing the document or publication barrier",async()=>{
 const doc=await fixture(),before=serializeStudioDocument(doc)
 await expect(addStudioAssetFiles(doc.design,new Map(),[file])).rejects.toThrow(/렌더 승인/)
 const connected=await addStudioAssetFiles(doc.design,new Map(),[file],{purpose:"review"})
 expect(connected.size).toBe(1)
 expect(serializeStudioDocument(doc)).toBe(before)
 const resolver=createStudioAssetResolver(doc.design,connected)
 expect((await resolveDesignAssets(doc.design,doc.design.designRevision,resolver,{allowPendingReview:true})).size).toBe(1)
 await expect(resolveDesignAssets(doc.design,doc.design.designRevision,resolver)).rejects.toThrow(/approval/)
 expect(doc.design.assetManifest.every(asset=>asset.approvalStatus==="reference-only"&&assetExportPending(asset))).toBe(true)
 const reopened=parseStudioDocument(JSON.parse(before))
 expect(reopened).toEqual(doc)
 await expect(createStudioAssetResolver(reopened.design,new Map()).resolve(`asset:${doc.design.assetManifest[0]?.sha256}`)).rejects.toThrow(/다시 선택/)
})
it("rejects changed bytes atomically and preserves previously connected bytes",async()=>{
 const doc=await fixture(),existing=new Map([["keep",new Uint8Array([7])]])
 await expect(addStudioAssetFiles(doc.design,existing,[file,{name:file.name,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer}],{purpose:"review"})).rejects.toThrow(/원장에 없는/)
 expect([...existing.keys()]).toEqual(["keep"])
})
it("keeps approved reconnection working and rejects invalid references or non-renderable references",async()=>{
 const doc=await fixture()
 const approved={...doc.design,assetManifest:doc.design.assetManifest.map(asset=>({...asset,approvalStatus:"approved" as const}))}
 expect((await addStudioAssetFiles(approved,new Map(),[file])).size).toBe(1)
 const invalid={...doc.design,assetManifest:doc.design.assetManifest.map(asset=>({...asset,localReference:"asset:"+"0".repeat(64)}))}
 await expect(addStudioAssetFiles(invalid,new Map(),[file],{purpose:"review"})).rejects.toThrow()
 const official={...doc.design,assetManifest:doc.design.assetManifest.map(asset=>({...asset,registry:{classification:"OFFICIAL_REFERENCE" as const,purpose:"reference" as const,usageScope:"layout-comparison-only" as const}}))}
 await expect(addStudioAssetFiles(official,new Map(),[file],{purpose:"review"})).rejects.toThrow()
})

