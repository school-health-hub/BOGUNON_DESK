[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$CandidateInstallerPath,

  [Parameter(Mandatory = $true)]
  [string]$CandidateLatestUrl,

  [Parameter(Mandatory = $true)]
  [string]$ExpectedCandidateSha256,

  [string]$ExpectedProductVersion = "0.2.1",

  [string]$SyntheticSourceRef = "2de999ac3bfc6ffec738634866780ab72ddb6d41",

  [string]$OutputDirectory = "artifacts/windows-updater-compatibility-qa",

  [switch]$AllowCleanup,

  [ValidateRange(30, 300)]
  [int]$UpdateTimeoutSeconds = 180
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$OutputDirectory = if ([IO.Path]::IsPathRooted($OutputDirectory)) {
  [IO.Path]::GetFullPath($OutputDirectory)
} else {
  [IO.Path]::GetFullPath((Join-Path $RepositoryRoot $OutputDirectory))
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$LogPath = Join-Path $OutputDirectory "updater-compatibility-qa.log"
$SummaryJsonPath = Join-Path $OutputDirectory "summary.json"
$SummaryMarkdownPath = Join-Path $OutputDirectory "summary.md"
Set-Content -LiteralPath $LogPath -Value "" -Encoding utf8

$UpgradeQaMode = "SYNTHETIC_0_2_0_ENDPOINT_OVERLAY" # Evidence literal: UPGRADE_QA_MODE = SYNTHETIC_0_2_0_ENDPOINT_OVERLAY
$SyntheticSourceDirectory = Join-Path $OutputDirectory "synthetic-0.2.0-source"
$SyntheticInstallerDirectory = Join-Path $OutputDirectory "synthetic-installer"

$script:Summary = [ordered]@{
  status = "running"
  startedAt = (Get-Date).ToUniversalTime().ToString("o")
  upgradeQaMode = $UpgradeQaMode
  production020ExactInstallerBytes = "NOT TESTED"
  updaterProtocolSignatureInstallCompatibility = "PENDING"
  production021CandidateBytes = "PENDING"
  syntheticSourceRef = $SyntheticSourceRef
  candidateLatestUrl = $CandidateLatestUrl
  candidateInstaller = $null
  remoteCandidate = $null
  checks = [Collections.Generic.List[object]]::new()
  failure = $null
}

function Write-QaLog {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("INFO", "PASS", "WARN", "FAIL")][string]$Level,
    [Parameter(Mandatory = $true)][string]$Message
  )
  $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
  Write-Host $line
  Add-Content -LiteralPath $LogPath -Value $line -Encoding utf8
}

function Add-Check {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][bool]$Passed,
    [Parameter(Mandatory = $true)][string]$Details
  )
  [void]$script:Summary.checks.Add([ordered]@{ name = $Name; passed = $Passed; details = $Details })
  if ($Passed) {
    Write-QaLog -Level PASS -Message "$Name - $Details"
    return
  }
  Write-QaLog -Level FAIL -Message "$Name - $Details"
  throw "$Name failed: $Details"
}

