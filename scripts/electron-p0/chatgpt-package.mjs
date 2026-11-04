import {readFile,lstat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function coreHashes(root='src-tauri/src/chatgpt',prefix=''){
 const hashes={};for(const entry of await readdir(join(root,prefix),{withFileTypes:true})){const name=prefix?`${prefix}/${entry.name}`:entry.name;if(entry.isDirectory())Object.assign(hashes,await coreHashes(root,name));else if(name.endsWith('.rs'))hashes[name]=sha(await readFile(join(root,name)));}return hashes;
}
export async function adapterHashes(){
 const result={};for(const name of ['Cargo.toml','Cargo.lock','build.rs','src/main.rs','src/images.rs'])result[name]=sha(await readFile(join('tools/chatgpt-auth-cli',name)));result['image-capabilities.json']=sha(await readFile('electron-p0/ai-image-capabilities.json'));return result;
}
export async function verifyChatGptPackage(root='build/chatgpt-auth-cli',platform=process.platform){
 const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
 const name=platform==='win32'?'chatgpt-auth-cli.exe':'chatgpt-auth-cli';
 if(manifest.format!==1||manifest.executable!==name||!/^([a-f0-9]{40})$/.test(manifest.sourceSha)||manifest.credentialProtection!=='Windows DPAPI user-scope'||manifest.tauriDependency!==false||typeof manifest.dirty!=='boolean')throw Error('Invalid ChatGPT native manifest');
 const info=await lstat(join(root,name));if(!info.isFile()||info.isSymbolicLink()||info.size<1||info.size>100*1024*1024||sha(await readFile(join(root,name)))!==manifest.executableSha256)throw Error('ChatGPT helper integrity mismatch');
 const expected=await coreHashes();if(JSON.stringify(Object.entries(expected).sort())!==JSON.stringify(Object.entries(manifest.coreSha256??{}).sort()))throw Error('ChatGPT source provenance mismatch');
 const adapters=await adapterHashes();if(JSON.stringify(Object.entries(adapters).sort())!==JSON.stringify(Object.entries(manifest.adapterSha256??{}).sort()))throw Error('ChatGPT adapter provenance mismatch');
 const config=JSON.parse(await readFile('electron-p0/builder.json','utf8'));
 if(!config.files.includes('chatgpt-protocol.js')||!config.extraResources.some(r=>r.from==='build/chatgpt-auth-cli'&&r.to==='chatgpt-auth-cli'&&r.filter.includes(name)&&r.filter.includes('manifest.json')))throw Error('ChatGPT helper excluded by builder');
 return manifest;
}
