import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync} from 'node:fs';
// Original MY FINANCE SQLCipher + DPAPI is Windows-only. No replacement cipher on Linux.
if(process.platform!=='win32'){console.log('MY FINANCE DPAPI runtime: Windows only; no plaintext fallback built.');process.exit(0);}
const release=process.argv.includes('--release');
execFileSync('cargo',['build','--locked','--manifest-path','tools/my-finance-cli/Cargo.toml',...(release?['--release']:[])],{stdio:'inherit'});
if(release){mkdirSync('build/my-finance-cli',{recursive:true});copyFileSync('tools/my-finance-cli/target/release/my-finance-cli.exe','build/my-finance-cli/my-finance-cli.exe');}
