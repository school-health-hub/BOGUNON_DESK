export type HostErrorCode='PathRejected'|'MissingExecutable'|'DigestMismatch'|'SpawnDenied'|'SpawnFailed'
  |'InspectionFailed'|'PeerMismatch'|'ExplorerChanged'|'AuthenticationFailed'|'ProtocolRejected'
  |'ChannelClosed'|'Deadline'|'AlreadyStarted'|'CleanupUnknown';
export class HostError extends Error {
  constructor(readonly code:HostErrorCode){super(code);this.name='HostError';}
}
export function fixedError(error:unknown):HostError {
  if(error instanceof HostError)return error;
  if(error instanceof Error&&'code' in error){
    if(error.code==='ENOENT')return new HostError('MissingExecutable');
    if(error.code==='EACCES'||error.code==='EPERM')return new HostError('SpawnDenied');
  }
  return new HostError('SpawnFailed');
}
export async function deadline<T>(operation:Promise<T>,ms:number):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([operation,new Promise<never>((_,reject)=>{
    timer=setTimeout(()=>reject(new HostError('Deadline')),ms);
  })]);}finally{clearTimeout(timer);}
}
