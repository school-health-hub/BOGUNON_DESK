import {it,expect} from 'vitest'
import {createBlankNewsletter,newsletterSchoolTypes} from './newDocument'
import {parseStudioDocument,serializeStudioDocument} from './studioDocument'
import {OTTER_ASSET_ID,OTTER_SHA256} from './rendering/bundledMascot'
import {compileRenderDocument} from './rendering/renderDocument'
const now='2026-11-03T00:00:00.000Z'
for(const schoolType of ['girls-high','boys-high','coed-high'] as const)it(`creates a blank, editable ${schoolType} issue without synthetic copy or approval promotion`,async()=>{
 const document=await createBlankNewsletter({projectId:`blank-${schoolType}`,month:'2027-03',schoolType,now})
 expect(document.project.title).toBe(`2027년 3월 · ${newsletterSchoolTypes[schoolType]} 보건소식지`)
 expect(document.design.publicationMeta.issueLabel).toContain('2027년 3월')
 expect(document.project.topics.map(t=>t.title)).toEqual(['주제 1','주제 2','주제 3','주제 4','주제 5','주제 6'])
 expect(document.project.canonicalCopy.sections.every(s=>s.aiGenerated.text==='')).toBe(true)
 expect(document.project.cardLayouts).toHaveLength(7)
 expect(document.design.designSchemaVersion).toBe(2)
 const asset=document.design.assetManifest.find(a=>a.id===OTTER_ASSET_ID)!
 expect(asset.sha256).toBe(OTTER_SHA256);expect(asset.exportApproval).toBe('pending')
 const reopened=parseStudioDocument(JSON.parse(serializeStudioDocument(document)))
 expect(reopened).toEqual(document)
 const compiled=compileRenderDocument({project:reopened.project,projectRevision:1,design:reopened.design,designRevision:reopened.design.designRevision})
 expect(compiled.cards).toHaveLength(7);expect(compiled.a4.modules).toHaveLength(6)
})
it('rejects invalid month or school choices instead of creating a partially normalized project',async()=>{
 for(const month of ['','2026-00','2026-13','0000-01','2026-1'])await expect(createBlankNewsletter({projectId:'invalid',month,schoolType:'coed-high',now})).rejects.toThrow()
 await expect(createBlankNewsletter({projectId:'invalid',month:'2026-01',schoolType:'unknown' as never,now})).rejects.toThrow()
})
