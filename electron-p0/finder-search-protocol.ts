import type {IpcResult} from './protocol.js';
export type FinderConditions=Readonly<{topic:string;target:string;minutes:number}>;
export type YoutubeVideo=Readonly<{videoId:string;title:string;channelId:string;channelTitle:string;durationSeconds:number;url:string;source:'youtube'}>;
export type FinderSearchRequest=Readonly<{conditions:FinderConditions;consent:true;cursor?:string}>;
export type FinderSearchPage=Readonly<{videos:readonly YoutubeVideo[];nextCursor:string|null;page:number;omitted:number}>;
export type FinderSearchStatus=Readonly<{provider:'youtube-data-v3';configured:boolean;secureStorage:boolean;saved:boolean}>;
export interface FinderSearchBridge{
 status():Promise<IpcResult<FinderSearchStatus>>;
 connectFromClipboard(input:Readonly<{remember:boolean}>):Promise<IpcResult<FinderSearchStatus>>;
 restore():Promise<IpcResult<FinderSearchStatus>>;
 disconnect():Promise<IpcResult<FinderSearchStatus>>;
 search(input:FinderSearchRequest):Promise<IpcResult<FinderSearchPage>>;
 cancel():Promise<IpcResult<null>>;
 openVideo(input:Readonly<{videoId:string}>):Promise<IpcResult<null>>;
}
