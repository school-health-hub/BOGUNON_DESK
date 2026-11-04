import type {IpcResult} from './protocol.js';
import type {ImageBox} from './purchase-image-protocol.js';
export type ImageAiProvider='chatgpt'|'openai'|'gemini';
export type ImageAiConnection=Readonly<{provider:ImageAiProvider;connectionId:string;models:readonly {id:string;label:string}[]}>;
export type ImageAiPrepare=Readonly<{token:string;provider:ImageAiProvider;model:string;sources:readonly {sourceId:string;redactions:readonly ImageBox[]}[]}>;
export type ImageAiPrepared=Readonly<{id:string;provider:ImageAiProvider;model:string;expiresAt:number;images:readonly {sourceId:string;name:string;dataUrl:string;sha256:string;originalSha256:string;width:number;height:number;redactions:number}[]}>;
export type ImageAiItem=Readonly<{sourceId:string;name:string;option:string|null;specification:string|null;bundleQuantity:number|null;quantity:number|null;unitPrice:number|null;amount:number|null;originalPrice:number|null;discount:number|null;evidence:string;uncertain:readonly string[]}>;
export type ImageAiOrder=Readonly<{discount:number|null;shipping:number|null;total:number|null;evidence:string}>;
export type ImageAiResult=Readonly<{sourceId:string;status:'success'|'error';items:readonly ImageAiItem[];order:ImageAiOrder;warnings:readonly string[]}>;
export type ImageAiAnalysis=Readonly<{provider:ImageAiProvider;model:string;requestId:string;transmissions:readonly {sourceId:string;sha256:string}[];results:readonly ImageAiResult[]}>;
export type PurchaseImageAiApi=Readonly<{
 connections():Promise<IpcResult<readonly ImageAiConnection[]>>;
 prepare(input:ImageAiPrepare):Promise<IpcResult<ImageAiPrepared>>;
 execute(input:Readonly<{preparedId:string}>):Promise<IpcResult<ImageAiAnalysis|null>>;
 cancel():Promise<IpcResult<null>>;
}>;
