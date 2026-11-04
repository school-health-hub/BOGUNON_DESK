import {readFile,lstat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
async function rustFiles(root){const files=[];for(const e of await readdir(root,{withFileTypes:true})){const path=join(root,e.name);if(e.isDirectory())files.push(...await rustFiles(path));else if(e.name.endsWith('.rs'))files.push(path);}return files.sort();}
export async function recordSources(){
 const files=[...await rustFiles('src-tauri/src/record_helper_import'),...await rustFiles('tools/record-helper-cli/src'),'tools/record-helper-cli/build.rs','tools/record-helper-cli/Cargo.toml','tools/record-helper-cli/Cargo.lock','tools/official-document-cli/src/limits.rs'];
 return Object.fromEntries(await Promise.all(files.map(async p=>[p.replaceAll('\\','/'),createHash('sha256').update(await readFile(p)).digest('hex')])));
}
export async function verifyRecordPackage(root,platform=process.platform){
 const name=platform==='win32'?'record-helper-cli.exe':'record-helper-cli',path=join(root,name),s=await lstat(path);if(!s.isFile()||s.isSymbolicLink())throw Error('Record helper must be a regular native resource');
 const bytes=await readFile(path),manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
 if((platform==='win32'?bytes.subarray(0,2).toString()!=='MZ':bytes.subarray(0,4).toString('hex')!=='7f454c46')||manifest.version!==1||manifest.platform!==platform||manifest.sha256!==createHash('sha256').update(bytes).digest('hex')||JSON.stringify(manifest.sources)!==JSON.stringify(await recordSources()))throw Error('Record helper provenance/runtime mismatch');
 return manifest;
}
