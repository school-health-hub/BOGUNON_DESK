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
function Launch([string]$Path,[int]$Port) {
 $old=$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
 try {$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=$Port"; $p=Start-Process -FilePath $Path -PassThru; $apps.Add($p); Start-Sleep -Seconds 4; if($p.HasExited){throw 'App exited during launch'};return $p}
 finally {if($null -eq $old){Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue}else{$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=$old}}
}
function Stop-Owned([System.Diagnostics.Process]$Process) { if(-not $Process.HasExited){ & taskkill /PID $Process.Id /T /F | Out-Null; Start-Sleep -Seconds 3 };if(-not $Process.HasExited){throw 'Owned CI app did not stop'} }
function Probe([int]$Port,[string]$Mode,[string]$Name) { & node scripts/qa/my-finance-qa-cdp.mjs $Port $Mode (Join-Path $out "$Name.json"); if($LASTEXITCODE -ne 0){throw "Installed app probe failed: $Name"} }
function Registry-State([string]$Root) {
 $values=[ordered]@{}
 if(Test-Path -LiteralPath $Root){foreach($key in @((Get-Item -LiteralPath $Root)) + @(Get-ChildItem -LiteralPath $Root -Recurse)){foreach($name in $key.GetValueNames()|Sort-Object){$values["$($key.Name)::$name"]=$key.GetValue($name)}}}
 return ($values|ConvertTo-Json -Depth 20 -Compress)
}
function Operating-State([switch]$StableOnly) {
 $state=[ordered]@{}; $roots=@($operatingDir)
 if($StableOnly){$roots+=@(Join-Path $operatingLocal 'my-finance');$roots+=@(Join-Path $operatingRoaming 'synthetic-preserved-work.json')}else{$roots+=@($operatingLocal,$operatingRoaming)}
 foreach($root in $roots){if(Test-Path -LiteralPath $root){foreach($file in Get-ChildItem -LiteralPath $root -Recurse -File -Force|Sort-Object FullName){$state[$file.FullName]=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash}}}
 foreach($root in @($operatingRegistry,"HKCU:\Software\Classes\school-health-desk","HKLM:\Software\Classes\school-health-desk","HKCU:\Software\BOGUNON DESK","HKCU:\Software\Classes\AppUserModelId\$operatingId","HKCU:\Software\Microsoft\Windows\CurrentVersion\Run")){ $state[$root]=Registry-State $root }
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
 foreach($exe in @($operatingExe,$qaExe)){$second=Start-Process -FilePath $exe -PassThru;Start-Sleep -Seconds 3;if(-not $second.HasExited){throw 'Single instance isolation failed'}}
 if($prod.HasExited -or $qa.HasExited){throw 'Apps cannot coexist'}
 Assert-State $stable -StableOnly
 Stop-Owned $qa;$finance=Qa-Finance-State;Remove-Qa
 if($prod.HasExited){throw 'QA uninstall stopped operating app'}
 Assert-State $stable -StableOnly
 if($finance -cne (Qa-Finance-State)){throw 'QA financial data lost after second uninstall'}
 Stop-Owned $prod
 if((Get-FileHash $OperatingInstaller).Hash -ne $operatingInstallerHash -or (Get-FileHash $QaInstaller).Hash -ne $qaInstallerHash){throw 'Installer bytes changed'}
 $signature=Get-AuthenticodeSignature -LiteralPath $QaInstaller
 $result=[ordered]@{status='passed';sourceSha=$env:QA_EXPECTED_SOURCE_SHA;operatingReferenceSha='5cec64358436c148710499b5aa9d2e78c34e0136';sha256=$qaInstallerHash.ToLowerInvariant();authenticodeStatus=[string]$signature.Status;signer=if($signature.SignerCertificate){$signature.SignerCertificate.Subject}else{$null};fullOperatingTreePreservedWhenClosed=$true;operatingFinancialDataPreservedWhileRunning=$true;simultaneousExecution=$true;qaUninstallPreservedBothFinancialStores=$true;operatingNeverUninstalled=$true;outboundBlockedInDisposableRunner=$true;nativeDebugPort='CI environment only, not embedded in installer'}
 $result|ConvertTo-Json -Depth 10|Set-Content (Join-Path $out 'ISOLATION.json') -Encoding utf8
 Write-Output "::notice title=MY_FINANCE_QA_SHA256::$($result.sha256)"
 Write-Output "::notice title=MY_FINANCE_QA_SIGNATURE::$($result.authenticodeStatus)"
 Write-Output '::notice title=MY_FINANCE_QA_ISOLATION::PASSED; operating reference preserved; synthetic GitHub runner only'
} finally {
 foreach($p in $apps){if(-not $p.HasExited){Stop-Owned $p}}
 foreach($name in $rules){Remove-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue}
}
