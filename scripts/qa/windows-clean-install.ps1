[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,

  [string]$ExpectedSha256 = "",

  [string]$ExpectedProductVersion = "",

  [string]$OutputDirectory = "artifacts/windows-clean-install-qa",

  [switch]$AllowCleanup,

  [ValidateRange(10, 60)]
  [int]$SmokeSeconds = 12
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
$LogPath = Join-Path $OutputDirectory "clean-install-qa.log"
$SummaryJsonPath = Join-Path $OutputDirectory "summary.json"
$SummaryMarkdownPath = Join-Path $OutputDirectory "summary.md"
Set-Content -LiteralPath $LogPath -Value "" -Encoding utf8

$script:Summary = [ordered]@{
  status = "running"
  startedAt = (Get-Date).ToUniversalTime().ToString("o")
  installer = $null
  product = $null
  checks = [Collections.Generic.List[object]]::new()
  failure = $null
}
$script:ActiveProcess = $null
$script:InstalledEntry = $null
$script:Metadata = $null
$script:UninstallCompleted = $false

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

  [void]$script:Summary.checks.Add([ordered]@{
    name = $Name
    passed = $Passed
    details = $Details
  })
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

function Assert-ExpectedSha256 {
  param(
    [Parameter(Mandatory = $true)][string]$Expected,
    [Parameter(Mandatory = $true)][string]$Actual
  )

  if ([string]::IsNullOrWhiteSpace($Expected)) { return }
  if ($Expected -notmatch '^[a-fA-F0-9]{64}$') {
    throw "ExpectedSha256 must be a 64-character hexadecimal SHA-256 value."
  }
  Add-Check -Name "Installer SHA-256" -Passed ($Actual -eq $Expected.ToLowerInvariant()) -Details "expected=$($Expected.ToLowerInvariant()) actual=$Actual"
}

function Get-ProjectMetadata {
  $config = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "src-tauri\tauri.conf.json") | ConvertFrom-Json
  $cargoSource = Get-Content -Raw -LiteralPath (Join-Path $RepositoryRoot "src-tauri\Cargo.toml")
  $packageMatch = [regex]::Match($cargoSource, '(?ms)^\[package\]\s*(?<body>.*?)(?=^\[|\z)')
  $nameMatch = [regex]::Match($packageMatch.Groups["body"].Value, '(?m)^name\s*=\s*"(?<name>[^"]+)"\s*$')
  if (-not $packageMatch.Success -or -not $nameMatch.Success) {
    throw "Cargo package name could not be resolved."
  }

  [pscustomobject]@{
    ProductName = [string]$config.productName
    Identifier = [string]$config.identifier
    Version = [string]$config.version
    BinaryStem = $nameMatch.Groups["name"].Value
  }
}

function Get-UninstallEntries {
  $roots = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
  )

  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    foreach ($key in Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue) {
      $value = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
      if ($null -eq $value) { continue }
      $displayNameProperty = $value.PSObject.Properties["DisplayName"]
      if ($null -eq $displayNameProperty -or [string]::IsNullOrWhiteSpace([string]$displayNameProperty.Value)) { continue }
      $readString = {
        param([string]$Name)
        $property = $value.PSObject.Properties[$Name]
        if ($null -eq $property -or $null -eq $property.Value) { return "" }
        [string]$property.Value
      }
      [pscustomobject]@{
        RegistryPath = $key.PSPath
        DisplayName = & $readString "DisplayName"
        DisplayVersion = & $readString "DisplayVersion"
        InstallLocation = & $readString "InstallLocation"
        DisplayIcon = & $readString "DisplayIcon"
        UninstallString = & $readString "UninstallString"
        QuietUninstallString = & $readString "QuietUninstallString"
      }
    }
  }
}

function Get-MatchingUninstallEntries {
  param([Parameter(Mandatory = $true)][string]$ProductName)
  @(Get-UninstallEntries | Where-Object { $_.DisplayName -eq $ProductName })
}

function Split-ExecutableCommand {
  param([Parameter(Mandatory = $true)][string]$CommandLine)

  $trimmed = $CommandLine.Trim()
  $match = [regex]::Match($trimmed, '^"(?<exe>[^"]+\.exe)"\s*(?<args>.*)$')
  if (-not $match.Success) {
    $match = [regex]::Match($trimmed, '^(?<exe>.+?\.exe)(?:\s+(?<args>.*))?$')
  }
  if (-not $match.Success) {
    throw "Executable command could not be parsed."
  }

  [pscustomobject]@{
    Executable = $match.Groups["exe"].Value.Trim()
    Arguments = $match.Groups["args"].Value.Trim()
  }
}

