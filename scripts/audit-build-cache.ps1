[CmdletBinding()]
param(
    [switch]$Detailed,
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$expectedIdentifier = 'kr.sungandi.schoolhealthdesk'
$thresholdBytes = 10GB

function Resolve-BogunonRepository([string]$Path) {
    $resolved = (Resolve-Path -LiteralPath $Path).Path.TrimEnd('\')
    $configPath = Join-Path $resolved 'src-tauri\tauri.conf.json'
    if (
        (Split-Path -Leaf $resolved) -ne 'BOGUNON_DESK' -or
        -not (Test-Path -LiteralPath (Join-Path $resolved '.git')) -or
        -not (Test-Path -LiteralPath $configPath) -or
        -not (Test-Path -LiteralPath (Join-Path $resolved 'src-tauri\Cargo.toml'))
    ) {
        throw 'RepositoryRoot must be the BOGUNON_DESK repository root.'
    }
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if ($config.identifier -ne $expectedIdentifier) {
        throw 'RepositoryRoot has an unexpected Tauri identifier.'
    }
    return $resolved
}

function Format-GiB([long]$Bytes) {
    return '{0:N2} GiB' -f ($Bytes / 1GB)
}

function Measure-LogicalBytes([System.IO.FileInfo[]]$Files, [string]$Path) {
    $prefix = $Path.TrimEnd('\') + '\'
    $sum = ($Files | Where-Object { $_.FullName.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) } |
        Measure-Object -Property Length -Sum).Sum
    if ($null -eq $sum) { return 0L }
    return [long]$sum
}

$root = Resolve-BogunonRepository $RepositoryRoot
$target = Join-Path $root 'src-tauri\target'
$debug = Join-Path $target 'debug'
$incremental = Join-Path $debug 'incremental'
$deps = Join-Path $debug 'deps'
$build = Join-Path $debug 'build'
$release = Join-Path $target 'release'
$bundle = Join-Path $release 'bundle'
$items = if (-not (Test-Path -LiteralPath $target)) {
    @()
} elseif ($Detailed) {
    @(Get-ChildItem -LiteralPath $target -Recurse -Force -ErrorAction Stop)
} else {
    @(Get-ChildItem -LiteralPath $target -Force -ErrorAction Stop)
}
$files = if ($Detailed) { @($items | Where-Object { -not $_.PSIsContainer }) } else { @() }
$reparsePoints = @($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
$logicalBytes = if ($Detailed) { [long](($files | Measure-Object -Property Length -Sum).Sum) } else { $null }
$uniqueBytes = $null
$duplicateBytes = $null

if ($Detailed -and $files.Count -gt 0) {
    if (-not ('Bogunon.FileIdentity' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
namespace Bogunon {
  public static class FileIdentity {
    [StructLayout(LayoutKind.Sequential)]
    private struct Info {
      public uint Attributes;
      public System.Runtime.InteropServices.ComTypes.FILETIME CreationTime;
      public System.Runtime.InteropServices.ComTypes.FILETIME LastAccessTime;
      public System.Runtime.InteropServices.ComTypes.FILETIME LastWriteTime;
      public uint VolumeSerialNumber;
      public uint FileSizeHigh;
      public uint FileSizeLow;
      public uint NumberOfLinks;
      public uint FileIndexHigh;
      public uint FileIndexLow;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out Info info);
    public static string Read(string path) {
      using var handle = CreateFileW(path, 0, 7, IntPtr.Zero, 3, 0x80, IntPtr.Zero);
      if (handle.IsInvalid || !GetFileInformationByHandle(handle, out var info)) throw new Win32Exception(Marshal.GetLastWin32Error());
      return $"{info.VolumeSerialNumber:X8}:{info.FileIndexHigh:X8}:{info.FileIndexLow:X8}";
    }
  }
}
'@
    }
    $identities = @{}
    foreach ($file in $files) {
        $identity = [Bogunon.FileIdentity]::Read($file.FullName)
        if (-not $identities.ContainsKey($identity)) { $identities[$identity] = [long]$file.Length }
    }
    $uniqueBytes = [long](($identities.Values | Measure-Object -Sum).Sum)
    $duplicateBytes = $logicalBytes - $uniqueBytes
}

$drive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($root).TrimEnd(':\'))
$targetDirScopes = 'Process', 'User', 'Machine' | ForEach-Object {
    [pscustomobject]@{ Scope = $_; Value = [Environment]::GetEnvironmentVariable('CARGO_TARGET_DIR', $_) }
}
$activeProcesses = @(Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -in @('cargo.exe', 'rustc.exe', 'school-health-desk.exe') -or
        ($_.Name -eq 'node.exe' -and $_.CommandLine -match '(node_modules[\\/]vite[\\/]bin[\\/]vite\.js|tauri\s+dev)')) -and
    (($_.ExecutablePath -like "$root*") -or ($_.CommandLine -like "*$root*"))
} | Select-Object ProcessId, Name, ExecutablePath, CommandLine)

Write-Output ('Mode: ' + $(if ($Detailed) { 'Detailed' } else { 'Fast' }))
Write-Output ("Repository: {0}" -f $root)
Write-Output ("Drive free: {0}" -f (Format-GiB $drive.Free))
if ($Detailed) {
    Write-Output ("Target logical total: {0}" -f (Format-GiB $logicalBytes))
    Write-Output ("Target unique file data: {0}" -f (Format-GiB $uniqueBytes))
    Write-Output ("Hardlink logical overcount: {0}" -f (Format-GiB $duplicateBytes))
} else {
    Write-Output 'Target sizes: skipped in Fast mode; use -Detailed for recursive size and hardlink analysis.'
}

$areas = @(
    [pscustomobject]@{ Area = 'debug/incremental'; Path = $incremental; Protected = $false }
    [pscustomobject]@{ Area = 'debug/deps'; Path = $deps; Protected = $false }
    [pscustomobject]@{ Area = 'debug/build'; Path = $build; Protected = $false }
    [pscustomobject]@{ Area = 'release'; Path = $release; Protected = $true }
    [pscustomobject]@{ Area = 'release/bundle (installer/updater)'; Path = $bundle; Protected = $true }
)
if ($Detailed) {
    $areas | ForEach-Object {
        [pscustomobject]@{
            Area = $_.Area
            LogicalBytes = Measure-LogicalBytes $files $_.Path
            Protected = $_.Protected
        }
    } | Format-Table -AutoSize | Out-String | Write-Output
} else {
    $areas | ForEach-Object {
        [pscustomobject]@{ Area = $_.Area; Exists = Test-Path -LiteralPath $_.Path; Protected = $_.Protected }
    } | Format-Table -AutoSize | Out-String | Write-Output
}

Write-Output 'CARGO_TARGET_DIR:'
$targetDirScopes | Format-Table -AutoSize | Out-String | Write-Output
Write-Output ("Reparse points: {0}" -f $reparsePoints.Count)
if ($reparsePoints.Count -gt 0) { $reparsePoints | Select-Object FullName, LinkType, Target | Format-Table -AutoSize }
Write-Output ("Active build/development processes: {0}" -f $activeProcesses.Count)
if ($activeProcesses.Count -gt 0) { $activeProcesses | Format-Table -AutoSize }

if ($Detailed -and $uniqueBytes -ge $thresholdBytes) {
    Write-Warning 'Rust target is at least 10 GiB. Review incremental cleanup with scripts/clean-build-cache.ps1.'
}
