import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {parseStudioDocument} from '../../src/newsletter/studioDocument'
import {createNewsletterProject} from '../../src/newsletter/project'
import {createNewsletterDesignState,parseNewsletterDesignStateV2} from '../../src/newsletter/rendering/designSchema'
import {upgradeNewsletterDesignStateV2,updateCardLayout} from '../../src/newsletter/rendering/designState'
// Synthetic compatibility fixture authored with pinned d7f9a01 factories in the
// prior gate; contains no user JSON or image bytes. Original pending flags stay.
export const originalBJson=readFileSync('electron-p0/tests/fixtures/newsletter-b-synthetic.json','utf8')
export const bFixture=()=>parseStudioDocument(JSON.parse(originalBJson))
export const bNow='2026-11-03T00:00:00.000Z'
// Existing one-pixel test image, not a new illustration or an approved mascot.
export const syntheticImage=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kZkAAAAASUVORK5CYII=','base64')
export const syntheticSha=createHash('sha256').update(syntheticImage).digest('hex')
export async function approvedSyntheticB(){
 const project=await createNewsletterProject({projectId:'synthetic-b-output',title:'9월 합성',now:bNow,topics:Array.from({length:6},(_,i)=>({id:`synthetic-topic-${i}`,title:`합성 건강 주제 ${i+1}`,text:'함께 실천해요\n1. 비누로 손 씻기\n2. 음식 익혀 먹기\n3. 물 끓여 마시기\n4. 아프면 알리기'}))})
 const base=upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now:bNow}),bNow)
 // New, separately approved synthetic test manifest. Never upgrade original B
 // fixture's pending flags or trusted registry assets.
 const manifest=[{id:'synthetic-approved-image',sha256:syntheticSha,originalName:'synthetic.png',mediaType:'image/png',localReference:`asset:${syntheticSha}`,approvalStatus:'approved',exportApproval:'approved',registry:{classification:'USER_CREATED',purpose:'illustration',usageScope:'newsletter-output'}}]
 const design=parseNewsletterDesignStateV2({...base,assetManifest:manifest,revisionHistory:base.revisionHistory.map(e=>({...e,snapshot:{...e.snapshot,assetManifest:manifest}}))})
 const authored=bFixture().design
 if(authored.designSchemaVersion!==2)throw Error('V2 fixture required')
 let next=design
 for(const cardIndex of [0,1]){
  const template=authored.cardLayouts[cardIndex].officialTemplate!
  const elements=template.elements.map(e=>e.kind==='image'?{...e,assetId:manifest[0].id,...(e.mask?{mask:{...e.mask,assetId:manifest[0].id,sha256:syntheticSha}}:{})}:e)
  next=parseNewsletterDesignStateV2(updateCardLayout(next,{cardIndex,now:bNow,patch:{officialTemplate:{...template,elements}}}))
 }
 return {project,design:next}
}
