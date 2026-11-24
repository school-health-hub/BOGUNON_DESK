import {spawn} from 'node:child_process';
import {readFile,rm} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';

type InstallHandoff = Readonly<{
  installerPath:string;
  applicationPath:string;
  resultPath:string;
  parentPid:number;
  currentVersion:string;
  nextVersion:string;
  size:number;
  sha256:string;
}>;

const bootstrap=String.raw`
$ErrorActionPreference='Stop'
$state='launch-failed'
try { [IO.File]::WriteAllText($env:BOGUNON_UPDATE_RESULT,'armed') } catch { exit 8 }
try {
  $state='parent-wait'
  [IO.File]::WriteAllText($env:BOGUNON_UPDATE_RESULT,$state)
  try {
    $parent=[Diagnostics.Process]::GetProcessById([int]$env:BOGUNON_UPDATE_PARENT)
    if (-not $parent.WaitForExit(120000)) { $state='parent-timeout'; throw 'Parent did not exit' }
  } catch [ArgumentException] {}
  $state='installer-open'
  [IO.File]::WriteAllText($env:BOGUNON_UPDATE_RESULT,$state)
  $stream=[IO.File]::Open($env:BOGUNON_UPDATE_INSTALLER,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  try {
    $sha=[Security.Cryptography.SHA256]::Create()
    try { $digest=[BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
    if ($stream.Length -ne [long]::Parse($env:BOGUNON_UPDATE_SIZE) -or $digest -ne $env:BOGUNON_UPDATE_SHA256) {
      $state='rejected-hash'
    } else {
      $state='installer-start'
      [IO.File]::WriteAllText($env:BOGUNON_UPDATE_RESULT,$state)
      $start=[Diagnostics.ProcessStartInfo]::new($env:BOGUNON_UPDATE_INSTALLER)
      $start.UseShellExecute=$true
      $start.Arguments='/S'
      $start.WorkingDirectory=[IO.Path]::GetDirectoryName($env:BOGUNON_UPDATE_INSTALLER)
      $process=[Diagnostics.Process]::Start($start)
      if ($null -eq $process) { throw 'Installer did not start' }
      $state='installer-running'
      [IO.File]::WriteAllText($env:BOGUNON_UPDATE_RESULT,$state)
      $process.WaitForExit()
      if ($process.ExitCode -ne 0) { $state='installer-exit-failed' }
      else {
        $state='version-verification'
        [IO.File]::WriteAllText($env:BOGUNON_UPDATE_RESULT,$state)
        if (-not [IO.File]::Exists($env:BOGUNON_UPDATE_APP) -or [Diagnostics.FileVersionInfo]::GetVersionInfo($env:BOGUNON_UPDATE_APP).FileVersion -ne $env:BOGUNON_UPDATE_VERSION) { $state='version-verification-failed' }
        else { $state='installed:'+$env:BOGUNON_UPDATE_VERSION }
      }
    }
  } finally { $stream.Dispose() }
} catch {
  if ($state -eq 'parent-wait') { $state='parent-wait-failed' }
  elseif ($state -eq 'installer-open') { $state='installer-open-failed' }
  elseif ($state -eq 'installer-start') { $state='installer-start-failed' }
  elseif ($state -eq 'installer-running') { $state='installer-exit-failed' }
  elseif ($state -eq 'version-verification') { $state='version-verification-failed' }
}
try { [IO.File]::WriteAllText($env:BOGUNON_UPDATE_RESULT,$state) } catch {}
if ($state.StartsWith('installed:') -or ([IO.File]::Exists($env:BOGUNON_UPDATE_APP) -and [Diagnostics.FileVersionInfo]::GetVersionInfo($env:BOGUNON_UPDATE_APP).FileVersion -eq $env:BOGUNON_UPDATE_CURRENT)) {
  try {
    $restart=[Diagnostics.ProcessStartInfo]::new($env:BOGUNON_UPDATE_APP)
    $restart.UseShellExecute=$true
    $restart.WorkingDirectory=[IO.Path]::GetDirectoryName($env:BOGUNON_UPDATE_APP)
    [void][Diagnostics.Process]::Start($restart)
  } catch { try { [IO.File]::WriteAllText($env:BOGUNON_UPDATE_RESULT,'restart-failed') } catch {} }
}
`;

export async function startVerifiedUpdateInstaller(input:InstallHandoff):Promise<void>{
  const systemRoot=process.env.SystemRoot;
  if(process.platform!=='win32'||!systemRoot||![input.installerPath,input.applicationPath,input.resultPath].every(isAbsolute)||!Number.isSafeInteger(input.size)||input.size<1||!/^[a-f0-9]{64}$/.test(input.sha256)||!Number.isInteger(input.parentPid)||input.parentPid<1)throw new Error('Invalid Windows update handoff');
  const allowed=new Set(['systemroot','windir','path','appdata','localappdata','userprofile','temp','tmp','comspec','programfiles','programfiles(x86)','programw6432','systemdrive','homedrive','homepath','processor_architecture']);
  const environment=Object.fromEntries(Object.entries(process.env).filter(([key,value])=>allowed.has(key.toLowerCase())&&typeof value==='string'));
  const env={...environment,BOGUNON_UPDATE_INSTALLER:input.installerPath,BOGUNON_UPDATE_APP:input.applicationPath,BOGUNON_UPDATE_RESULT:input.resultPath,BOGUNON_UPDATE_PARENT:String(input.parentPid),BOGUNON_UPDATE_CURRENT:input.currentVersion,BOGUNON_UPDATE_VERSION:input.nextVersion,BOGUNON_UPDATE_SIZE:String(input.size),BOGUNON_UPDATE_SHA256:input.sha256};
  const command=Buffer.from(bootstrap,'utf16le').toString('base64');
  const trampoline=Buffer.from('& ([ScriptBlock]::Create([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($env:BOGUNON_UPDATE_BOOTSTRAP))))','utf16le').toString('base64');
  await rm(input.resultPath,{force:true});
  const child=spawn(join(systemRoot,'System32','cmd.exe'),['/d','/c',`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${trampoline}`],{cwd:join(systemRoot,'System32','WindowsPowerShell','v1.0'),env:{...env,BOGUNON_UPDATE_BOOTSTRAP:command},stdio:'ignore',windowsHide:true,detached:true});
  await new Promise<void>((resolve,reject)=>{child.once('error',reject);child.once('spawn',resolve);});
  for(let attempt=0;attempt<100;attempt++){
    try{
      const state=await readFile(input.resultPath,'utf8');
      if(['armed','parent-wait','installer-open','installer-start','installer-running','version-verification','rejected-hash'].includes(state)||state.startsWith('installed:')){child.unref();return;}
      throw new Error('Windows update helper could not prepare the installation');
    }catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='ENOENT'))throw error;}
    if(child.exitCode!==null)throw new Error('Windows update helper exited before installation');
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw new Error('Windows update helper did not start');
}
