import {previewRegion} from './purchase-image-preview.js';
import type {ImageBox} from '../purchase-image-protocol.js';
// BGRA is Electron nativeImage.toBitmap() format. Operate on a copy, erase all channels.
export function redactBitmap(original:Buffer,width:number,height:number,rectangles:readonly ImageBox[]):Buffer{
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width*height>12_000_000||original.length!==width*height*4||!Array.isArray(rectangles)||rectangles.length>24)throw Error('가림 영역을 확인해 주세요.');
 const copy=Buffer.from(original);
 for(const rectangle of rectangles){const box=previewRegion(rectangle,width,height),row=Buffer.alloc((box[2]-box[0])*4);for(let i=3;i<row.length;i+=4)row[i]=255;for(let y=box[1];y<box[3];y++)row.copy(copy,(y*width+box[0])*4);}
 return copy;
}
