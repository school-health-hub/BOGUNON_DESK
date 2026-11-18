param(
 [Parameter(Mandatory=$true)][string]$NodePath,
 [Parameter(Mandatory=$true)][string]$SourcePath,
 [Parameter(Mandatory=$true)][string]$PortablePath,
 [Parameter(Mandatory=$true)][string]$OfficialCliPath,
 [Parameter(Mandatory=$true)][string]$FixturePath,
 [string]$QaParent='E:\BOGUNON_DEV\qa-output',
 [int]$Port=15448,
 [switch]$SmokeOnly
)
$ErrorActionPreference='Stop'
foreach($p in @($NodePath,$SourcePath,$PortablePath,$OfficialCliPath,$FixturePath)){if(-not(Test-Path -LiteralPath $p)){throw 'Missing explicit dependency'}}
if(-not([IO.Path]::GetFullPath($QaParent).StartsWith('E:\',[StringComparison]::OrdinalIgnoreCase))){throw 'E drive required'}
if((Get-FileHash -LiteralPath $PortablePath).Hash -ne '2050489BC1E1B5E980B9AA1C0846B2771612ECA7000EF99EC773FC9BF4C19B90'){throw 'Portable hash mismatch'}
$run=Join-Path $QaParent ('beta1-native-uia-run-'+[guid]::NewGuid().ToString('N').Substring(0,8));if(Test-Path $run){throw 'Destination exists'}
foreach($dir in @('control','results','fixtures','screenshots','outputs','temp')){New-Item -ItemType Directory -Path (Join-Path $run $dir)|Out-Null}
foreach($file in @('suite-runner.mjs','suite.mjs','native-client.mjs','native-dialog.ps1','smoke.mjs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination "$run\control\$file"}
foreach($file in @('1-official.odt','2-record.pdf','3-purchase.csv','4-purchase.xlsx','5-purchase.pdf')){Copy-Item -LiteralPath (Join-Path $FixturePath $file) -Destination "$run\fixtures\$file"}
$env:QA_SOURCE_PATH=[IO.Path]::GetFullPath($SourcePath);$env:QA_PORTABLE_PATH=[IO.Path]::GetFullPath($PortablePath);$env:QA_OFFICIAL_CLI_PATH=[IO.Path]::GetFullPath($OfficialCliPath);$env:QA_ALLOWED_PARENT=[IO.Path]::GetFullPath($QaParent);$env:QA_CDP_PORT=[string]$Port
$env:TEMP="$run\temp";$env:TMP=$env:TEMP;$env:TMPDIR=$env:TEMP;$env:RUNNER_TEMP=$env:TEMP;$env:NODE_COMPILE_CACHE="$run\temp\node-cache"
$env:NPM_CONFIG_CACHE="$run\temp\npm-cache";$env:ELECTRON_CACHE="$run\temp\electron-cache";$env:ELECTRON_BUILDER_CACHE="$run\temp\builder-cache"
Write-Output ('QA 결과 경로: '+$run)
$entry=if($SmokeOnly){'smoke.mjs'}else{'suite-runner.mjs'}; & $NodePath (Join-Path "$run\control" $entry)
if($LASTEXITCODE){throw 'QA failed; no automatic retry'}
