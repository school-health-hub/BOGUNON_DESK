/** Purpose-only product IPC. No arbitrary RPC/SQL/HTTP capability. */
export const WORKSPACE_METHODS = {
 school: {state:'state',signIn:'login',signOut:'logout',findSchool:'search',selectSchool:'select',refresh:'refresh',requestJoin:'join',requestSpace:'space',withdraw:'withdraw',decideJoin:'decide',setRole:'role',setMembership:'membership',setExpiry:'expiry',leave:'leave',proposeAdmin:'propose',acceptAdmin:'accept',reauthenticate:'reauth'},
 instructor: {read:'read',settings:'settings',save:'save',remove:'delete',import:'import'},
 tasks: {selectSchool:'select',refresh:'refresh',getTask:'detail',createTask:'create',editTask:'edit',assignTask:'assign',changeStatus:'status',closeTask:'close',history:'history'},
 activity: {selectSchool:'select',refresh:'refresh',getEvent:'event_get',saveEvent:'event_save',cancelEvent:'event_cancel',eventHistory:'event_history',getHandover:'note_get',createHandover:'note_create',editHandover:'note_edit',acknowledge:'note_ack',completeHandover:'note_complete',handoverHistory:'note_history'},
} as const;
export interface WorkspaceProductStatus {mode:'disabled'|'qa'|'unavailable';connected:boolean;message:string;generation:number;accounts?:readonly {id:number;label:string}[];account?:number}
type Methods<T> = Readonly<{[K in keyof T]:(input?:Record<string,unknown>)=>Promise<unknown>}>;
export interface WorkspaceProductApi {status():Promise<WorkspaceProductStatus>;switchAccount(input:Record<string,unknown>):Promise<WorkspaceProductStatus>;school:Methods<typeof WORKSPACE_METHODS.school>;tasks:Methods<typeof WORKSPACE_METHODS.tasks>;activity:Methods<typeof WORKSPACE_METHODS.activity>;instructor?:Methods<typeof WORKSPACE_METHODS.instructor>}
