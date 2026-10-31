import { spawnSync,execFileSync } from 'node:child_process';
if(process.platform!=='win32'||!process.env.npm_execpath)throw Error('Use npm run electron:p0:ci:windows on Windows');
execFileSync('git',['diff','--exit-code','a7717f1e1b2234a568f8877adae8c42f8a4d262b','--','src','src-tauri'],{stdio:'inherit'});
for(const task of ['electron:p0:build','test','build','electron:p0:package:win','electron:p0:test:e2e']){
 const env={...process.env};
 if(task==='electron:p0:test:e2e')env.ELECTRON_P0_EXECUTABLE=`${process.cwd()}/release-electron-p0/win-unpacked/BOGUNON DESK ELECTRON P0.exe`;
 const result=spawnSync(process.execPath,[process.env.npm_execpath,'run',task,...(task==='test'?['--','--maxWorkers=4']:[])],{encoding:'utf8',env,maxBuffer:64*1024*1024,timeout:15*60*1000});
 process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
 if(result.status!==0){
  const detail=`${task}: ${result.error?.message??''}\n${(result.stdout??'')+(result.stderr??'')}`.split('\n').slice(-25).join('\n').replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
  console.log(`::error title=ELECTRON_P0_CHECK_FAILURE::${detail}`);process.exit(result.status??1);
 }
}
