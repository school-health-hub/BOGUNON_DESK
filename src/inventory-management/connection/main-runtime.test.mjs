import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
it('Main-only entry compiles and executes as native Node ESM without Vite env or UI imports',()=>{
  const out=mkdtempSync(join(tmpdir(),'inventory-native-main-'));
  try {
    execFileSync(process.execPath,[resolve('node_modules/typescript/bin/tsc'),'src/inventory-management/connection/electron.ts','--ignoreConfig','--outDir',out,'--target','ES2022','--module','ES2022','--moduleResolution','bundler','--types','vite/client','--lib','ES2022,DOM','--skipLibCheck','--strict'],{stdio:'pipe'});
    writeFileSync(join(out,'package.json'),' {"type":"module"}');
    const script=`import {createElectronInventoryConnection} from ${JSON.stringify(pathToFileURL(join(out,'electron.js')).href)};
      const opts={enabled:true,host:{readExecutionState:()=>({packaged:false,devUrl:'http://127.0.0.1:5174/',optIn:'1'})},endpoint:'http://127.0.0.1:56321',publishableKey:'sb_publishable_synthetic',transport:{kind:'electron-local-qa',version:1,send:async()=>{throw Error('No network expected');}}};
      if(process.env.NODE_ENV==='production'){try{createElectronInventoryConnection(opts);process.exit(2);}catch(e){if(e.code!=='ENVIRONMENT_BLOCKED')throw e;}}
      else{const c=createElectronInventoryConnection(opts);if(c.authState().status!=='signed_out')process.exit(3);c.dispose();}`;
    for(const mode of ['development','production'])expect(()=>execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,NODE_ENV:mode},stdio:'pipe'})).not.toThrow();
  } finally {rmSync(out,{recursive:true,force:true});}
},15000);