function Get-FileSha256 {
  param([Parameter(Mandatory = $true)][string]$Path)
  (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Invoke-CheckedProcess {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$ArgumentList = @(),
    [Parameter(Mandatory = $true)][string]$WorkingDirectory
  )
  Write-QaLog -Level INFO -Message "Running: $FilePath $($ArgumentList -join ' ')"
  $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDirectory -Wait -PassThru -NoNewWindow
  if ($process.ExitCode -ne 0) {
    throw "$FilePath exited with code $($process.ExitCode)."
  }
}

function Write-SummaryFiles {
  $script:Summary.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  $script:Summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $SummaryJsonPath -Encoding utf8
  $lines = @(
    "# Synthetic 0.2.0 updater compatibility QA",
    "",
    "- Status: $($script:Summary.status)",
    "- UPGRADE_QA_MODE = $UpgradeQaMode",
    "- production 0.2.0 exact installer bytes: NOT TESTED",
    "- updater protocol/signature/install compatibility: $($script:Summary.updaterProtocolSignatureInstallCompatibility)",
    "- production 0.2.1 candidate bytes: $($script:Summary.production021CandidateBytes)",
    "",
    "## Checks"
  )
  foreach ($check in $script:Summary.checks) {
    $mark = if ($check.passed) { "PASS" } else { "FAIL" }
    $lines += "- [$mark] $($check.name): $($check.details)"
  }
  if ($null -ne $script:Summary.failure) {
    $lines += ""
    $lines += "## Failure"
    $lines += $script:Summary.failure
  }
  $lines | Set-Content -LiteralPath $SummaryMarkdownPath -Encoding utf8
}

function Set-SyntheticUpdaterEndpoint {
  param([Parameter(Mandatory = $true)][string]$SourceDirectory)
  $configPath = Join-Path $SourceDirectory "src-tauri\tauri.conf.json"
  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  $beforePubkey = [string]$config.plugins.updater.pubkey
  $beforeInstallMode = [string]$config.plugins.updater.windows.installMode
  $config.plugins.updater.endpoints = @($CandidateLatestUrl)
  $config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $configPath -Encoding utf8
  $after = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  Add-Check -Name "Synthetic updater public key unchanged" -Passed ([string]$after.plugins.updater.pubkey -eq $beforePubkey) -Details "Embedded updater public key preserved."
  Add-Check -Name "Synthetic updater install mode unchanged" -Passed ([string]$after.plugins.updater.windows.installMode -eq $beforeInstallMode) -Details "Install mode remains $beforeInstallMode."
  Add-Check -Name "Synthetic candidate endpoint overlay" -Passed ($after.plugins.updater.endpoints[0] -eq $CandidateLatestUrl) -Details $CandidateLatestUrl
}

function Wait-ForInstalledProductVersion {
  param([Parameter(Mandatory = $true)][string]$ExpectedVersion)
  $deadline = (Get-Date).AddSeconds($UpdateTimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $matches = @(Get-ChildItem -Path "$env:LOCALAPPDATA\Programs", "$env:ProgramFiles", "${env:ProgramFiles(x86)}" -Filter "school-health-desk.exe" -File -Recurse -ErrorAction SilentlyContinue)
    foreach ($match in $matches) {
      if ([string]$match.VersionInfo.ProductVersion -eq $ExpectedVersion) {
        return $match.FullName
      }
    }
    Start-Sleep -Seconds 3
  }
  throw "Updated executable with ProductVersion $ExpectedVersion was not found."
}

function Find-ProductExecutableByVersion {
  param([Parameter(Mandatory = $true)][string]$ExpectedVersion)
  $matches = @(Get-ChildItem -Path "$env:LOCALAPPDATA\Programs", "$env:ProgramFiles", "${env:ProgramFiles(x86)}" -Filter "school-health-desk.exe" -File -Recurse -ErrorAction SilentlyContinue)
  foreach ($match in $matches) {
    if ([string]$match.VersionInfo.ProductVersion -eq $ExpectedVersion) {
      return $match.FullName
    }
  }
  throw "Executable with ProductVersion $ExpectedVersion was not found."
}

function Test-ProductExecutableByVersion {
  param([Parameter(Mandatory = $true)][string]$ExpectedVersion)
  try {
    [void](Find-ProductExecutableByVersion -ExpectedVersion $ExpectedVersion)
    return $true
  } catch {
    return $false
  }
}

function Start-AppAndStop {
  param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [Parameter(Mandatory = $true)][string]$Label
  )
  $process = Start-Process -FilePath $Executable -PassThru
  Start-Sleep -Seconds 8
  Add-Check -Name $Label -Passed (-not $process.HasExited) -Details "Process $($process.Id) launched without early exit."
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

function Click-ButtonByName {
  param(
    [Parameter(Mandatory = $true)][int]$ProcessId,
    [Parameter(Mandatory = $true)][string]$Name,
    [int]$TimeoutSeconds = 60
  )
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($null -eq $process) { throw "Application process exited before '$Name' was available." }
    $root = [Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
    if ($null -ne $root) {
      $condition = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty, $Name)
      $element = $root.FindFirst([Windows.Automation.TreeScope]::Descendants, $condition)
      if ($null -ne $element) {
        $pattern = $element.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)
        $pattern.Invoke()
        Add-Check -Name "Clicked '$Name'" -Passed $true -Details "UI Automation invoked $Name."
        return
      }
    }
    Start-Sleep -Seconds 2
  }
  throw "Button '$Name' was not found before timeout."
}

