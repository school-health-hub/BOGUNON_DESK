import type {NewsletterExportRequest,TrustedNewsletterOutput} from '../../protocol';
import {parseStudioDocument} from '../../../src/newsletter/studioDocument';
import {referencedDesignAssets,assetExportPending,resolveDesignAssets} from '../../../src/newsletter/rendering/assetResolution';
import {generateNewsletterOutputs} from '../../../src/newsletter/output/outputEngine';
import type {TextMeasurer} from '../../../src/newsletter/rendering/typography';
import {BrowserSvgRasterizer} from '../../../src/newsletter/output/browserRasterizer';
import {PdfLibImageComposer} from '../../../src/newsletter/output/pdfComposer';
export function authorizeDocument(request:NewsletterExportRequest){
 const doc=parseStudioDocument(JSON.parse(request.document));
 const assets=referencedDesignAssets(doc.design,doc.design.designRevision);
 if(assets.some(a=>a.localReference!==`asset:${a.sha256}`||a.approvalStatus!=='approved'||a.exportApproval!=='approved'||assetExportPending(a)))throw Error('출력 승인이 완료되지 않은 자산입니다.');
 const references=new Set(assets.map(a=>a.localReference));
 if(request.assets.length!==references.size||request.assets.some(a=>!references.has(a.reference))||new Set(request.assets.map(a=>a.reference)).size!==request.assets.length)throw Error('출력 자산 구성이 일치하지 않습니다.');
 const bytes=new Map(request.assets.map(a=>[a.reference,Uint8Array.from(atob(a.bytesBase64),c=>c.charCodeAt(0))]));
 const resolver={async resolve(ref:string){const data=bytes.get(ref);if(!data)throw Error('이미지 원본이 없습니다.');return data;}};
 return {doc,assets,resolver};
}
function encode(bytes:Uint8Array){let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);}
export async function generateTrustedOutput(request:NewsletterExportRequest):Promise<TrustedNewsletterOutput>{
 const {doc,assets,resolver}=authorizeDocument(request);
 // Run only the original publication path. No QA purpose, SVG or caller-supplied output bytes.
 await resolveDesignAssets(doc.design,doc.design.designRevision,resolver);
 const rasterizer=new BrowserSvgRasterizer();await rasterizer.ensureFontReady();
 const context=document.createElement('canvas').getContext('2d');if(!context)throw Error('Canvas measurement unavailable');
 // Match the existing NewsletterDesignEditor measurement, after its bundled font is ready.
 const measureText:TextMeasurer=(text,style)=>{context.font=`${style.fontWeight} ${style.fontSize}px Pretendard`;return context.measureText(text).width;};
 const bundle=await generateNewsletterOutputs({project:doc.project,projectRevision:doc.design.canonicalProjectRevision,design:doc.design,designRevision:doc.design.designRevision,createdAt:new Date().toISOString(),rasterizer,measureText,pdfComposer:new PdfLibImageComposer(),assetResolver:resolver});
 const selected=request.selection==='a4-png'?[bundle.a4Png]:request.selection==='a4-pdf'?[bundle.a4Pdf]:request.selection==='cards-pdf'?[bundle.cardsPdf]:bundle.cardPngs;
 return {summary:`${doc.project.projectId} · 원고 ${doc.design.canonicalProjectRevision} · 디자인 ${doc.design.designRevision}\n${assets.length===0?'사용자 이미지 없음':assets.map(a=>`${a.id}: ${a.sha256}`).join('\n')}`,files:selected.map(a=>({fileName:a.fileName,bytesBase64:encode(a.bytes)}))};
}
