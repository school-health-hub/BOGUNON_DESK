import {parseStudioDocument,serializeStudioDocument} from '../../../src/newsletter/studioDocument';
import {assetExportPending} from '../../../src/newsletter/rendering/assetResolution';
import type {NewsletterApprovalBarrier} from '../../protocol';
// Called only in main's isolated validation window. No print approval is created here.
export function validateStoredDocument(input:{json:string;barrier:NewsletterApprovalBarrier}):string{
 const doc=parseStudioDocument(JSON.parse(input.json));
 const protectedManifest=(assets:typeof doc.design.assetManifest)=>assets.map(a=>input.barrier.ids.includes(a.id)||input.barrier.hashes.includes(a.sha256)||assetExportPending(a)?{...a,exportApproval:'pending' as const}:a);
 const design={...doc.design,assetManifest:protectedManifest(doc.design.assetManifest),revisionHistory:doc.design.revisionHistory.map(e=>({...e,snapshot:{...e.snapshot,assetManifest:protectedManifest(e.snapshot.assetManifest)}}))};
 return serializeStudioDocument(parseStudioDocument({project:doc.project,design}));
}
