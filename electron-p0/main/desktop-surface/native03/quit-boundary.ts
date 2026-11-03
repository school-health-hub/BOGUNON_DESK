import type {MainHostSession} from './main-session.js';
import {fixedError} from '../native02/errors.js';
export interface QuitApp {
  on(event:'before-quit',listener:(event:{preventDefault():void})=>void):unknown;
  quit():void;
}
/** Hold ordinary windows until the existing bounded Host stop and diagnostic flush complete. */
export function installNativeQuitBoundary(app:QuitApp,session:MainHostSession,
  flushed:(error:string|null)=>Promise<void>):void {
  let closing:Promise<void>|null=null,finished=false;
  app.on('before-quit',event=>{
    if(finished)return;
    event.preventDefault();
    closing??=(async()=>{
      let error:string|null=null;
      try{await session.stop();}catch(cause){error=fixedError(cause).code;}
      try{await flushed(error);}finally{finished=true;app.quit();}
    })();
    // Top-level lifecycle boundary: a diagnostic write failure must not become an unhandled rejection.
    void closing.catch(()=>{if(!finished){finished=true;app.quit();}});
  });
}
