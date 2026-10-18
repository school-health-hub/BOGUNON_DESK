param([Parameter(Mandatory = $true)][string]$ExpectedSourceHead,
      [Parameter(Mandatory = $true)][string]$TargetDirectory)
$ErrorActionPreference = 'Stop'
$qaDirectory = $PSScriptRoot
$repository = [System.IO.Path]::GetFullPath((Join-Path $qaDirectory '..\..'))
if ($ExpectedSourceHead -cnotmatch '^[0-9a-f]{40}$') { throw 'Invalid expected source HEAD' }
$branch = (& git -C $repository branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -cne 'codex/desktop-surface-core-9b2a') { throw 'Branch mismatch' }
$sourceHead = (& git -C $repository rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $sourceHead -cne $ExpectedSourceHead) { throw 'Source HEAD mismatch' }
$status = & git -C $repository status --porcelain
if ($LASTEXITCODE -ne 0 -or $status) { throw 'Working tree must be clean' }
$resolvedTarget = [System.IO.Path]::GetFullPath($TargetDirectory)
if ($resolvedTarget.Equals($repository, [System.StringComparison]::OrdinalIgnoreCase) -or $resolvedTarget.StartsWith($repository + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Target directory must be outside repository' }
if (Test-Path -LiteralPath $resolvedTarget) { throw 'Target directory must not already exist' }
$oldSource = $env:BOGUNON_9B3J_SOURCE_SHA
try {
    $env:BOGUNON_9B3J_SOURCE_SHA = $sourceHead
    & cargo build --offline --locked --manifest-path (Join-Path $qaDirectory 'Cargo.toml') --target-dir $resolvedTarget --bin desktop-surface-integrated --features integrated-native-qa-skip-miri
    if ($LASTEXITCODE -ne 0) { throw 'Integrated static build failed' }
    $afterHead = (& git -C $repository rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $afterHead -cne $sourceHead) { throw 'Source HEAD changed during build' }
    $afterStatus = & git -C $repository status --porcelain
    if ($LASTEXITCODE -ne 0 -or $afterStatus) { throw 'Source files changed during build' }
    $artifact = Join-Path $resolvedTarget 'debug\desktop-surface-integrated.exe'
    $hash = (Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Output "SOURCE_SHA=$sourceHead"
    Write-Output "EXECUTABLE_SHA256=$hash"
    Write-Output 'APPROVAL=NOT_GRANTED'
} finally {
    $env:BOGUNON_9B3J_SOURCE_SHA = $oldSource
}
