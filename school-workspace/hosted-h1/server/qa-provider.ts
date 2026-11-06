/** External QA module only. Main loads it only with the H1 isolated gate. */
import {readFile,lstat} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {H1Http,checkedConfig} from './http.js';
import {H1Auth} from './auth.js';
import {createH1Runtime} from './runtime.js';
import {WindowsSessionVault,FileSessionBlob,type SafeStoragePort} from '../../auth/electron/vault.js';
export async function createRuntime(o:{safeStorage:SafeStoragePort;profileDirectory:string}){
 const root=resolve(process.env.ELECTRON_P0_QA_ROOT??''),path=resolve(process.env.SCHOOL_H1_QA_CONFIG??'');const rel=relative(root,path);
 if(!root||!rel||rel.startsWith('..')||isAbsolute(rel)||(await lstat(path)).isSymbolicLink()||(await lstat(path)).size>8192)throw Error('h1_config_denied');
 const c=JSON.parse(await readFile(path,'utf8'));const config=checkedConfig({mode:'isolated-test',origin:c.origin,publicKey:c.publicKey});
 const vault=new WindowsSessionVault(o.safeStorage,new FileSessionBlob(join(o.profileDirectory,'hosted-h1')));
 const auth=new H1Auth(new H1Http(config),vault,async()=>{throw Error('No external browser in isolated H1');},async()=>({email:c.email,password:c.password}));await auth.restore();return createH1Runtime(auth);
}
