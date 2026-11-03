import assert from 'node:assert/strict';
import {createNativeSurfaceBoundary} from '../main/desktop-surface/boundary.js';
import type {Result} from '../main/desktop-surface/types.js';

export const binding = {
  attempt:{generation:1n,nonce:2n},
  owner:{pid:100,creationTime:1000n,imageSha256:'a'.repeat(64),sessionId:1n},
  explorer:{generation:1n,process:{pid:200,creationTime:2000n,imageSha256:'b'.repeat(64),sessionId:1n}},
} as const;
export const runtime = {
  environment:11n,
  browser:{pid:300,creationTime:3000n,imageSha256:'c'.repeat(64),sessionId:1n},
  udf:{volume:1n,file:2n},
} as const;
export function accepted<T>(result:Result<T>):T {
  if(!result.ok)assert.fail(result.error);
  return result.value;
}
export function fixture(){
  const ports=accepted(createNativeSurfaceBoundary(binding));
  const boundary={get snapshot(){return ports.main.snapshot;},main:ports.main.request,
    host:ports.host.observe,explorerChanged:ports.main.explorerChanged};
  let mainSequence=0n,hostSequence=0n;
  const main=(kind:string,fields:Readonly<Record<string,unknown>>={})=>boundary.main({
    ...binding,sequence:++mainSequence,kind,...fields,
  });
  const host=(kind:string,fields:Readonly<Record<string,unknown>>={})=>boundary.host({
    ...binding,sequence:++hostSequence,kind,...fields,
  });
  const start=()=>{
    accepted(main('Attach'));
    accepted(host('HostStarted'));
    accepted(host('ResourceAcquired',{resource:'Environment',identity:11n}));
    accepted(host('RuntimeBound',{runtime}));
  };
  const retiring=()=>{start();accepted(main('Cancel'));accepted(host('CleanupStarted'));};
  const finish=()=>{
    accepted(host('ResourceReleased',{resource:'Environment',identity:11n}));
    accepted(host('BrowserExited',{exit:{environment:11n,browser:runtime.browser,normalExit:true}}));
    accepted(host('HostExited'));
    return host('CleanupFinished');
  };
  return {boundary,main,host,start,retiring,finish};
}
