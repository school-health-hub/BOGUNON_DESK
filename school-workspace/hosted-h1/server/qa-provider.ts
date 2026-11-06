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
 let account=3;const auth=new H1Auth(new H1Http(config),vault,async()=>{throw Error('No external browser in isolated H1');},async()=>{const selected=c.accounts.find((a:{id:number})=>a.id===account);if(!selected)throw Error('qa_identity_missing');return {email:selected.email,password:selected.password};});await auth.restore();const runtime=createH1Runtime(auth);return {...runtime,accounts:c.accounts.map((a:{id:number;label:string})=>({id:a.id,label:a.label})),get account(){return account;},switchAccount:async(i:Record<string,unknown>)=>{if(Object.keys(i).join()!=='account'||!c.accounts.some((a:{id:number})=>a.id===i.account))throw Error('qa_account_denied');await runtime.switchAccount(i);account=Number(i.account);}};
}
