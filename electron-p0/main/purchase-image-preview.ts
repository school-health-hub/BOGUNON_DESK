import type {ImageBox,ImageOcrOptions,ImageProcessing,ImageSource} from '../purchase-image-protocol.js';
import {DEFAULT_IMAGE_OCR} from '../purchase-image-protocol.js';
export function processingSettings(value:unknown,sources:readonly ImageSource[]):readonly ImageProcessing[]{
 if(value===undefined)return sources.map(s=>({...DEFAULT_IMAGE_OCR,sourceId:s.id}));
 if(!Array.isArray(value)||value.length!==sources.length)throw Error('Invalid OCR settings');const ids=new Set();
 for(const r of value){if(!r||typeof r!=='object'||Object.keys(r).sort().join(',')!=='enhance,layout,rotation,sourceId'||!sources.some(s=>s.id===r.sourceId)||ids.has(r.sourceId)||![0,90,180,270].includes(r.rotation)||typeof r.enhance!=='boolean'||!['block','sparse'].includes(r.layout))throw Error('Invalid OCR settings');ids.add(r.sourceId);}
 return sources.map(s=>value.find(r=>r.sourceId===s.id) as ImageProcessing);
}
export function previewRegion(value:unknown,width:number,height:number):ImageBox{
 if(value===undefined)return [0,0,width,height];
 if(!Array.isArray(value)||value.length!==4||value.some(n=>!Number.isSafeInteger(n))||value[0]<0||value[1]<0||value[2]>width||value[3]>height||value[2]<=value[0]||value[3]<=value[1])throw Error('Invalid preview region');return value as unknown as ImageBox;
}
export function perceptualHash(bitmap:Buffer):string{
 if(bitmap.length!==9*8*4)throw Error('Invalid thumbnail bitmap');let bits=0n;
 const light=(i:number)=>.114*bitmap[i]+.587*bitmap[i+1]+.299*bitmap[i+2];
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){const i=(y*9+x)*4;bits=(bits<<1n)|(light(i)>light(i+4)?1n:0n);}return bits.toString(16).padStart(16,'0');
}
export const ocrOptions=(r:ImageProcessing):ImageOcrOptions=>({rotation:r.rotation,enhance:r.enhance,layout:r.layout});
