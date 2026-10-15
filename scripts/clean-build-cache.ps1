[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Incremental')]
    [string]$Scope,
    [switch]$Execute,
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$expectedIdentifier = 'kr.sungandi.schoolhealthdesk'

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

function Assert-OrdinaryDirectory([string]$Path, [string]$Boundary) {
    $current = Get-Item -LiteralPath $Path -Force
    while ($true) {
        if ($current.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Cleanup path contains a reparse point: $($current.FullName)"
        }
        if ($current.FullName -eq $Boundary) { return }
        $current = $current.Parent
        if ($null -eq $current) { throw 'Cleanup path escaped the expected target boundary.' }
    }
}

$root = Resolve-BogunonRepository $RepositoryRoot
$targetRoot = [IO.Path]::GetFullPath((Join-Path $root 'src-tauri\target'))
$cleanupPath = [IO.Path]::GetFullPath((Join-Path $targetRoot 'debug\incremental'))
$expectedPath = [IO.Path]::GetFullPath((Join-Path $root 'src-tauri\target\debug\incremental'))
if ($cleanupPath -ne $expectedPath -or -not $cleanupPath.StartsWith($targetRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Resolved cleanup path is outside the expected Debug incremental cache.'
}

$protectedPaths = @(
    (Join-Path $root '.git'),
    (Join-Path $root 'src-tauri\target\debug\school-health-desk.exe'),
    (Join-Path $root 'src-tauri\target\release'),
    (Join-Path $root 'src-tauri\target\release\bundle'),
    (Join-Path $env:LOCALAPPDATA 'BOGUNON DESK'),
    (Join-Path $env:LOCALAPPDATA 'kr.sungandi.schoolhealthdesk'),
    (Join-Path $env:APPDATA 'kr.sungandi.schoolhealthdesk')
) | ForEach-Object { [IO.Path]::GetFullPath($_) }
if ($protectedPaths -contains $cleanupPath) { throw 'Resolved cleanup path is protected.' }

if (-not (Test-Path -LiteralPath $cleanupPath)) {
    Write-Output ("{0} cache does not exist: {1}" -f $Scope, $cleanupPath)
    exit 0
}
Assert-OrdinaryDirectory $cleanupPath $root
$nestedReparsePoints = @(Get-ChildItem -LiteralPath $cleanupPath -Recurse -Force -ErrorAction Stop |
    Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
if ($nestedReparsePoints.Count -gt 0) {
    throw "Cleanup path contains nested reparse points: $($nestedReparsePoints.Count)"
}

$activeProcesses = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -in @('cargo.exe', 'rustc.exe') -or
    (($_.Name -in @('school-health-desk.exe', 'node.exe')) -and
        $_.CommandLine -match '(node_modules[\\/]vite[\\/]bin[\\/]vite\.js|tauri\s+(build|dev)|BOGUNON_DESK)')
})
if ($Execute -and $activeProcesses.Count -gt 0) {
    $summary = ($activeProcesses | ForEach-Object { "$($_.Name) ($($_.ProcessId))" }) -join ', '
    throw "Active build/development processes prevent cleanup: $summary"
}

$files = @(Get-ChildItem -LiteralPath $cleanupPath -File -Recurse -Force -ErrorAction Stop)
$bytes = [long](($files | Measure-Object -Property Length -Sum).Sum)
$mode = if ($Execute) { 'EXECUTE' } else { 'DRY RUN' }
Write-Output ("Mode: {0}" -f $mode)
Write-Output ("Scope: {0}" -f $Scope)
Write-Output ("Path: {0}" -f $cleanupPath)
Write-Output ("Logical size: {0:N2} GiB ({1} files)" -f ($bytes / 1GB), $files.Count)
if (-not $Execute -and $activeProcesses.Count -gt 0) {
    Write-Output ("DRY RUN NOTICE: {0} active build/development process(es) would block -Execute." -f $activeProcesses.Count)
}

if (-not $Execute) {
    Write-Output 'DRY RUN: no files were deleted. Add -Execute with -Scope Incremental to perform cleanup.'
    exit 0
}

Remove-Item -LiteralPath $cleanupPath -Recurse -ErrorAction Stop
Write-Output 'Incremental cache cleanup completed.'
