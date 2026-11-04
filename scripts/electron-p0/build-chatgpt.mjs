import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {coreHashes,adapterHashes,sha,verifyChatGptPackage} from './chatgpt-package.mjs';
const release=process.argv.includes('--release'),windows=process.platform==='win32';
execFileSync('cargo',['build','--locked','--manifest-path','tools/chatgpt-auth-cli/Cargo.toml',...(release?['--release']:[])],{stdio:'inherit'});
if(release){mkdirSync('build/chatgpt-auth-cli',{recursive:true});const name=windows?'chatgpt-auth-cli.exe':'chatgpt-auth-cli';copyFileSync(`tools/chatgpt-auth-cli/target/release/${name}`,`build/chatgpt-auth-cli/${name}`);writeFileSync('build/chatgpt-auth-cli/manifest.json',JSON.stringify({format:1,dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),adapterSha256:await adapterHashes(),sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),executable:name,executableSha256:sha(readFileSync(`build/chatgpt-auth-cli/${name}`)),coreSha256:await coreHashes(),tauriDependency:false,credentialProtection:'Windows DPAPI user-scope'},null,2));await verifyChatGptPackage();}
