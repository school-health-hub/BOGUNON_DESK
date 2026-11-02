import { it, expect } from 'vitest';
import { build } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
it('real production builds reject Electron opt-in and exclude transport from public entry',async()=>{
  const previousNodeEnv=process.env.NODE_ENV;process.env.NODE_ENV='production';
  const out=await mkdtemp(join(tmpdir(),'inventory-transport-prod-'));
  try {
    let sent=0;
    const config={enabled:true,host:{readExecutionState:()=>({packaged:false,devUrl:'http://127.0.0.1:5174/',optIn:'1'})},endpoint:'http://127.0.0.1:56321',publishableKey:'sb_publishable_synthetic',transport:{kind:'electron-local-qa',version:1,send:async()=>{sent++;throw Error('Production send');}}};
    for(const entry of ['index.ts','electron.ts']) {
      const result=await build({configFile:false,logLevel:'error',mode:'production',build:{outDir:join(out,entry),lib:{entry:resolve('src/inventory-management/connection',entry),formats:['es'],fileName:()=> 'connection.mjs'},minify:true}});
      if(entry==='index.ts')expect((Array.isArray(result)?result:[result]).flatMap(r=>r.output).filter(o=>o.type==='chunk').every(c=>!Object.keys(c.modules).some(m=>m.endsWith('/transport.ts') || m.endsWith('/localQa.ts')))).toBe(true);
      const api=await import(pathToFileURL(join(out,entry,'connection.mjs')).href);
      if(entry==='index.ts')await expect(api.createElectronInventoryConnection(config)).rejects.toMatchObject({code:'ENVIRONMENT_BLOCKED'});
      else expect(()=>api.createElectronInventoryConnection(config)).toThrow('ENVIRONMENT_BLOCKED');
    }
    expect(sent).toBe(0);
  } finally {if(previousNodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousNodeEnv;await rm(out,{recursive:true,force:true});}
});