function Get-UninstallerCommand {
  param([Parameter(Mandatory = $true)][psobject]$Entry)

  if (-not [string]::IsNullOrWhiteSpace($Entry.QuietUninstallString)) {
    return Split-ExecutableCommand -CommandLine $Entry.QuietUninstallString
  }
  if ([string]::IsNullOrWhiteSpace($Entry.UninstallString)) {
    throw "Uninstall registry entry has no uninstall command."
  }

  $command = Split-ExecutableCommand -CommandLine $Entry.UninstallString
  $arguments = @($command.Arguments, "/S") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  [pscustomobject]@{
    Executable = $command.Executable
    Arguments = ($arguments -join " ")
  }
}

function Invoke-Uninstaller {
  param([Parameter(Mandatory = $true)][psobject]$Entry)

  $command = Get-UninstallerCommand -Entry $Entry
  if (-not (Test-Path -LiteralPath $command.Executable -PathType Leaf)) {
    throw "Uninstaller executable does not exist."
  }
  Write-QaLog -Level INFO -Message "Running silent uninstaller: $([IO.Path]::GetFileName($command.Executable))"
  $process = Start-Process -FilePath $command.Executable -ArgumentList $command.Arguments -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "Uninstaller exited with code $($process.ExitCode)."
  }
}

function Get-AppDataPaths {
  param([Parameter(Mandatory = $true)][string]$Identifier)
  @(
    [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA $Identifier)),
    [IO.Path]::GetFullPath((Join-Path $env:APPDATA $Identifier))
  )
}

function Remove-SafeAppDataDirectory {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) { return }
  $fullPath = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  $allowedRoots = @($env:LOCALAPPDATA, $env:APPDATA) | ForEach-Object {
    [IO.Path]::GetFullPath($_).TrimEnd('\') + '\'
  }
  if (-not ($allowedRoots | Where-Object { $fullPath.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) })) {
    throw "Refusing to remove app data outside AppData roots."
  }
  if ($allowedRoots | Where-Object { $fullPath -eq $_.TrimEnd('\') }) {
    throw "Refusing to remove an AppData root."
  }

  Write-QaLog -Level INFO -Message "Removing clean-test app data: $fullPath"
  Remove-Item -LiteralPath $fullPath -Recurse -Force
}

function Remove-SafeInstallDirectory {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) { return }
  $fullPath = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  $allowedRoots = @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)}) |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    ForEach-Object { [IO.Path]::GetFullPath($_).TrimEnd('\') + '\' }
  if (-not ($allowedRoots | Where-Object { $fullPath.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) })) {
    throw "Refusing to remove an install directory outside expected Windows application roots."
  }
  if ($allowedRoots | Where-Object { $fullPath -eq $_.TrimEnd('\') }) {
    throw "Refusing to remove a Windows application root."
  }

  Write-QaLog -Level INFO -Message "Removing residual clean-test install directory: $fullPath"
  Remove-Item -LiteralPath $fullPath -Recurse -Force
}

function Get-ProductProcesses {
  param([Parameter(Mandatory = $true)][string]$BinaryStem)
  @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -ieq "$BinaryStem.exe"
  } | Select-Object ProcessId, Name, ExecutablePath, CommandLine)
}

function Stop-ProductProcesses {
  param([Parameter(Mandatory = $true)][string]$BinaryStem)
  foreach ($process in Get-ProductProcesses -BinaryStem $BinaryStem) {
    Write-QaLog -Level INFO -Message "Stopping existing product process PID $($process.ProcessId)."
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Get-StartMenuShortcuts {
  param([Parameter(Mandatory = $true)][string]$ProductName)
  $roots = @(
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"),
    (Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs")
  )
  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    Get-ChildItem -LiteralPath $root -Filter "*.lnk" -File -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.BaseName -eq $ProductName -or $_.DirectoryName -like "*$ProductName*" } |
      Select-Object -ExpandProperty FullName
  }
}

function Get-DirectoryState {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    return [ordered]@{ path = $Path; exists = $false; fileCount = 0; files = @() }
  }

  $files = @(Get-ChildItem -LiteralPath $Path -File -Recurse -ErrorAction SilentlyContinue)
  [ordered]@{
    path = $Path
    exists = $true
    fileCount = $files.Count
    files = @($files | Select-Object -First 100 | ForEach-Object {
      [IO.Path]::GetRelativePath($Path, $_.FullName)
    })
  }
}

