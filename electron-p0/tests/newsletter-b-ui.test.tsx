// @vitest-environment jsdom
import {useState} from 'react'
import {afterEach,expect,it} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {approvedSyntheticB,bFixture,bNow} from './newsletter-b-fixture'
import {OfficialTemplateControls} from '../../src/newsletter/rendering/OfficialTemplateControls'
import {OfficialElementCopy} from '../../src/newsletter/rendering/OfficialElementCopy'
import {CardPreview} from '../../src/newsletter/rendering/NewsletterPreview'
import {compileRenderDocument} from '../../src/newsletter/rendering/renderDocument'
import {renderCardSvg} from '../../src/newsletter/output/svgRenderer'
import {updateCardLayout} from '../../src/newsletter/rendering/designState'
import {parseNewsletterDesignStateV2} from '../../src/newsletter/rendering/designSchema'
afterEach(cleanup)
it('toggles a stored mask and clears it safely on explicit image replacement while retaining the old revision',()=>{
 const original=bFixture();if(original.design.designSchemaVersion!==2)throw Error();let latest=original.design
 function Editor(){const [design,setDesign]=useState(latest);latest=design;return <OfficialTemplateControls design={design} cardIndex={0} actionCount={4} onChange={setDesign}/>}
 render(<Editor/>);fireEvent.change(screen.getByLabelText('공식 요소'),{target:{value:'students'}});fireEvent.click(screen.getByLabelText('공식 요소 마스크 표시'))
 expect(latest.cardLayouts[0].officialTemplate!.elements.find(e=>e.id==='students')).toMatchObject({maskEnabled:true});fireEvent.click(screen.getByLabelText('공식 요소 마스크 표시'));expect(latest.cardLayouts[0].officialTemplate!.elements.find(e=>e.id==='students')).toMatchObject({maskEnabled:false})
 fireEvent.change(screen.getByLabelText('공식 요소 이미지 자산'),{target:{value:'otter-primary-v1'}})
 const changed=latest.cardLayouts[0].officialTemplate!.elements.find(e=>e.id==='students');expect(changed).toMatchObject({assetId:'otter-primary-v1'});expect(changed&&'mask' in changed).toBe(false)
 expect(latest.revisionHistory.slice(0,original.design.revisionHistory.length)).toEqual(original.design.revisionHistory)
 expect(original.design.cardLayouts[0].officialTemplate!.elements.find(e=>e.id==='students')).toHaveProperty('mask')
})
it('edits selected element copy/style/geometry/visibility with no template apply button',async()=>{
 const initial=await approvedSyntheticB();let latest=initial
 function Editor(){const [doc,setDoc]=useState(initial);latest=doc;return <><OfficialTemplateControls design={doc.design} cardIndex={1} actionCount={4} onChange={design=>setDoc({...doc,design})} renderTextEditor={binding=><OfficialElementCopy key={`${binding}-${doc.project.projectRevision}-${doc.design.designRevision}`} {...doc} cardIndex={1} binding={binding} onChange={setDoc}/>}/></>}
 render(<Editor/>);expect(screen.queryByRole('button',{name:'공식 편집형 템플릿 적용'})).toBeNull()
 const selection=screen.getByLabelText('공식 요소');fireEvent.change(selection,{target:{value:'action-0'}});fireEvent.change(screen.getByLabelText('공식 요소 문구'),{target:{value:'합성 손 씻기 수칙'}});fireEvent.click(screen.getByRole('button',{name:'선택 문구 반영'}));await waitFor(()=>expect(latest.project.projectRevision).toBe(2))
 const original=initial.project.canonicalCopy.sections[0].aiGenerated.text
 expect(latest.project.canonicalCopy.sections[0].userEdit?.text).toBe(original.replace('비누로 손 씻기','합성 손 씻기 수칙'))
 expect(latest.project.canonicalCopy.sections.slice(1)).toEqual(initial.project.canonicalCopy.sections.slice(1));expect(latest.design.cardLayouts).toEqual(initial.design.cardLayouts)
 fireEvent.change(screen.getByLabelText('공식 요소 글자 크기'),{target:{value:'27'}});fireEvent.change(screen.getByLabelText('공식 요소 글자 색'),{target:{value:'#123456'}});fireEvent.change(screen.getByLabelText('공식 요소 가로 위치'),{target:{value:'140'}});fireEvent.change(screen.getByLabelText('공식 요소 겹침 순서'),{target:{value:'50'}})
 expect(latest.design.cardLayouts[1].officialTemplate!.elements.find(e=>e.id==='action-0')).toMatchObject({frame:{x:140},zOrder:50,style:{fontSize:27,color:'#123456'}})
 fireEvent.change(selection,{target:{value:'action-scene-0'}});fireEvent.click(screen.getByLabelText('공식 요소 표시'));expect(latest.design.cardLayouts[1].officialTemplate!.elements.find(e=>e.id==='action-scene-0')).toMatchObject({visible:false})
 expect(latest.design.cardLayouts[0]).toEqual(initial.design.cardLayouts[0]);expect(latest.design.cardLayouts.slice(2)).toEqual(initial.design.cardLayouts.slice(2))
})
it('shares exact scene hash, visible image count, polygon geometry, feather masks and Korean lines between React and output SVG',async()=>{
 const doc=await approvedSyntheticB(),template=doc.design.cardLayouts[0].officialTemplate!,asset=doc.design.assetManifest[0]
 const elements=template.elements.map(e=>e.kind==='image'&&e.id==='background'?{...e,visible:true,edgePolicy:'feather' as const,mask:{assetId:asset.id,sha256:asset.sha256,sourceWidth:1,sourceHeight:1,points:[{x:0,y:0},{x:1,y:0},{x:1,y:1}]}}:e)
 const design=parseNewsletterDesignStateV2(updateCardLayout(doc.design,{cardIndex:0,now:bNow,patch:{officialTemplate:{...template,elements}}}));const page=compileRenderDocument({...doc,design,projectRevision:1,designRevision:design.designRevision}).cards[0]
 const assets=new Map([[asset.id,'data:image/png;base64,synthetic']]);const preview=render(<CardPreview page={page} assets={assets}/>);const raw=renderCardSvg(page,assets);const exported=new DOMParser().parseFromString(raw,'image/svg+xml')
 expect(exported.querySelector('parsererror')).toBeNull();expect(preview.container.querySelector('[data-scene-hash]')?.getAttribute('data-scene-hash')).toBe(exported.documentElement.getAttribute('data-scene-hash'))
 for(const selector of ['image','polygon','feGaussianBlur','mask','tspan'])expect(preview.container.querySelectorAll(selector).length).toBe(exported.querySelectorAll(selector).length)
 expect([...preview.container.querySelectorAll('polygon')].map(p=>p.getAttribute('points'))).toEqual([...exported.querySelectorAll('polygon')].map(p=>p.getAttribute('points')))
 expect([...preview.container.querySelectorAll('tspan')].map(p=>p.textContent)).toEqual([...exported.querySelectorAll('tspan')].map(p=>p.textContent))
})
it('keeps pending and all original authored B layers unchanged when previewing',()=>{
 const doc=bFixture();const before=JSON.stringify(doc);const page=compileRenderDocument({...doc,projectRevision:doc.project.projectRevision,designRevision:doc.design.designRevision}).cards[0]
 const assets=new Map(doc.design.assetManifest.map(a=>[a.id,'data:image/png;base64,synthetic']));render(<CardPreview page={page} assets={assets}/>);expect(JSON.stringify(doc)).toBe(before);expect(doc.design.assetManifest.every(a=>a.exportApproval==='pending')).toBe(true)
})
