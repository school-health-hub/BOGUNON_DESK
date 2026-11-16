import { describe, it, expect } from 'vitest';
import { createNewsletterDesignState } from './designSchema';
import { upgradeNewsletterDesignStateV2, restoreDesignRevision } from './designState';
import { applyStudentArt, artSlots, filterStudentArt, recommendStudentArt } from './studentArt';
import { studentArtCatalog } from './studentArtCatalog';
import { resolveDesignAssets, assetExportPending } from './assetResolution';
import { buildCardScene } from './renderScene';
import { compileRenderDocument } from './renderDocument';
import { createNewsletterProject } from '../project';
const now = '2026-11-13T00:00:00.000Z';
const fixture = () => upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: 'art-test', canonicalProjectRevision: 1, now }), now);
describe('student illustration explicit review binding', () => {
    it('tracks twenty exact binaries grouped by scene, not approvals', () => { expect(studentArtCatalog).toHaveLength(20); expect(new Set(studentArtCatalog.map(a => a.sha256)).size).toBe(20); expect(filterStudentArt('female')).toHaveLength(8); expect(filterStudentArt('male')).toHaveLength(6); expect(filterStudentArt('mixed')).toHaveLength(6); });
    it('recommends by scene tags without generating or applying an image', () => { const d = fixture(), before = JSON.stringify(d); expect(recommendStudentArt('감염병 예방 손 씻기')[0]?.scene).toBe('handwashing'); expect(recommendStudentArt('학교생활 친구 관계').some(a => a.scene === 'friends')).toBe(true); expect(JSON.stringify(d)).toBe(before); });
    it('changes only confirmed slot in one revision preserving history', () => { const d = fixture(), before = JSON.stringify(d), a = studentArtCatalog[0]; if (!a)
        throw Error(); const next = applyStudentArt(d, { kind: 'card', index: 1 }, a.id, now); expect(JSON.stringify(d)).toBe(before); expect(next.designRevision).toBe(d.designRevision + 1); expect(next.revisionHistory.slice(0, -1)).toEqual(d.revisionHistory); expect(next.cardLayouts[1]?.image.assetId).toBe(a.id); expect(next.cardLayouts[2]).toEqual(d.cardLayouts[2]); expect(next.a4Layout).toEqual(d.a4Layout); expect(next.assetManifest[0]?.exportApproval).toBe('pending'); expect(restoreDesignRevision(next, { revision: d.designRevision, now }).cardLayouts).toEqual(d.cardLayouts); });
    it('resolves bundled bytes and retains trusted publication blocking even if document claims approval', async () => { const a = studentArtCatalog[0]; if (!a)
        throw Error(); const d = applyStudentArt(fixture(), { kind: 'card', index: 1 }, a.id, now); expect((await resolveDesignAssets(d, d.designRevision)).size).toBe(1); const asset = d.assetManifest[0]; if (!asset)
        throw Error(); expect(assetExportPending({ ...asset, exportApproval: 'approved' })).toBe(true); expect(assetExportPending({ ...asset, id: 'renamed', exportApproval: 'approved' })).toBe(true); });
    it('blocks asset ID collisions and unknown selections', () => { const d = fixture(); expect(() => applyStudentArt(d, { kind: 'card', index: 1 }, 'not-in-library', now)).toThrow(); expect(() => applyStudentArt(d, { kind: 'card', index: 99 }, null, now)).toThrow(); });
    it('represents no illustration explicitly rather than another placeholder', async () => { const d = fixture(), p = await createNewsletterProject({ projectId: 'art-test', title: '합성', now, topics: Array.from({ length: 6 }, (_, i) => ({ id: 't' + i, title: '주제' + i, text: '건강한 생활' })) }); const empty = applyStudentArt(d, { kind: 'card', index: 1 }, null, now); const doc = compileRenderDocument({ project: p, projectRevision: 1, design: empty, designRevision: empty.designRevision }); const card = doc.cards[1]; if (!card)
        throw Error(); expect(buildCardScene(card).layers.some(l => l.kind === 'image' && l.slotId === 'topic-image-1')).toBe(false); expect(artSlots(d, 'cards', 1).length).toBeGreaterThan(0); });
});

it("blocks both PNG and PDF publication before output work, even on forged approval",async()=>{
 const {generateNewsletterOutputs}=await import("../output/outputEngine")
 const {authorizeDocument}=await import("../../../electron-p0/renderer/export/authority")
 const art=studentArtCatalog[0];if(!art)throw Error()
 const p=await createNewsletterProject({projectId:"art-test",title:"합성",now})
 const next=applyStudentArt(fixture(),{kind:"card",index:1},art.id,now)
 const forged=JSON.parse(JSON.stringify(next).replaceAll('"exportApproval":"pending"','"exportApproval":"approved"'))
 const unused=async()=>{throw Error("output must not start")}
 await expect(generateNewsletterOutputs({project:p,projectRevision:1,design:forged,designRevision:forged.designRevision,createdAt:now,rasterizer:{ensureFontReady:unused,rasterize:unused},pdfComposer:{compose:unused}})).rejects.toThrow(/print approval pending/)
 for(const selection of ["a4-png","cards-pdf"] as const)expect(()=>authorizeDocument({document:JSON.stringify({project:p,design:forged}),selection,assets:[]})).toThrow(/출력 승인/)
})
it("validates all twenty bundled PNG hashes and dimensions against recovered inventory",async()=>{
 const {studentArtBytes}=await import("./studentArtSources")
 for(const art of studentArtCatalog){const bytes=studentArtBytes(art.sha256);if(!bytes)throw Error(art.id)
 const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new Uint8Array(bytes).buffer))].map(b=>b.toString(16).padStart(2,"0")).join("")
 expect(hash).toBe(art.sha256);const v=new DataView(new Uint8Array(bytes).buffer);expect(v.getUint32(16)).toBe(art.width);expect(v.getUint32(20)).toBe(art.height)}
},15000)
it("keeps a hidden slot hidden after JSON roundtrip and changes only the A4 target",async()=>{
 const {parseStudioDocument}=await import("../studioDocument")
 const d=fixture(),p=await createNewsletterProject({projectId:"art-test",title:"합성",now})
 const next=applyStudentArt(d,{kind:"a4",index:2},null,now)
 expect(next.a4Layout.modules[1]).toEqual(d.a4Layout.modules[1]);expect(next.cardLayouts).toEqual(d.cardLayouts)
 expect(parseStudioDocument(JSON.parse(JSON.stringify({project:p,design:next}))).design).toEqual(next)
})