function Save-StateSnapshot {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][psobject]$Metadata
  )

  $os = Get-CimInstance Win32_OperatingSystem
  $uninstallEntries = @(Get-MatchingUninstallEntries -ProductName $Metadata.ProductName)
  $installDirectories = foreach ($entry in $uninstallEntries) {
    try { Get-DirectoryState -Path (Resolve-InstallDirectory -Entry $entry) } catch {
      [ordered]@{ path = "unresolved"; exists = $false; fileCount = 0; files = @() }
    }
  }
  $snapshot = [ordered]@{
    capturedAt = (Get-Date).ToUniversalTime().ToString("o")
    user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    windows = [ordered]@{ caption = $os.Caption; version = $os.Version; build = $os.BuildNumber }
    uninstallEntries = $uninstallEntries
    installDirectories = @($installDirectories)
    appData = @(Get-AppDataPaths -Identifier $Metadata.Identifier | ForEach-Object { Get-DirectoryState -Path $_ })
    processes = @(Get-ProductProcesses -BinaryStem $Metadata.BinaryStem)
    startMenuShortcuts = @(Get-StartMenuShortcuts -ProductName $Metadata.ProductName)
  }
  $snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory "$Name.json") -Encoding utf8
  Write-QaLog -Level INFO -Message "Saved state snapshot: $Name.json"
  $snapshot
}

function Resolve-InstallDirectory {
  param([Parameter(Mandatory = $true)][psobject]$Entry)

  if (-not [string]::IsNullOrWhiteSpace($Entry.InstallLocation) -and (Test-Path -LiteralPath $Entry.InstallLocation)) {
    return [IO.Path]::GetFullPath($Entry.InstallLocation)
  }
  foreach ($commandLine in @($Entry.UninstallString, $Entry.QuietUninstallString, $Entry.DisplayIcon)) {
    if ([string]::IsNullOrWhiteSpace($commandLine)) { continue }
    try {
      $command = Split-ExecutableCommand -CommandLine ($commandLine -replace ',\d+$', '')
      if (Test-Path -LiteralPath $command.Executable -PathType Leaf) {
        return Split-Path -Parent ([IO.Path]::GetFullPath($command.Executable))
      }
    } catch {
      continue
    }
  }
  throw "Install directory could not be resolved from the uninstall registry entry."
}

function Resolve-MainExecutable {
  param(
    [Parameter(Mandatory = $true)][string]$InstallDirectory,
    [Parameter(Mandatory = $true)][psobject]$Metadata
  )

  $executables = @(Get-ChildItem -LiteralPath $InstallDirectory -Filter "*.exe" -File -Recurse |
    Where-Object { $_.Name -notmatch '(?i)^unins.*\.exe$|uninstall' })
  $productMatches = @($executables | Where-Object { $_.VersionInfo.ProductName -eq $Metadata.ProductName })
  if ($productMatches.Count -eq 1) { return $productMatches[0] }

  $nameMatches = @($executables | Where-Object { $_.Name -ieq "$($Metadata.BinaryStem).exe" })
  if ($nameMatches.Count -eq 1) { return $nameMatches[0] }
  if ($executables.Count -eq 1) { return $executables[0] }
  throw "Main executable could not be resolved unambiguously."
}

function Test-AppJsonFiles {
  param([Parameter(Mandatory = $true)][string[]]$AppDataPaths)

  $jsonFiles = foreach ($path in $AppDataPaths) {
    if (Test-Path -LiteralPath $path) {
      Get-ChildItem -LiteralPath $path -Filter "desktop-*.json" -File -ErrorAction SilentlyContinue
    }
  }
  foreach ($file in @($jsonFiles)) {
    try {
      Get-Content -Raw -LiteralPath $file.FullName | ConvertFrom-Json | Out-Null
      Write-QaLog -Level PASS -Message "Valid app settings JSON: $($file.Name)"
    } catch {
      throw "App settings JSON is invalid: $($file.Name)"
    }
  }
}

