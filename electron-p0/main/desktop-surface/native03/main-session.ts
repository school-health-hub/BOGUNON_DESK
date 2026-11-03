import {HostError} from '../native02/errors.js';
import {z} from 'zod';
import type {LauncherSnapshot} from '../native02/launcher.js';
export interface HostPort {
  readonly snapshot:LauncherSnapshot;
  start():Promise<LauncherSnapshot>;stop():Promise<LauncherSnapshot>;checkHealth():Promise<LauncherSnapshot>;
}
export interface MainHostSession {
  readonly snapshot:Readonly<{mode:'disabled'|'isolated-qa';host:LauncherSnapshot|null}>;
  start():Promise<LauncherSnapshot>;stop():Promise<LauncherSnapshot|null>;checkHealth():Promise<LauncherSnapshot>;
}
const activation=z.strictObject({mode:z.enum(['disabled','isolated-qa']),packaged:z.boolean()});
/** Main-only service. Neither paths, activation nor Host observations are renderer inputs. */
export function createMainHostSession(input:unknown,factory:()=>HostPort,normal:()=>void):MainHostSession {
  const parsed=activation.safeParse(input);
  if(!parsed.success||(parsed.data.mode==='isolated-qa'&&parsed.data.packaged))throw new HostError('AuthenticationFailed');
  const mode=parsed.data.mode;
  let host:HostPort|null=null,closed=false,started=false;
  const update=(snapshot:LauncherSnapshot):LauncherSnapshot=>{
    if(snapshot.normalWindowRequested)normal();return snapshot;
  };
  return Object.freeze({
    get snapshot(){return Object.freeze({mode,host:host?.snapshot??null});},
    async start(){
      if(mode==='disabled')throw new HostError('AuthenticationFailed');
      if(closed||host?.snapshot.state==='CleanupUnknown')throw new HostError('CleanupUnknown');
      if(started)throw new HostError('AlreadyStarted');
      started=true;
      try{host=factory();return update(await host.start());}catch(error){normal();throw error;}
    },
    async stop(){closed=true;return host?update(await host.stop()):null;},
    async checkHealth(){
      if(closed||!host)throw new HostError('AuthenticationFailed');
      try{return update(await host.checkHealth());}catch(error){normal();throw error;}
    },
  });
}
