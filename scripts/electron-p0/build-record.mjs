import {execFileSync} from 'node:child_process';import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {recordSources,verifyRecordPackage} from './record-package.mjs';
const release=process.argv.includes('--release');
execFileSync('cargo',['build','--locked','--manifest-path','tools/record-helper-cli/Cargo.toml',...(release?['--release']:[])],{stdio:'inherit',env:{...process.env,...(process.platform==='win32'?{RUSTFLAGS:'-C target-feature=+crt-static'}:{})}});
const root='build/record-helper-cli',name=process.platform==='win32'?'record-helper-cli.exe':'record-helper-cli';await mkdir(root,{recursive:true});await copyFile(`tools/record-helper-cli/target/${release?'release':'debug'}/${name}`,`${root}/${name}`);
const sha256=createHash('sha256').update(await readFile(`${root}/${name}`)).digest('hex');await writeFile(`${root}/manifest.json`,JSON.stringify({version:1,platform:process.platform,sha256,sources:await recordSources()},null,2));await verifyRecordPackage(root);
