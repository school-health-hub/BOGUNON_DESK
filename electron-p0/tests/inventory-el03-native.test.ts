import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {expect,it} from 'vitest';
it('runs the unmodified vendor factory in native Node Main ESM and refuses production without Vite shims or network',()=>{
 const root=mkdtempSync(join(tmpdir(),'inventory-el03-native-'));
 try{
  execFileSync(process.execPath,['node_modules/typescript/bin/tsc','electron-p0/main/inventory-connection/electron.ts','--ignoreConfig','--outDir',root,'--target','ES2022','--module','ES2022','--moduleResolution','bundler','--types','vite/client','--lib','ES2022,DOM','--skipLibCheck','--strict'],{encoding:'utf8',stdio:'pipe'});
  writeFileSync(join(root,'package.json'),'{"type":"module"}');
  const url=pathToFileURL(resolve(root,'electron.js')).href;
  const script=`import {createElectronInventoryConnection} from ${JSON.stringify(url)};const options={enabled:true,endpoint:'http://127.0.0.1:56321',publishableKey:'sb_publishable_synthetic',host:{readExecutionState:()=>({packaged:false,devUrl:'http://127.0.0.1:5174/',optIn:'1'})},transport:{kind:'electron-local-qa',version:1,send:async()=>{throw Error('No network in this test')}}};try{const c=createElectronInventoryConnection(options);if(c.authState().status!=='signed_out')process.exit(2);c.dispose();process.stdout.write('DEVELOPMENT_ONLY');}catch(e){if(e.code!=='ENVIRONMENT_BLOCKED')process.exit(3);process.stdout.write('BLOCKED');}`;
  expect(execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,NODE_ENV:'development'}})).toBe('DEVELOPMENT_ONLY');
  expect(execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,NODE_ENV:'production'}})).toBe('BLOCKED');
 }finally{rmSync(root,{recursive:true,force:true});}
},15000);
