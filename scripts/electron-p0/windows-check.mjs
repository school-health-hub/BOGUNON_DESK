import { spawnSync,execFileSync } from 'node:child_process';
import { mkdirSync,existsSync,readFileSync,readdirSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
if(process.platform!=='win32'||!process.env.npm_execpath)throw Error('Use npm run electron:p0:ci:windows on Windows');
const ps=script=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop'; ${script}`],{encoding:'utf8'}).trim();
const run=(args,env=process.env)=>{
 const r=spawnSync(process.execPath,args,{encoding:'utf8',env,maxBuffer:64*1024*1024,timeout:15*60*1000});
 process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');
 if(r.status!==0)throw Error(`${args.join(' ')}: ${r.error?.message??''}\n${(r.stdout??'').split('\n').filter(l=>l.includes('P1B_DIAGNOSTIC')||l.includes('P2D2_DIAGNOSTIC')).join('\n')}\n${((r.stdout??'')+(r.stderr??'')).split('\n').slice(-25).join('\n')}`);
};
const npm=(task,env)=>run([process.env.npm_execpath,'run',task],env);
const report={baseline:'ac31d15cfd49820925776f2b1fd0a0a46200bab4',sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineRegression:'REUSED: P0 CI 41236999963',installation:'NOT RUN',installedUiAndRestart:'NOT RUN',uninstallAndSettingsRetention:'NOT RUN',physicalWindowsPc:'NOT RUN'};
try{
 execFileSync('git',['diff','--exit-code',report.baseline,'--','src','src-tauri',':(exclude)src/newsletter/NewsletterStudio.tsx'],{stdio:'inherit'});
 report.elevated=ps('[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)')==='True';
 if(!report.elevated&&(existsSync(join(process.env.LOCALAPPDATA,'Programs','BOGUNON DESK ELECTRON P0'))||existsSync(join(process.env.APPDATA,'BOGUNON-DESK-ELECTRON-P0'))))throw Error('Existing PoC installation/profile: refuse installation');
 report.windows=ps('(Get-CimInstance Win32_OperatingSystem).Version');
 // Build once; the package script intentionally remains compatible with P0 portable users.
 npm('electron:p0:build');
 run([process.env.npm_execpath,'exec','--','vitest','run','electron-p0/tests','src/newsletter','--maxWorkers=4']);
 run(['node_modules/electron-builder/out/cli/cli.js','--config','electron-p0/builder.json','--win','portable','nsis','--x64','--publish','never']);
 report.packaging='PASS';
 npm('electron:p0:test:e2e',{...process.env,ELECTRON_P0_EXECUTABLE:join(process.cwd(),'release-electron-p0/win-unpacked/BOGUNON DESK ELECTRON P0.exe')});
 report.packagedUi='PASS';
 if(report.elevated){
  report.reason='Runner token is elevated. No installation/uninstallation attempted; no token manipulation or elevation bypass.';
  console.log('::warning title=ELECTRON_P1A_NOT_RUN::Non-elevated installation, installed UI/restart and removal NOT RUN: elevated runner');
 }else{
  const install=join(process.env.LOCALAPPDATA,'Programs','BOGUNON DESK ELECTRON P0');
  const profile=join(process.env.APPDATA,'BOGUNON-DESK-ELECTRON-P0');
  // Never replace an existing installation or profile. CI must be disposable.
  if(existsSync(install))throw Error('Existing PoC installation: refuse replacement');
  const setup=readdirSync('release-electron-p0').filter(n=>n.includes('-Setup-')&&n.endsWith('.exe'));
  if(setup.length!==1)throw Error('Ambiguous NSIS installer');
  const q=s=>`'${s.replaceAll("'","''")}'`;
  ps(`$p=Start-Process -FilePath ${q(join(process.cwd(),'release-electron-p0',setup[0]))} -ArgumentList '/S' -Wait -PassThru; if($p.ExitCode -ne 0){throw "Install failed: $($p.ExitCode)"}`);
  const exe=join(install,'BOGUNON DESK ELECTRON P0.exe');
  if(!existsSync(exe))throw Error('Installed executable missing');
  report.installation='PASS';
  npm('electron:p0:test:e2e',{...process.env,ELECTRON_P0_EXECUTABLE:exe});
  report.installedUiAndRestart='PASS';
  // Existing E2E writes only isolated test-runs/<UUID> settings, never a real profile.
  const settings=()=>readdirSync(join(profile,'test-runs')).map(id=>join(profile,'test-runs',id,'poc-settings','layout.json')).filter(existsSync);
  const saved=settings().map(path=>({path,data:readFileSync(path,'utf8')}));
  if(saved.length<2)throw Error('Expected portable and installed synthetic settings files');
  const uninstaller=readdirSync(install).filter(n=>/^Uninstall.*\.exe$/i.test(n));
  if(uninstaller.length!==1)throw Error('Ambiguous uninstaller');
  ps(`$p=Start-Process -FilePath ${q(join(install,uninstaller[0]))} -ArgumentList '/S',${q('_?='+install)} -Wait -PassThru; if($p.ExitCode -ne 0){throw "Uninstall failed: $($p.ExitCode)"}`);
  if(existsSync(exe)||saved.some(s=>!existsSync(s.path)||readFileSync(s.path,'utf8')!==s.data))throw Error('Uninstall removal/settings preservation failed');
  report.uninstallAndSettingsRetention='PASS';
 }
 report.verdict=report.elevated?'CONDITIONAL':'PASS';
}catch(error){report.verdict='BLOCKED';report.error=error.message;console.error(`::error title=ELECTRON_P1A_FAILURE::${error.message.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')}`);process.exitCode=1;}
finally{mkdirSync('release-electron-p0',{recursive:true});writeFileSync('release-electron-p0/P1A-QA-RESULT.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
