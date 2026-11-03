// QA-only bootstrap. Installed into build output, never product source.
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const {syncBuiltinESMExports}=require('node:module');
const {ipcMain}=require('electron');
let seq=0;
const emit=(event,details={})=>fs.appendFileSync(process.env.SETTINGS_QA_LOG,JSON.stringify({seq:++seq,time:Date.now(),event,...details})+'\n');
const target=p=>typeof p==='string'&&p.includes('poc-settings')&&/^layout(?:-[a-f0-9-]+)?\.(?:json|tmp)$/.test(path.basename(p));
for(const name of ['readFile','open','rename','unlink']){
 const original=fsp[name];
 fsp[name]=async function(...args){
  const observed=target(args[0])||target(args[1]);
  if(observed)emit('fs-start',{op:name,file:path.basename(String(args[0])),...(name==='rename'?{dest:path.basename(String(args[1]))}:{})});
  try{if(observed&&name==='rename'&&global.__settingsQaDenyRename)throw Object.assign(new Error('QA injected permanent replacement denial'),{code:'EPERM',syscall:'rename'});const result=await original.apply(this,args);if(observed)emit('fs-ok',{op:name});return result;}
  catch(error){if(observed){emit('fs-error',{op:name,code:error.code??'UNKNOWN',syscall:error.syscall??'UNKNOWN',injected:!!global.__settingsQaDenyRename});console.log(`::notice title=SETTINGS_FS_ERROR::op=${name} code=${error.code??'UNKNOWN'} syscall=${error.syscall??'UNKNOWN'}`);}throw error;}
 };
}
syncBuiltinESMExports();
const handle=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,listener)=>handle(channel,async(event,...args)=>{
 if(!['p0:read-settings','p0:write-settings'].includes(channel))return listener(event,...args);
 const id=++seq;emit('ipc-start',{id,channel,corner:channel==='p0:write-settings'?args[0]?.dashboard?.appearance?.cornerStyle:undefined});
 try{const result=await listener(event,...args);emit('ipc-ok',{id,channel,corner:channel==='p0:read-settings'?result?.dashboard?.appearance?.cornerStyle:undefined});return result;}
 catch(error){emit('ipc-error',{id,channel,code:error.code??'GENERIC',message:error.message});throw error;}
});
import('./main/main.mjs');
