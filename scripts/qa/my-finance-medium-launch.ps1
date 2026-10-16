# Worker for the GitHub-hosted isolation script's temporary, limited-runlevel task.
# Never install, remove, reset, or change any app/OS settings here.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$AppPath,
 [Parameter(Mandatory=$true)][int]$DebugPort,
 [Parameter(Mandatory=$true)][string]$ExpectedSid,
 [Parameter(Mandatory=$true)][string]$ResultFile
)
$ErrorActionPreference='Stop'
try {
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
 $principal=[Security.Principal.WindowsPrincipal]::new($identity)
 $groups=(& whoami /groups /fo csv /nh) -join "`n"
 $medium=($groups -match 'S-1-16-8192') -and -not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
 if($identity.User.Value -ne $ExpectedSid -or -not $medium){throw 'Refusing wrong user or elevated app launch'}
 $start=[System.Diagnostics.ProcessStartInfo]::new($AppPath)
 $start.UseShellExecute=$false
 $start.Environment['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS']="--remote-debugging-port=$DebugPort"
 $process=[System.Diagnostics.Process]::Start($start)
 Start-Sleep -Seconds 4
 $exited=$process.HasExited
 $result=[ordered]@{pid=$process.Id;hasExited=$exited;exitCode=if($exited){$process.ExitCode}else{$null};sameUser=$true;mediumIntegrity=$true}
 [IO.File]::WriteAllText($ResultFile,($result|ConvertTo-Json -Compress))
} catch {
 # Static test diagnostics only; never emit process environment or app data.
 [IO.File]::WriteAllText($ResultFile,(@{error=$_.Exception.Message}|ConvertTo-Json -Compress))
 exit 1
}
