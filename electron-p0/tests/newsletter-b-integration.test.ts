import {expect,it,vi} from 'vitest'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {PDFDocument} from 'pdf-lib'
import {bFixture,originalBJson,bNow,approvedSyntheticB,syntheticImage} from './newsletter-b-fixture'
import {parseStudioDocument,serializeStudioDocument} from '../../src/newsletter/studioDocument'
import {NewsletterCompatibilityError} from '../../src/newsletter/compatibility'
import {restoreDesignRevision,updateCardLayout} from '../../src/newsletter/rendering/designState'
import {updateOfficialElementFrame} from '../../src/newsletter/rendering/officialTemplate'
import {compileRenderDocument} from '../../src/newsletter/rendering/renderDocument'
import {buildNewsletterScene} from '../../src/newsletter/rendering/renderScene'
import {NewsletterProjects} from '../main/newsletter-projects'
import {validateStoredDocument} from '../renderer/export/stored-document'
import {authorizeDocument} from '../renderer/export/authority'
import {generateNewsletterOutputs} from '../../src/newsletter/output/outputEngine'
import {PdfLibImageComposer} from '../../src/newsletter/output/pdfComposer'
import {attachApprovedMascot,OTTER_ASSET_ID} from '../../src/newsletter/rendering/bundledMascot'
import {parseNewsletterDesignStateV2} from '../../src/newsletter/rendering/designSchema'
import {createNewsletterSaveHandler} from '../main/newsletter-json'
it('roundtrips authored B JSON and every mixed legacy/new snapshot without loss or approval promotion',()=>{
 const doc=bFixture();if(doc.design.designSchemaVersion!==2)throw Error();expect(JSON.parse(serializeStudioDocument(doc))).toEqual(JSON.parse(originalBJson))
 expect(doc.design.revisionHistory.some(e=>e.snapshotVersion===1)).toBe(true)
 expect(doc.design.revisionHistory.some(e=>e.snapshotVersion===2)).toBe(true)
 if(doc.design.designSchemaVersion!==2)throw Error()
 for(const row of doc.design.revisionHistory){const restored=restoreDesignRevision(doc.design,{revision:row.revision,now:bNow});const parsed=parseStudioDocument({...doc,design:restored});expect(parsed.design.revisionHistory.slice(0,-1)).toEqual(doc.design.revisionHistory);expect(restored.assetManifest.every(a=>a.exportApproval==='pending')).toBe(true)}
})
it('preserves other cards and original revisions during element geometry/style/order/visibility edits',()=>{
 const doc=bFixture();if(doc.design.designSchemaVersion!==2)throw Error();const before=serializeStudioDocument(doc);const card=doc.design.cardLayouts[0];const image=card.officialTemplate!.elements.find(e=>e.kind==='image')!
 const changed=updateOfficialElementFrame(doc.design,{cardIndex:0,elementId:image.id,patch:{x:10,width:1180},zOrder:45,visible:false,maskEnabled:false,now:bNow})
 expect(changed.cardLayouts.slice(1)).toEqual(doc.design.cardLayouts.slice(1));expect(changed.cardLayouts[0].officialTemplate!.elements.find(e=>e.id===image.id)).toMatchObject({visible:false,maskEnabled:false,zOrder:45,frame:{x:10,width:1180}})
 expect(changed.revisionHistory.slice(0,-1)).toEqual(doc.design.revisionHistory);expect(serializeStudioDocument(doc)).toBe(before)
 expect(parseStudioDocument({...doc,design:changed}).project).toEqual(doc.project)
})
it('keeps future fields/enums blocked in current and historical B data',()=>{
 for(const history of [false,true])for(const property of ['futureField','futureEnum']){
  const raw=JSON.parse(originalBJson);const card=(history?raw.design.revisionHistory.at(-1).snapshot:raw.design).cardLayouts[0]
  if(property==='futureField')card.officialTemplate.futureLayer={}
  else card.officialTemplate.elements.find((e:any)=>e.kind==='image').edgePolicy='future-feather'
  expect(()=>parseStudioDocument(raw)).toThrow(NewsletterCompatibilityError)
 }
})
it('saves B projects, reopens after store recreation and safely cancels/conflicts/restores without altering old rows',async()=>{
 const root=await mkdtemp(join(tmpdir(),'newsletter-b-store-'));const make=()=>new NewsletterProjects(root,async(json,barrier)=>validateStoredDocument({json,barrier}));const store=make(),doc=bFixture(),id=doc.project.projectId
 try{const first=await store.save(serializeStudioDocument(doc),{projectId:id,revision:0,hash:''});if(doc.design.designSchemaVersion!==2)throw Error();const element=doc.design.cardLayouts[0].officialTemplate!.elements[0];const changed=updateOfficialElementFrame(doc.design,{cardIndex:0,elementId:element.id,patch:{},zOrder:99,now:bNow});const second=await store.save(serializeStudioDocument({...doc,design:changed}),first.head)
  const reopened=make();expect(await reopened.load(id)).toEqual(second);const before=await readFile(join(root,id+'.json'));await expect(store.save(first.document,first.head)).rejects.toThrow();expect(await readFile(join(root,id+'.json'))).toEqual(before)
  const p=await store.preview(id,1);expect(await store.restore(p.token,p.head,async()=>false)).toEqual({restored:false});expect(await readFile(join(root,id+'.json'))).toEqual(before)
  const again=await store.preview(id,1),restored=await store.restore(again.token,again.head,async()=>true);expect(restored.record?.document).toBe(first.document);expect(restored.record?.head.revision).toBe(3);const rows=JSON.parse(await readFile(join(root,id+'.json'),'utf8')).rows;expect(rows[0].document).toBe(first.document);expect(rows[1].document).toBe(second.document)
 }finally{await store.flush();await rm(root,{recursive:true,force:true})}
})
it('roundtrips an explicitly selected B JSON file and preserves its bytes on cancellation or dialog failure',async()=>{
 const root=await mkdtemp(join(tmpdir(),'newsletter-b-json-')),path=join(root,'synthetic.json'),frame={},contents={mainFrame:frame,getURL:()=> 'file:///synthetic'},event={sender:undefined as unknown,senderFrame:frame};event.sender=contents
 const validate=async(json:string)=>{validateStoredDocument({json,barrier:{ids:[],hashes:[]}})}
 try{await writeFile(path,'existing synthetic file');const cancelled=createNewsletterSaveHandler(contents,contents.getURL(),{validate,pick:async()=>path,confirm:async()=>false});expect(await cancelled(event,{json:originalBJson})).toMatchObject({ok:true,data:{saved:false}});expect(await readFile(path,'utf8')).toBe('existing synthetic file')
  const save=createNewsletterSaveHandler(contents,contents.getURL(),{validate,pick:async()=>path,confirm:async()=>true});expect(await save(event,{json:originalBJson})).toMatchObject({ok:true,data:{saved:true}});expect(await readFile(path,'utf8')).toBe(originalBJson);expect(parseStudioDocument(JSON.parse(await readFile(path,'utf8')))).toEqual(bFixture())
  const failure=createNewsletterSaveHandler(contents,contents.getURL(),{validate,pick:async()=>{throw Error('synthetic dialog failure')},confirm:async()=>true});expect(await failure(event,{json:originalBJson})).toMatchObject({ok:false});expect(await readFile(path,'utf8')).toBe(originalBJson)
 }finally{await rm(root,{recursive:true,force:true})}
})
it('does not allow pending output through hidden mascot or template image layers',()=>{
 const doc=bFixture();expect(()=>authorizeDocument({document:serializeStudioDocument(doc),selection:'cards-pdf',assets:[]})).toThrow(/출력 승인/)
 const before=originalBJson;expect(doc.design.assetManifest.every(a=>a.exportApproval==='pending')).toBe(true);expect(JSON.parse(before)).toEqual(JSON.parse(serializeStudioDocument(doc)))
})
it('keeps the trusted mascot pending even when only an invisible official element references it',async()=>{
 const doc=await approvedSyntheticB();const attached=attachApprovedMascot(doc.design,bNow)
 const hidden=attached.cardLayouts.map((card,index)=>({...card,brand:undefined,...(index===0?{officialTemplate:{...card.officialTemplate!,elements:card.officialTemplate!.elements.map(e=>e.kind==='image'&&e.binding==='mascot'?{...e,assetId:OTTER_ASSET_ID,visible:false}:e)}}:{})}))
 const design=parseNewsletterDesignStateV2(updateCardLayout(attached,{cardIndex:0,now:bNow,patch:{officialTemplate:hidden[0].officialTemplate}}))
 // Remove legacy fallback slots in the current snapshot only, then append a
 // matching revision via the standard whole-card composition revision helper.
 const {reviseOfficialComposition}=await import('../../src/newsletter/rendering/officialTemplate')
 const isolated=reviseOfficialComposition(design,hidden,hidden.map(c=>c.pageId),bNow)
 expect(()=>authorizeDocument({document:serializeStudioDocument({...doc,design:isolated}),selection:'cards-pdf',assets:[]})).toThrow(/출력 승인/)
 expect(isolated.assetManifest.find(a=>a.id===OTTER_ASSET_ID)?.exportApproval).toBe('pending')
})
it('retains A4/7-card output contract and executes approved synthetic B through the existing output engine',async()=>{
 const {project,design}=await approvedSyntheticB();const document=compileRenderDocument({project,projectRevision:project.projectRevision,design,designRevision:design.designRevision});expect(document.cards).toHaveLength(7);expect(buildNewsletterScene(document).pages).toHaveLength(8)
 const req={document:serializeStudioDocument({project,design}),selection:'cards-pdf' as const,assets:[{reference:design.assetManifest[0].localReference!,bytesBase64:syntheticImage.toString('base64')}]};const authorized=authorizeDocument(req)
 // Rasterization is a bounded test double, not Windows/Canvas visual proof.
 const rasterize=vi.fn(async({width,height}:{width:number;height:number})=>{const b=new Uint8Array(24);b.set([137,80,78,71,13,10,26,10]);new DataView(b.buffer).setUint32(16,width);new DataView(b.buffer).setUint32(20,height);return b})
 const compose=vi.fn(async()=>new TextEncoder().encode('%PDF synthetic contract'))
 const bundle=await generateNewsletterOutputs({project,projectRevision:1,design,designRevision:design.designRevision,createdAt:bNow,assetResolver:authorized.resolver,rasterizer:{ensureFontReady:async()=>{},rasterize},pdfComposer:{compose}})
 expect(bundle.cardPngs).toHaveLength(7);expect(rasterize).toHaveBeenCalledTimes(8);expect(compose.mock.calls).toHaveLength(2)
 const pdf=await new PdfLibImageComposer().compose(Array.from({length:7},()=>({pngBytes:syntheticImage,pageSize:{width:432,height:432}})));expect((await PDFDocument.load(pdf)).getPageCount()).toBe(7)
})
it('preserves reference/visual-finish/foreground-mask data through ordinary edits and revision recovery',async()=>{
 const doc=await approvedSyntheticB();const current=doc.design.cardLayouts[0];const source=doc.design.assetManifest[0]
 const next=updateCardLayout(doc.design,{cardIndex:0,now:bNow,patch:{officialTemplate:null,image:{assetId:source.id},editorial:{layoutType:'A',studentComposition:'mixed',season:'none',referenceLayout:true,visualFinish:true,foregroundMask:{assetId:source.id,sha256:source.sha256,sourceWidth:1,sourceHeight:1,points:[{x:0,y:0},{x:1,y:0},{x:1,y:1}]}}}})
 expect(parseStudioDocument({...doc,design:next}).design.cardLayouts[0]).not.toEqual(current)
 const restored=restoreDesignRevision(next,{revision:doc.design.designRevision,now:bNow});expect(restored.cardLayouts).toEqual(doc.design.cardLayouts)
})
