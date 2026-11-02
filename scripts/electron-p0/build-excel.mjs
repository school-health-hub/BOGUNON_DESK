import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync} from 'node:fs';
const release=process.argv.includes('--release'),windows=process.platform==='win32';
const target='x86_64-pc-windows-msvc';
execFileSync('cargo',['build','--locked','--manifest-path','tools/purchase-excel-cli/Cargo.toml',...(windows&&release?['--target',target]:[]),...(release?['--release']:[])],{stdio:'inherit',env:{...process.env,...(windows?{CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS:'-C target-feature=+crt-static'}:{})}});
if(release){mkdirSync('build/purchase-excel-cli',{recursive:true});const name=windows?'purchase-excel-cli.exe':'purchase-excel-cli';copyFileSync(`tools/purchase-excel-cli/target/${windows?target+'/':''}release/${name}`,`build/purchase-excel-cli/${name}`);}
