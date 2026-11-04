import type {IpcResult} from './protocol.js';
export type StoredWorkFolder=Readonly<{id:string;name:string;path:string}>;
export type WorkFoldersDocument=Readonly<{version:1;revision:number;favorites:readonly StoredWorkFolder[]}>;
export type WorkFolderView=StoredWorkFolder&Readonly<{displayPath:string;available:boolean;unavailableReason?:string}>;
export type WorkFoldersLoad=Readonly<{version:1;revision:number;favorites:readonly WorkFolderView[];recovered:boolean}>;
export type FolderRevision=Readonly<{expectedRevision:number}>;
export type WorkFoldersBridge=Readonly<{
 load():Promise<IpcResult<WorkFoldersLoad>>;
 pick(request:FolderRevision):Promise<IpcResult<WorkFoldersLoad|null>>;
 rename(request:FolderRevision&Readonly<{id:string;name:string}>):Promise<IpcResult<WorkFoldersLoad>>;
 remove(request:FolderRevision&Readonly<{id:string;confirmed:true}>):Promise<IpcResult<WorkFoldersLoad|null>>;
 reorder(request:FolderRevision&Readonly<{ids:readonly string[]}>):Promise<IpcResult<WorkFoldersLoad>>;
 open(request:Readonly<{id:string}>):Promise<IpcResult<null>>;
}>;
