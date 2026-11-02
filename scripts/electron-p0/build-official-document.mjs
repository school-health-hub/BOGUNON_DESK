import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync} from 'node:fs';
const release=process.argv.includes('--release');
execFileSync('cargo',['build','--locked','--manifest-path','tools/official-document-cli/Cargo.toml',...(release?['--release']:[])],{stdio:'inherit',env:{...process.env,...(process.platform==='win32'?{RUSTFLAGS:'-C target-feature=+crt-static'}:{})}});
if(release){mkdirSync('build/official-document-cli',{recursive:true});const name=process.platform==='win32'?'official-document-cli.exe':'official-document-cli';copyFileSync(`tools/official-document-cli/target/release/${name}`,`build/official-document-cli/${name}`);}
