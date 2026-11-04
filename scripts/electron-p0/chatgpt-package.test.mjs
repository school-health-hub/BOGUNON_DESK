import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {coreHashes,adapterHashes,sha,verifyChatGptPackage} from './chatgpt-package.mjs';
test('fourth native resource ships outside ASAR with a verified source/executable manifest',async()=>{
 const root=await mkdtemp(join(tmpdir(),'chatgpt-package-'));try{
 const bytes=Buffer.from('synthetic executable, never run'),manifest={format:1,dirty:false,adapterSha256:await adapterHashes(),sourceSha:'a'.repeat(40),executable:'chatgpt-auth-cli.exe',executableSha256:sha(bytes),coreSha256:await coreHashes(),tauriDependency:false,credentialProtection:'Windows DPAPI user-scope'};
 await writeFile(join(root,manifest.executable),bytes);await writeFile(join(root,'manifest.json'),JSON.stringify(manifest));assert.equal((await verifyChatGptPackage(root,'win32')).sourceSha,manifest.sourceSha);
 await writeFile(join(root,manifest.executable),'tampered');await assert.rejects(verifyChatGptPackage(root,'win32'),/integrity/);
 await writeFile(join(root,manifest.executable),bytes);manifest.coreSha256['oauth.rs']='bad';await writeFile(join(root,'manifest.json'),JSON.stringify(manifest));await assert.rejects(verifyChatGptPackage(root,'win32'),/provenance/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('packaging builds the fourth helper and core reuse does not bring Tauri into the helper',async()=>{
 const pkg=JSON.parse(await readFile('package.json','utf8'));assert(pkg.scripts['electron:p0:package:win'].includes('build-chatgpt.mjs --release'));
 const cargo=await readFile('tools/chatgpt-auth-cli/Cargo.toml','utf8');assert(!/^tauri\s*=/m.test(cargo));assert(cargo.includes('windows-dpapi'));
 const adapter=await readFile('tools/chatgpt-auth-cli/build.rs','utf8');assert(adapter.includes('../../src-tauri/src/chatgpt'));assert(adapter.includes('tokio::task::spawn_blocking'));
});