$failureMessage = $null
try {
  if ($ExpectedCandidateSha256 -notmatch '^[a-fA-F0-9]{64}$') {
    throw "ExpectedCandidateSha256 must be a 64-character hexadecimal SHA-256 value."
  }
  $escapedExpectedVersion = [regex]::Escape($ExpectedProductVersion)
  $expectedCandidateUrlPattern = "^https://xxownwxxajzrviuvvfiu\.supabase\.co/storage/v1/object/public/desktop-releases/candidate/$escapedExpectedVersion/[0-9A-Za-z_.-]+/latest\.json$"
  Add-Check -Name "Candidate manifest endpoint namespace" -Passed ($CandidateLatestUrl -match $expectedCandidateUrlPattern) -Details $CandidateLatestUrl
  $candidate = Get-Item -LiteralPath ([IO.Path]::GetFullPath($CandidateInstallerPath))
  $candidateSignature = Get-Item -LiteralPath "$($candidate.FullName).sig"
  $candidateSha = Get-FileSha256 -Path $candidate.FullName
  $candidateSignatureSha = Get-FileSha256 -Path $candidateSignature.FullName
  $candidateSignatureText = (Get-Content -LiteralPath $candidateSignature.FullName -Raw).Trim()
  $script:Summary.candidateInstaller = [ordered]@{
    path = $candidate.FullName
    name = $candidate.Name
    bytes = $candidate.Length
    expectedSha256 = $ExpectedCandidateSha256.ToLowerInvariant()
    actualSha256 = $candidateSha
    signatureName = $candidateSignature.Name
    signatureSha256 = $candidateSignatureSha
  }
  Add-Check -Name "Production candidate SHA-256" -Passed ($candidateSha -eq $ExpectedCandidateSha256.ToLowerInvariant()) -Details "expected=$($ExpectedCandidateSha256.ToLowerInvariant()) actual=$candidateSha"
  Add-Check -Name "Production candidate signature present" -Passed ($candidateSignature.Length -gt 0) -Details "$($candidateSignature.Name) sha256=$candidateSignatureSha"
  Add-Check -Name "Candidate manifest URL is not production latest" -Passed (-not $CandidateLatestUrl.EndsWith("/desktop-releases/latest.json")) -Details $CandidateLatestUrl
  $candidateManifestResponse = Invoke-WebRequest -Uri $CandidateLatestUrl -UseBasicParsing -Headers @{ "Cache-Control" = "no-store" }
  $candidateManifest = $candidateManifestResponse.Content | ConvertFrom-Json
  $candidatePlatform = $candidateManifest.platforms.'windows-x86_64'
  $candidatePrefixUrl = $CandidateLatestUrl -replace "/latest\.json$", ""
  $expectedCandidateInstallerUrl = "$candidatePrefixUrl/$($candidate.Name)"
  Add-Check -Name "Remote candidate manifest version" -Passed ([string]$candidateManifest.version -eq $ExpectedProductVersion) -Details "version=$($candidateManifest.version)"
  Add-Check -Name "Remote candidate manifest installer URL" -Passed ([string]$candidatePlatform.url -eq $expectedCandidateInstallerUrl) -Details $candidatePlatform.url
  Add-Check -Name "Remote candidate manifest signature" -Passed ([string]$candidatePlatform.signature -eq $candidateSignatureText) -Details "Manifest signature matches local .sig content."
  $remoteCandidatePath = Join-Path $OutputDirectory "remote-candidate-installer.exe"
  Invoke-WebRequest -Uri $candidatePlatform.url -OutFile $remoteCandidatePath -UseBasicParsing -Headers @{ "Cache-Control" = "no-store" }
  $remoteCandidateSha = Get-FileSha256 -Path $remoteCandidatePath
  Add-Check -Name "Remote candidate installer SHA-256" -Passed ($remoteCandidateSha -eq $ExpectedCandidateSha256.ToLowerInvariant()) -Details "expected=$($ExpectedCandidateSha256.ToLowerInvariant()) actual=$remoteCandidateSha"
  $remoteSignaturePath = Join-Path $OutputDirectory "remote-candidate-installer.exe.sig"
  Invoke-WebRequest -Uri "$($candidatePlatform.url).sig" -OutFile $remoteSignaturePath -UseBasicParsing -Headers @{ "Cache-Control" = "no-store" }
  $remoteSignatureSha = Get-FileSha256 -Path $remoteSignaturePath
  Add-Check -Name "Remote candidate signature SHA-256" -Passed ($remoteSignatureSha -eq $candidateSignatureSha) -Details "expected=$candidateSignatureSha actual=$remoteSignatureSha"
  $script:Summary.remoteCandidate = [ordered]@{
    manifestUrl = $CandidateLatestUrl
    installerUrl = [string]$candidatePlatform.url
    expectedInstallerUrl = $expectedCandidateInstallerUrl
    version = [string]$candidateManifest.version
    installerSha256 = $remoteCandidateSha
    signatureSha256 = $remoteSignatureSha
  }

  if (Test-Path -LiteralPath $SyntheticSourceDirectory) {
    Remove-Item -LiteralPath $SyntheticSourceDirectory -Recurse -Force
  }
  Invoke-CheckedProcess -FilePath "git" -ArgumentList @("worktree", "add", "--detach", $SyntheticSourceDirectory, $SyntheticSourceRef) -WorkingDirectory $RepositoryRoot
  $package = Get-Content -LiteralPath (Join-Path $SyntheticSourceDirectory "package.json") -Raw | ConvertFrom-Json
  $config = Get-Content -LiteralPath (Join-Path $SyntheticSourceDirectory "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
  $syntheticIdentifier = [string]$config.identifier
  Add-Check -Name "Synthetic source version" -Passed ([string]$package.version -eq "0.2.0" -and [string]$config.version -eq "0.2.0") -Details "package=$($package.version), tauri=$($config.version)"
  Set-SyntheticUpdaterEndpoint -SourceDirectory $SyntheticSourceDirectory
  Invoke-CheckedProcess -FilePath "npm" -ArgumentList @("ci") -WorkingDirectory $SyntheticSourceDirectory
  Invoke-CheckedProcess -FilePath "npm" -ArgumentList @("run", "release:windows") -WorkingDirectory $SyntheticSourceDirectory
  New-Item -ItemType Directory -Force -Path $SyntheticInstallerDirectory | Out-Null
  $syntheticInstaller = @(Get-ChildItem -Path (Join-Path $SyntheticSourceDirectory "release-output") -Filter "*.exe" -File -Recurse)
  Add-Check -Name "Synthetic installer count" -Passed ($syntheticInstaller.Count -eq 1) -Details "Found $($syntheticInstaller.Count) synthetic installer."

  Write-QaLog -Level INFO -Message "Installing synthetic 0.2.0 build."
  $installProcess = Start-Process -FilePath $syntheticInstaller[0].FullName -ArgumentList "/S" -Wait -PassThru
  Add-Check -Name "Synthetic installer exit code" -Passed ($installProcess.ExitCode -eq 0) -Details "Installer exited with code $($installProcess.ExitCode)."
  Start-Sleep -Seconds 3
  $syntheticExecutable = Find-ProductExecutableByVersion -ExpectedVersion "0.2.0"
  Add-Check -Name "Synthetic 0.2.0 installed" -Passed $true -Details $syntheticExecutable
  Add-Check -Name "No stale candidate version before update" -Passed (-not (Test-ProductExecutableByVersion -ExpectedVersion $ExpectedProductVersion)) -Details "No ProductVersion $ExpectedProductVersion executable exists before updater install."
  $sentinelRoot = Join-Path $env:LOCALAPPDATA $syntheticIdentifier
  New-Item -ItemType Directory -Force -Path $sentinelRoot | Out-Null
  $sentinelPath = Join-Path $sentinelRoot "qa-non-sensitive-setting.txt"
  Set-Content -LiteralPath $sentinelPath -Value "synthetic-updater-qa" -Encoding utf8
  $app = Start-Process -FilePath $syntheticExecutable -PassThru
  try {
    Click-ButtonByName -ProcessId $app.Id -Name "업데이트" -TimeoutSeconds 90
    Click-ButtonByName -ProcessId $app.Id -Name "업데이트 계속" -TimeoutSeconds 60
  } finally {
    if (-not $app.HasExited) {
      Write-QaLog -Level INFO -Message "Updater flow still owns application process $($app.Id)."
    }
  }
  $updatedExecutable = Wait-ForInstalledProductVersion -ExpectedVersion $ExpectedProductVersion
  Add-Check -Name "Updated ProductVersion" -Passed $true -Details $updatedExecutable
  Start-AppAndStop -Executable $updatedExecutable -Label "Updated app launch"
  Start-AppAndStop -Executable $updatedExecutable -Label "Updated app relaunch"
  Add-Check -Name "Non-sensitive setting persistence" -Passed (Test-Path -LiteralPath $sentinelPath -PathType Leaf) -Details "Synthetic non-sensitive AppData sentinel remained after update."
  Add-Check -Name "Compatibility QA limitation recorded" -Passed $true -Details "production 0.2.0 exact installer bytes: NOT TESTED"
  $script:Summary.updaterProtocolSignatureInstallCompatibility = "TESTED"
  $script:Summary.production021CandidateBytes = "EXACT BYTES TESTED"
  $script:Summary.status = "passed"
} catch {
  $failureMessage = $_.Exception.Message
  $script:Summary.status = "failed"
  $script:Summary.failure = $failureMessage
  Write-QaLog -Level FAIL -Message $failureMessage
} finally {
  try {
    if (Test-Path -LiteralPath $SyntheticSourceDirectory) {
      Invoke-CheckedProcess -FilePath "git" -ArgumentList @("worktree", "remove", "--force", $SyntheticSourceDirectory) -WorkingDirectory $RepositoryRoot
    }
  } catch {
    Write-QaLog -Level WARN -Message "Synthetic source cleanup failed: $($_.Exception.Message)"
  }
  Write-SummaryFiles
}

if ($null -ne $failureMessage) {
  Write-Error $failureMessage
  exit 1
}

Write-QaLog -Level PASS -Message "Synthetic 0.2.0 updater compatibility QA completed successfully."
