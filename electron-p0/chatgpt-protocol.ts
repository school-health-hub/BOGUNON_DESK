import type {AiTool,IpcResult} from './protocol.js';
export type ChatGptPhase='disconnected'|'authenticating'|'permission-required'|'ready'|'reauthentication-required'|'usage-limit'|'temporary-error';
export type ChatGptStatus=Readonly<{supported:boolean;phase:ChatGptPhase;busy:boolean;accountId:string|null;identity:string|null;planUsageEnabled:boolean;models:readonly {id:string;label:string}[];model:string|null;textCallVerified:boolean;showPlanNotice:boolean;notice:string}>;
export type ChatGptRequest=Readonly<{tool:AiTool|'connection-test';prompt:string}>;
export type ChatGptBridge=Readonly<{
 status():Promise<IpcResult<ChatGptStatus>>;
 signIn():Promise<IpcResult<ChatGptStatus|null>>;
 refreshModels():Promise<IpcResult<ChatGptStatus|null>>;
 selectModel(input:Readonly<{model:string}>):Promise<IpcResult<ChatGptStatus>>;
 acknowledge():Promise<IpcResult<ChatGptStatus|null>>;
 disconnect():Promise<IpcResult<ChatGptStatus|null>>;
 generate(input:ChatGptRequest):Promise<IpcResult<Readonly<{text:string}>|null>>;
 cancel():Promise<IpcResult<null>>;
}>;
