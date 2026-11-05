import type {IpcResult} from './protocol.js';
import type {SchoolInfo,SchoolLoad} from './school-protocol.js';
export type AccountUser=Readonly<{id:string;email:string|null;displayName:string|null}>;
export type AccountState=Readonly<{status:'signedOut'|'signingIn'|'signedIn'|'expired'|'temporaryError'|'storageError';configured:boolean;secureStorage:boolean;revision:number;user:AccountUser|null;school:SchoolInfo|null;schoolStatus:'none'|'ready'|'incomplete'|'error';message:string}>;
export type AccountApply=Readonly<{accountRevision:number;expectedSchoolRevision:number}>;
export type AccountBridge=Readonly<{status():Promise<IpcResult<AccountState>>;signIn():Promise<IpcResult<AccountState>>;cancel():Promise<IpcResult<AccountState>>;signOut():Promise<IpcResult<AccountState>>;refresh():Promise<IpcResult<AccountState>>;applySchool(input:AccountApply):Promise<IpcResult<SchoolLoad|null>>}>;
