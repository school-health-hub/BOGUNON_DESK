# Never run this on a user's school/home PC. No operating-app uninstall path.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$OperatingInstaller,[Parameter(Mandatory=$true)][string]$QaInstaller)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') { throw 'Disposable GitHub-hosted Windows runner only' }
$operatingName='BOGUNON DESK'; $qaName='BOGUNON DESK MY FINANCE QA'
$operatingId='kr.sungandi.schoolhealthdesk'; $qaId='kr.sungandi.schoolhealthdesk.myfinanceqa'
$operatingDir=Join-Path $env:LOCALAPPDATA $operatingName; $qaDir=Join-Path $env:LOCALAPPDATA $qaName
$operatingExe=Join-Path $operatingDir 'school-health-desk.exe'; $qaExe=Join-Path $qaDir 'bogunon-desk-my-finance-qa.exe'
$operatingLocal=Join-Path $env:LOCALAPPDATA $operatingId; $operatingRoaming=Join-Path $env:APPDATA $operatingId
$qaLocal=Join-Path $env:LOCALAPPDATA $qaId; $qaRoaming=Join-Path $env:APPDATA $qaId
$out=Join-Path (Get-Location) 'artifacts/my-finance-qa-evidence'; New-Item -ItemType Directory -Force $out | Out-Null
$operatingRegistry="HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$operatingName"
$qaRegistry="HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$qaName"
foreach($path in @($operatingDir,$qaDir,$operatingLocal,$operatingRoaming,$qaLocal,$qaRoaming,$operatingRegistry,$qaRegistry)) { if(Test-Path -LiteralPath $path){throw 'Preexisting application state: refusing to touch this runner'} }
foreach($name in @('school-health-desk','bogunon-desk-my-finance-qa')){if(Get-Process -Name $name -ErrorAction SilentlyContinue){throw 'Preexisting app process'}}
$OperatingInstaller=(Resolve-Path $OperatingInstaller).Path; $QaInstaller=(Resolve-Path $QaInstaller).Path
$operatingInstallerHash=(Get-FileHash $OperatingInstaller -Algorithm SHA256).Hash
$qaInstallerHash=(Get-FileHash $QaInstaller -Algorithm SHA256).Hash
$rules=[Collections.Generic.List[string]]::new();$apps=[Collections.Generic.List[System.Diagnostics.Process]]::new()
function Block-App([string]$Path) {
 $name='Bogunon-Synthetic-QA-'+[guid]::NewGuid().ToString(); New-NetFirewallRule -DisplayName $name -Direction Outbound -Program $Path -Action Block -Profile Any | Out-Null; $rules.Add($name)
}
function Install([string]$Path) { $p=Start-Process -FilePath $Path -ArgumentList '/S' -Wait -PassThru; if($p.ExitCode -ne 0){throw "Installer failed: $($p.ExitCode)"} }
$tasks=[Collections.Generic.List[string]]::new()
function Start-MediumApp([string]$Path,[int]$Port) {
 # WebView2 >=150 intentionally drops debugger env overrides for elevated hosts.
 # A limited task uses the SAME user's profile and medium token, like a real PC.
 # No HKLM/HKCU policy, app config, runtime downgrade or ACL relaxation is used.
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
 $taskName='Bogunon-Synthetic-Launch-'+[guid]::NewGuid().ToString()
 $result=Join-Path $env:RUNNER_TEMP "$taskName.json"
 $worker=Join-Path $PSScriptRoot 'my-finance-medium-launch.ps1'
 $arguments="-NoProfile -NonInteractive -File `"$worker`" -AppPath `"$Path`" -DebugPort $Port -ExpectedSid `"$($identity.User.Value)`" -ResultFile `"$result`""
 $action=New-ScheduledTaskAction -Execute (Get-Process -Id $PID).Path -Argument $arguments
 $principal=New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
 $settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
 Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Settings $settings | Out-Null
 $tasks.Add($taskName);Start-ScheduledTask -TaskName $taskName
 $deadline=[DateTime]::UtcNow.AddSeconds(30)
 while(-not(Test-Path $result) -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 250}
 if(-not(Test-Path $result)){throw 'Limited launch task did not produce a process report'}
 $report=Get-Content $result -Raw|ConvertFrom-Json
 if($report.PSObject.Properties.Name -contains 'error'){throw "Limited launch task failed: $($report.error)"}
 if(-not $report.sameUser -or -not $report.mediumIntegrity){throw 'App launch must use same user and verified medium integrity'}
 return $report
}
function Launch([string]$Path,[int]$Port) {
 $report=Start-MediumApp $Path $Port
 if($report.hasExited){throw "App exited during launch: $($report.exitCode)"}
 $p=Get-Process -Id $report.pid;$apps.Add($p)
 return $p
}
function Stop-Owned([System.Diagnostics.Process]$Process) { if(-not $Process.HasExited){ & taskkill /PID $Process.Id /T /F | Out-Null; Start-Sleep -Seconds 3 };if(-not $Process.HasExited){throw 'Owned CI app did not stop'} }
function Launch-Evidence([int]$Port) {
 $app=$apps[$apps.Count-1];$app.Refresh()
 $all=@(Get-CimInstance Win32_Process)
 $ids=[Collections.Generic.HashSet[int]]::new();[void]$ids.Add($app.Id)
 do {$count=$ids.Count;foreach($item in $all){if($ids.Contains([int]$item.ParentProcessId)){[void]$ids.Add([int]$item.ProcessId)}}} while($ids.Count -gt $count)
 $children=@($all|Where-Object {$ids.Contains([int]$_.ProcessId) -and $_.Name -eq 'msedgewebview2.exe'}|ForEach-Object {
   $match=[regex]::Match([string]$_.CommandLine,'--remote-debugging-port=(\d+)')
   [ordered]@{pid=$_.ProcessId;parent=$_.ParentProcessId;requestedPortObserved=($match.Success -and $match.Groups[1].Value -eq [string]$Port)}
 })
 $listeners=@(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue|ForEach-Object {[ordered]@{address=$_.LocalAddress;owner=$_.OwningProcess}})
 $evidence=[ordered]@{pid=$app.Id;hasExited=$app.HasExited;hasMainWindow=($app.MainWindowHandle -ne 0);webviewProcesses=$children;port=$Port;listeners=$listeners}
 $json=$evidence|ConvertTo-Json -Depth 8 -Compress
 [IO.File]::WriteAllText((Join-Path $out "launch-$Port.json"),$json)
 return $json
}
function Probe([int]$Port,[string]$Mode,[string]$Name) {
 # Only synthetic CI probes run here. Preserve the actual failing stage in the
 # annotation; artifact/log downloads are not always available to API clients.
 $probeLog=Join-Path $out "$Name-probe.txt"
 & node scripts/qa/my-finance-qa-cdp.mjs $Port $Mode (Join-Path $out "$Name.json") 2>&1 | Tee-Object -FilePath $probeLog
 $exit=$LASTEXITCODE;$launch=Launch-Evidence $Port
 if($exit -ne 0){$detail=(Get-Content $probeLog -Tail 16)-join "`n";throw "Installed app probe failed: $Name`n$detail`nLaunch evidence: $launch"}
}
function Registry-State([string]$Root) {
 $values=[ordered]@{}
 if(Test-Path -LiteralPath $Root){foreach($key in @((Get-Item -LiteralPath $Root)) + @(Get-ChildItem -LiteralPath $Root -Recurse)){foreach($name in $key.GetValueNames()|Sort-Object){$values["$($key.Name)::$name"]=$key.GetValue($name)}}}
 return ($values|ConvertTo-Json -Depth 20 -Compress)
}
function Operating-State([switch]$StableOnly) {
 $state=[ordered]@{}; $roots=@($operatingDir)
 if($StableOnly){$roots+=@(Join-Path $operatingLocal 'my-finance');$roots+=@(Join-Path $operatingRoaming 'synthetic-preserved-work.json')}else{$roots+=@($operatingLocal,$operatingRoaming)}
 foreach($root in $roots){if(Test-Path -LiteralPath $root){foreach($file in Get-ChildItem -LiteralPath $root -Recurse -File -Force|Sort-Object FullName){$state[$file.FullName]=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash}}}
 foreach($root in @($operatingRegistry,"HKCU:\Software\Classes\school-health-desk","HKLM:\Software\Classes\school-health-desk","HKCU:\Software\School Health Desk\BOGUNON DESK","HKLM:\Software\School Health Desk\BOGUNON DESK","HKCU:\Software\Classes\AppUserModelId\$operatingId","HKCU:\Software\Microsoft\Windows\CurrentVersion\Run")){ $state[$root]=Registry-State $root }
 $runKey='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
 $state['operatingAutostart']=if(Test-Path $runKey){(Get-Item $runKey).GetValue('BOGUNON DESK')}else{$null}
 foreach($root in @((Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),[Environment]::GetFolderPath('Desktop'))){if(Test-Path $root){foreach($file in Get-ChildItem $root -Filter '*.lnk' -Recurse|Where-Object {$_.BaseName -eq $operatingName}){$state[$file.FullName]=(Get-FileHash $file.FullName).Hash}}}
 $state['operatingInstaller']=(Get-FileHash $OperatingInstaller).Hash
 return ($state|ConvertTo-Json -Depth 25 -Compress)
}
function Assert-State([string]$Before,[switch]$StableOnly) {if($Before -cne (Operating-State -StableOnly:$StableOnly)){throw 'Operating files/data/registrations changed during QA activity'} }
function Remove-Qa {
 if(-not(Test-Path $qaRegistry)){throw 'QA uninstall registration missing'}
 $entry=Get-ItemProperty -LiteralPath $qaRegistry
 $match=[regex]::Match([string]$entry.UninstallString,'^"([^"]+)"')
 if(-not $match.Success){throw 'Unrecognized QA uninstaller path'}
 $path=[IO.Path]::GetFullPath($match.Groups[1].Value)
 if(-not $path.StartsWith($qaDir+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Refusing non-QA uninstaller'}
 $p=Start-Process -FilePath $path -ArgumentList '/S' -Wait -PassThru;if($p.ExitCode -ne 0){throw 'QA uninstall failed'};Start-Sleep -Seconds 3
 if((Test-Path $qaRegistry) -or (Test-Path $qaExe)){throw 'QA uninstall incomplete'}
}
function Qa-Finance-State { $s=[ordered]@{};foreach($name in @('finance.db','key.dpapi')){$p=Join-Path $qaLocal "my-finance\$name";if(-not(Test-Path $p)){throw 'QA finance data missing'};$s[$name]=(Get-FileHash $p).Hash};return($s|ConvertTo-Json -Compress) }
try {
 # Block native and WebView networking before either installed app is launched.
 Block-App $operatingExe;Block-App $qaExe
 $webviews=@(Get-ChildItem "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application" -Filter msedgewebview2.exe -Recurse -ErrorAction SilentlyContinue)
 if(-not $webviews.Count){throw 'Cannot establish WebView outbound isolation'}
 foreach($webview in $webviews){Block-App $webview.FullName}
 Install $OperatingInstaller
 if(-not(Test-Path $operatingExe) -or -not(Test-Path $operatingRegistry)){throw 'Operating baseline installation mismatch'}
 $prod=Launch $operatingExe 9223;Probe 9223 operating 'operating-synthetic-work';Stop-Owned $prod
 New-Item -ItemType Directory -Force $operatingRoaming | Out-Null
 [IO.File]::WriteAllText((Join-Path $operatingRoaming 'synthetic-preserved-work.json'),'{"synthetic":true,"preserve":"operating work"}')
 $env:BOGUNON_SEED_ISOLATION_FIXTURE='SYNTHETIC_ONLY'
 & cargo test --locked --manifest-path src-tauri/Cargo.toml my_finance_qa_seed_operating_fixture -- --ignored
 if($LASTEXITCODE -ne 0){throw 'Could not seed actual SQLCipher/DPAPI operating fixture'}
 Remove-Item Env:BOGUNON_SEED_ISOLATION_FIXTURE
 $baseline=Operating-State;[IO.File]::WriteAllText((Join-Path $out 'operating-before.json'),$baseline)
 Install $QaInstaller;Assert-State $baseline
 if(-not(Test-Path $qaExe) -or -not(Test-Path $qaRegistry)){throw 'QA must have separate executable/registration'}
 $qa=Launch $qaExe 9224;Probe 9224 qa-seed 'qa-native-first-launch';Stop-Owned $qa
 Assert-State $baseline
 $finance=Qa-Finance-State
 Remove-Qa;Assert-State $baseline
 if($finance -cne (Qa-Finance-State)){throw 'QA uninstall changed financial DB/key'}
 [IO.File]::WriteAllText((Join-Path $out 'operating-after-qa-cycle.json'),(Operating-State))
 # Simultaneous apps/single instances and QA removal while operating stays alive.
 Install $QaInstaller; $prod=Launch $operatingExe 9223;$stable=Operating-State -StableOnly
 $qa=Launch $qaExe 9224;Probe 9224 qa-reopen 'qa-native-reinstall'
 foreach($pair in @(@($operatingExe,9223),@($qaExe,9224))){$second=Start-MediumApp $pair[0] $pair[1];if(-not $second.hasExited){$apps.Add((Get-Process -Id $second.pid));throw 'Single instance isolation failed'};if($second.exitCode -ne 0){throw 'Second instance crashed'}}
 if($prod.HasExited -or $qa.HasExited){throw 'Apps cannot coexist'}
 Assert-State $stable -StableOnly
 Stop-Owned $qa;$finance=Qa-Finance-State;Remove-Qa
 if($prod.HasExited){throw 'QA uninstall stopped operating app'}
 Assert-State $stable -StableOnly
 if($finance -cne (Qa-Finance-State)){throw 'QA financial data lost after second uninstall'}
 Stop-Owned $prod
 if((Get-FileHash $OperatingInstaller).Hash -ne $operatingInstallerHash -or (Get-FileHash $QaInstaller).Hash -ne $qaInstallerHash){throw 'Installer bytes changed'}
 $signature=Get-AuthenticodeSignature -LiteralPath $QaInstaller
 $result=[ordered]@{status='passed';sourceSha=$env:QA_EXPECTED_SOURCE_SHA;operatingReferenceSha='5cec64358436c148710499b5aa9d2e78c34e0136';sha256=$qaInstallerHash.ToLowerInvariant();authenticodeStatus=[string]$signature.Status;signer=if($signature.SignerCertificate){$signature.SignerCertificate.Subject}else{$null};fullOperatingTreePreservedWhenClosed=$true;operatingFinancialDataPreservedWhileRunning=$true;simultaneousExecution=$true;qaUninstallPreservedBothFinancialStores=$true;operatingNeverUninstalled=$true;outboundBlockedInDisposableRunner=$true;sameUserMediumIntegrityLaunch=$true;nativeDebugPort='CI environment only, not embedded in installer'}
 $result|ConvertTo-Json -Depth 10|Set-Content (Join-Path $out 'ISOLATION.json') -Encoding utf8
 Write-Output "::notice title=MY_FINANCE_QA_SHA256::$($result.sha256)"
 Write-Output "::notice title=MY_FINANCE_QA_SIGNATURE::$($result.authenticodeStatus)"
 Write-Output '::notice title=MY_FINANCE_QA_ISOLATION::PASSED; operating reference preserved; synthetic GitHub runner only'
} finally {
 foreach($p in $apps){if(-not $p.HasExited){Stop-Owned $p}}
 foreach($name in $tasks){Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue;Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue}
 foreach($name in $rules){Remove-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue}
}
