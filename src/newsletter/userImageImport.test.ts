import {describe,expect,it} from "vitest"
import {createNewsletterDesignState} from "./rendering/designSchema"
import {upgradeNewsletterDesignStateV2} from "./rendering/designState"
import {approveAndPlaceImportedImage,inspectUserImage,registerImportedChatGptImage} from "./userImageImport"

const NOW="2026-11-16T04:00:00.000Z"
const PNG=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,4,0,0,0,4,0])
const file={name:"handwashing.png",type:"image/png",size:PNG.byteLength,arrayBuffer:async()=>PNG.buffer}

describe("ChatGPT user image import",()=>{
  it("validates bytes, MIME and dimensions without trusting the extension",async()=>{
    const imported=await inspectUserImage(file,async()=>({width:1024,height:1024}))
    expect(imported).toMatchObject({originalName:"handwashing.png",mediaType:"image/png",width:1024,height:1024,byteSize:PNG.byteLength})
    expect(imported.sha256).toMatch(/^[a-f0-9]{64}$/)
    await expect(inspectUserImage({...file,type:"image/jpeg"},async()=>({width:1024,height:1024}))).rejects.toThrow(/MIME/)
  })

  it("records a distinct ChatGPT user import as pending and does not place it automatically",async()=>{
    const base=upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:"chatgpt-import",canonicalProjectRevision:1,now:NOW}),NOW)
    const imported=await inspectUserImage(file,async()=>({width:1024,height:1024}))
    const next=registerImportedChatGptImage(base,imported,NOW)
    const asset=next.assetManifest[next.assetManifest.length-1]
    expect(asset).toMatchObject({approvalStatus:"reference-only",exportApproval:"pending",registry:{classification:"AI_GENERATED",imported:{source:"chatgpt-user-import",width:1024,height:1024}}})
    expect(next.a4Layout.modules.every(module=>module.image.assetId!==asset?.id)).toBe(true)
    expect(next.cardLayouts.every(card=>card.image.assetId!==asset?.id)).toBe(true)
  })

  it("places one reviewed image into matching A4 and topic-card slots while keeping publication pending",async()=>{
    const base=upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:"chatgpt-place",canonicalProjectRevision:1,now:NOW}),NOW)
    const imported=await inspectUserImage(file,async()=>({width:1024,height:1024}))
    const registered=registerImportedChatGptImage(base,imported,NOW)
    const assetId=registered.assetManifest[registered.assetManifest.length-1]?.id
    if(assetId===undefined)throw Error("missing imported asset")
    const next=approveAndPlaceImportedImage(registered,{assetId,topicIndex:0,now:"2026-11-16T04:01:00.000Z"})
    expect(next.assetManifest.find(asset=>asset.id===assetId)).toMatchObject({approvalStatus:"approved",exportApproval:"pending"})
    expect(next.a4Layout.modules[0]?.image.assetId).toBe(assetId)
    expect(next.cardLayouts[1]?.image.assetId).toBe(assetId)
    expect(next.cardLayouts.slice(2).every(card=>card.image.assetId!==assetId)).toBe(true)
  })
})