function Start-AppSmoke {
  param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $process = Start-Process -FilePath $Executable -WorkingDirectory (Split-Path -Parent $Executable) -PassThru
  $script:ActiveProcess = $process
  Write-QaLog -Level INFO -Message "$Label started with PID $($process.Id); waiting $SmokeSeconds seconds."
  Start-Sleep -Seconds $SmokeSeconds
  $process.Refresh()
  if ($process.HasExited) {
    throw "$Label exited early with code $($process.ExitCode)."
  }
  Add-Check -Name "$Label process stability" -Passed $true -Details "Process remained alive for $SmokeSeconds seconds."
  $process
}

function Stop-AppSmoke {
  param([Parameter(Mandatory = $true)][Diagnostics.Process]$Process)
  $Process.Refresh()
  if ($Process.HasExited) { return }

  [void]$Process.CloseMainWindow()
  if (-not $Process.WaitForExit(5000)) {
    Write-QaLog -Level INFO -Message "App remained in its tray-aware close flow; stopping exact PID $($Process.Id) for QA cleanup."
    Stop-Process -Id $Process.Id -Force
    $Process.WaitForExit(5000)
  }
  $script:ActiveProcess = $null
}

function Write-SummaryFiles {
  $script:Summary.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  $script:Summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $SummaryJsonPath -Encoding utf8
  $installerName = if ($null -ne $script:Summary.installer) { $script:Summary.installer.name } else { "unknown" }
  $productName = if ($null -ne $script:Summary.product) { $script:Summary.product.name } else { "unknown" }
  $productVersion = if ($null -ne $script:Summary.product) { $script:Summary.product.version } else { "unknown" }
  $lines = @(
    "# Windows clean-install QA",
    "",
    "- Status: $($script:Summary.status)",
    "- Installer: $installerName",
    "- Product: $productName",
    "- Version: $productVersion",
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

$failureMessage = $null
try {
  $metadata = Get-ProjectMetadata
  $script:Metadata = $metadata
  $resolvedInstallerPath = if ([IO.Path]::IsPathRooted($InstallerPath)) {
    [IO.Path]::GetFullPath($InstallerPath)
  } else {
    [IO.Path]::GetFullPath((Join-Path $RepositoryRoot $InstallerPath))
  }
  $installer = Get-Item -LiteralPath $resolvedInstallerPath
  if ($installer.Extension -ine ".exe" -or $installer.Length -le 0) {
    throw "Installer is missing, empty, or not an executable."
  }
  $installerSha256 = Get-FileSha256 -Path $installer.FullName
  $script:Summary.installer = [ordered]@{
    path = $installer.FullName
    name = $installer.Name
    bytes = $installer.Length
    expectedSha256 = if ([string]::IsNullOrWhiteSpace($ExpectedSha256)) { $null } else { $ExpectedSha256.ToLowerInvariant() }
    actualSha256 = $installerSha256
  }
  $script:Summary.product = [ordered]@{
    name = $metadata.ProductName
    identifier = $metadata.Identifier
    version = $metadata.Version
    expectedProductVersion = if ([string]::IsNullOrWhiteSpace($ExpectedProductVersion)) { $null } else { $ExpectedProductVersion }
    binaryStem = $metadata.BinaryStem
  }
  Assert-ExpectedSha256 -Expected $ExpectedSha256 -Actual $installerSha256

  Write-QaLog -Level INFO -Message "Current user: $([Security.Principal.WindowsIdentity]::GetCurrent().Name)"
  $os = Get-CimInstance Win32_OperatingSystem
  Write-QaLog -Level INFO -Message "Windows: $($os.Caption) $($os.Version) build $($os.BuildNumber)"
  Write-QaLog -Level INFO -Message "Installer: $($installer.FullName) ($($installer.Length) bytes)"

  $before = Save-StateSnapshot -Name "before-cleanup" -Metadata $metadata
  Write-QaLog -Level INFO -Message "Existing install entries: $(@($before.uninstallEntries).Count)"
  Write-QaLog -Level INFO -Message "Existing install directories: $(@($before.installDirectories | Where-Object { $_.exists }).Count)"
  Write-QaLog -Level INFO -Message "Existing AppData roots: $(@($before.appData | Where-Object { $_.exists }).Count)"
  Write-QaLog -Level INFO -Message "Existing product processes: $(@($before.processes).Count)"
  $existingEntries = @(Get-MatchingUninstallEntries -ProductName $metadata.ProductName)
  $existingProcesses = @(Get-ProductProcesses -BinaryStem $metadata.BinaryStem)
  $existingData = @(Get-AppDataPaths -Identifier $metadata.Identifier | Where-Object { Test-Path -LiteralPath $_ })
  if (($existingEntries.Count + $existingProcesses.Count + $existingData.Count) -gt 0 -and -not $AllowCleanup) {
    throw "Existing app state was found. Re-run only in an isolated environment with -AllowCleanup."
  }

  if ($AllowCleanup) {
    Stop-ProductProcesses -BinaryStem $metadata.BinaryStem
    foreach ($entry in $existingEntries) { Invoke-Uninstaller -Entry $entry }
    Start-Sleep -Seconds 3
    foreach ($directory in @($before.installDirectories | Where-Object { $_.exists -and $_.path -ne "unresolved" })) {
      Remove-SafeInstallDirectory -Path $directory.path
    }
    foreach ($path in Get-AppDataPaths -Identifier $metadata.Identifier) {
      Remove-SafeAppDataDirectory -Path $path
    }
    foreach ($shortcut in Get-StartMenuShortcuts -ProductName $metadata.ProductName) {
      Remove-Item -LiteralPath $shortcut -Force
    }
  }

  $clean = Save-StateSnapshot -Name "clean-state" -Metadata $metadata
  Add-Check -Name "Clean uninstall registry" -Passed (@($clean.uninstallEntries).Count -eq 0) -Details "No prior product uninstall entry exists."
  Add-Check -Name "Clean process state" -Passed (@($clean.processes).Count -eq 0) -Details "No prior product process exists."
  Add-Check -Name "Clean app data" -Passed (-not (@($clean.appData) | Where-Object { $_.exists })) -Details "No prior identifier-scoped AppData exists."

  Write-QaLog -Level INFO -Message "Running NSIS silent install."
  $installProcess = Start-Process -FilePath $installer.FullName -ArgumentList "/S" -Wait -PassThru
  Add-Check -Name "Installer exit code" -Passed ($installProcess.ExitCode -eq 0) -Details "Installer exited with code $($installProcess.ExitCode)."
  Start-Sleep -Seconds 3

  $matchingEntries = @(Get-MatchingUninstallEntries -ProductName $metadata.ProductName)
  Add-Check -Name "Uninstall registry entry" -Passed ($matchingEntries.Count -eq 1) -Details "Found $($matchingEntries.Count) exact product entry."
  $script:InstalledEntry = $matchingEntries[0]
  $installDirectory = Resolve-InstallDirectory -Entry $script:InstalledEntry
  Add-Check -Name "Install directory" -Passed (Test-Path -LiteralPath $installDirectory -PathType Container) -Details $installDirectory

  $mainExecutable = Resolve-MainExecutable -InstallDirectory $installDirectory -Metadata $metadata
  Add-Check -Name "Main executable" -Passed ($mainExecutable.Length -gt 0) -Details "$($mainExecutable.FullName) ($($mainExecutable.Length) bytes)"
  $observedProductVersion = [string]$mainExecutable.VersionInfo.ProductVersion
  $script:Summary.product.observedProductVersion = $observedProductVersion
  if (-not [string]::IsNullOrWhiteSpace($ExpectedProductVersion)) {
    Add-Check -Name "ProductVersion" -Passed ($observedProductVersion -eq $ExpectedProductVersion) -Details "expected=$ExpectedProductVersion observed=$observedProductVersion"
  }
  $uninstaller = Get-UninstallerCommand -Entry $script:InstalledEntry
  Add-Check -Name "Uninstaller executable" -Passed (Test-Path -LiteralPath $uninstaller.Executable -PathType Leaf) -Details ([IO.Path]::GetFileName($uninstaller.Executable))

  $shortcuts = @(Get-StartMenuShortcuts -ProductName $metadata.ProductName)
  Add-Check -Name "Start Menu shortcut" -Passed ($shortcuts.Count -gt 0) -Details "Found $($shortcuts.Count) product shortcut(s)."
  Save-StateSnapshot -Name "after-install" -Metadata $metadata | Out-Null

  $firstRun = Start-AppSmoke -Executable $mainExecutable.FullName -Label "First launch"
  $appDataPaths = @(Get-AppDataPaths -Identifier $metadata.Identifier)
  $localDataRoot = $appDataPaths[0]
  Add-Check -Name "First-launch local data root" -Passed (Test-Path -LiteralPath $localDataRoot -PathType Container) -Details $localDataRoot
  $webViewDataRoot = Join-Path $localDataRoot "EBWebView"
  Add-Check -Name "WebView persistence root" -Passed (Test-Path -LiteralPath $webViewDataRoot -PathType Container) -Details "WebView2 created identifier-scoped data for localStorage/onboarding."
  Test-AppJsonFiles -AppDataPaths $appDataPaths
  Save-StateSnapshot -Name "after-first-launch" -Metadata $metadata | Out-Null
  Stop-AppSmoke -Process $firstRun

  $secondRun = Start-AppSmoke -Executable $mainExecutable.FullName -Label "Second launch"
  Stop-AppSmoke -Process $secondRun
  Add-Check -Name "Relaunch" -Passed $true -Details "Installed production executable launched twice without an early crash."

  Invoke-Uninstaller -Entry $script:InstalledEntry
  Add-Check -Name "Uninstaller exit code" -Passed $true -Details "Silent uninstaller exited with code 0."
  $script:UninstallCompleted = $true
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    if (-not (Test-Path -LiteralPath $mainExecutable.FullName) -and @(Get-MatchingUninstallEntries -ProductName $metadata.ProductName).Count -eq 0) { break }
    Start-Sleep -Seconds 2
  }

  Add-Check -Name "Main executable removed" -Passed (-not (Test-Path -LiteralPath $mainExecutable.FullName)) -Details "Installed executable is absent after uninstall."
  $remainingFiles = @(
    if (Test-Path -LiteralPath $installDirectory) {
      Get-ChildItem -LiteralPath $installDirectory -File -Recurse -ErrorAction SilentlyContinue
    }
  )
  $remainingFileCount = @($remainingFiles).Count
  Add-Check -Name "Install directory cleanup" -Passed ($remainingFileCount -eq 0) -Details "Remaining file count: $remainingFileCount."
  Add-Check -Name "Start Menu shortcut removed" -Passed (@(Get-StartMenuShortcuts -ProductName $metadata.ProductName).Count -eq 0) -Details "No product shortcut remains."
  Add-Check -Name "Uninstall entry removed" -Passed (@(Get-MatchingUninstallEntries -ProductName $metadata.ProductName).Count -eq 0) -Details "No product uninstall entry remains."

  $remainingAppData = @(Get-AppDataPaths -Identifier $metadata.Identifier | Where-Object { Test-Path -LiteralPath $_ })
  if ($remainingAppData.Count -gt 0) {
    Write-QaLog -Level INFO -Message "User data remains after uninstall by application policy: $($remainingAppData -join ', ')"
  }
  Save-StateSnapshot -Name "after-uninstall" -Metadata $metadata | Out-Null
  $script:Summary.status = "passed"
} catch {
  $failureMessage = $_.Exception.Message
  $script:Summary.status = "failed"
  $script:Summary.failure = $failureMessage
  Write-QaLog -Level FAIL -Message $failureMessage
} finally {
  if ($null -ne $script:ActiveProcess) {
    try { Stop-AppSmoke -Process $script:ActiveProcess } catch { Write-QaLog -Level WARN -Message $_.Exception.Message }
  }
  if ($null -eq $script:InstalledEntry -and $null -ne $script:Metadata) {
    $cleanupEntries = @(Get-MatchingUninstallEntries -ProductName $script:Metadata.ProductName)
    if ($cleanupEntries.Count -eq 1) { $script:InstalledEntry = $cleanupEntries[0] }
  }
  if ($null -ne $script:InstalledEntry -and -not $script:UninstallCompleted) {
    try {
      Invoke-Uninstaller -Entry $script:InstalledEntry
      Write-QaLog -Level INFO -Message "Failure cleanup uninstall completed."
    } catch {
      Write-QaLog -Level WARN -Message "Failure cleanup uninstall failed: $($_.Exception.Message)"
    }
  }
  Write-SummaryFiles
}

if ($null -ne $failureMessage) {
  Write-Error $failureMessage
  exit 1
}

Write-QaLog -Level PASS -Message "Windows clean-install QA completed successfully."
