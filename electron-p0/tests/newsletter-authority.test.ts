import {it,expect} from 'vitest';
import {createNewsletterProject} from '../../src/newsletter/project';
import {createNewsletterDesignState} from '../../src/newsletter/rendering/designSchema';
import {upgradeNewsletterDesignStateV2} from '../../src/newsletter/rendering/designState';
import {attachApprovedMascot} from '../../src/newsletter/rendering/bundledMascot';
import {authorizeDocument} from '../renderer/export/authority';
const now='2026-10-30T00:00:00.000Z';
it('independent authority blocks pending mascot even if renderer forges approval or renames asset',async()=>{
 const project=await createNewsletterProject({projectId:'synthetic-authority',title:'합성',now});
 const design=attachApprovedMascot(upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now}),now),now);
 const document=JSON.stringify({project,design});
 for(const text of [document,document.replaceAll('"exportApproval":"pending"','"exportApproval":"approved"'),document.replaceAll('"exportApproval":"pending"','"exportApproval":"approved"').replaceAll('otter-primary-v1','renamed-asset')])expect(()=>authorizeDocument({document:text,selection:'a4-pdf',assets:[]})).toThrow();
 expect(design.assetManifest[0].exportApproval).toBe('pending');
});
it('accepts valid source document with no image assets and rejects unexpected asset bytes',async()=>{
 const project=await createNewsletterProject({projectId:'synthetic-authority',title:'합성',now}),design=upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now}),now);
 expect(authorizeDocument({document:JSON.stringify({project,design}),selection:'a4-pdf',assets:[]}).assets).toEqual([]);
 expect(()=>authorizeDocument({document:JSON.stringify({project,design}),selection:'a4-pdf',assets:[{reference:'asset:'+'a'.repeat(64),bytesBase64:'AQ=='}]})).toThrow();
});
it('requires approved registry scope and verifies synthetic asset hash independently',async()=>{
 const {createHash}=await import('node:crypto');const {resolveDesignAssets}=await import('../../src/newsletter/rendering/assetResolution');
 const project=await createNewsletterProject({projectId:'synthetic-asset',title:'합성',now}),design=upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now}),now);
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kZkAAAAASUVORK5CYII=','base64'),sha=createHash('sha256').update(bytes).digest('hex');
 const asset={id:'synthetic-approved',sha256:sha,mediaType:'image/png',approvalStatus:'approved',exportApproval:'approved',originalName:'synthetic.png',localReference:`asset:${sha}`,registry:{classification:'USER_CREATED',purpose:'illustration',usageScope:'newsletter-output'}};
 const cards=design.cardLayouts.map((c,i)=>i===0?{...c,image:{...c.image,assetId:asset.id}}:c),approved={...design,assetManifest:[asset],cardLayouts:cards,revisionHistory:design.revisionHistory.map(e=>e.revision===design.designRevision?{...e,snapshot:{...e.snapshot,assetManifest:[asset],cardLayouts:cards}}:e)};
 const request={document:JSON.stringify({project,design:approved}),selection:'a4-pdf' as const,assets:[{reference:asset.localReference,bytesBase64:bytes.toString('base64')}]};
 const checked=authorizeDocument(request);expect((await resolveDesignAssets(checked.doc.design,checked.doc.design.designRevision,checked.resolver)).size).toBe(1);
 expect(()=>authorizeDocument({...request,document:request.document.replaceAll('"exportApproval":"approved"','"exportApproval":"pending"')})).toThrow();
 const wrong=authorizeDocument({...request,assets:[{...request.assets[0],bytesBase64:'AQID'}]});await expect(resolveDesignAssets(wrong.doc.design,wrong.doc.design.designRevision,wrong.resolver)).rejects.toThrow(/SHA-256/);
});
