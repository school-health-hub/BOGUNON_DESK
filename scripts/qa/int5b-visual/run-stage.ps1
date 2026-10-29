param([Parameter(Mandatory)][ValidateSet('product-install','build','tools-install','browser-install','capture')][string]$Stage)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') { throw 'Remote Windows only; local execution prohibited' }
$source = Join-Path $env:GITHUB_WORKSPACE 'source'
$evidence = Join-Path $env:QA_ROOT 'evidence'
$toolRoot = Join-Path $PSScriptRoot 'tools'
$provenance = Get-Content "$evidence/provenance.json" -Raw | ConvertFrom-Json
if ((git -C $source rev-parse HEAD).Trim() -cne $provenance.productSha) { throw 'Product SHA mismatch' }
$command = switch ($Stage) {
  'product-install' { @{cwd=$source; tool='npm.cmd'; arguments=@('ci','--no-audit','--no-fund')} }
  'build' { @{cwd=$source; tool='npm.cmd'; arguments=@('run','build')} }
  'tools-install' { @{cwd=$toolRoot; tool='npm.cmd'; arguments=@('ci','--ignore-scripts','--no-audit','--no-fund')} }
  'browser-install' { @{cwd=$toolRoot; tool='node.exe'; arguments=@('node_modules/playwright-core/cli.js','install','chromium')} }
  'capture' { @{cwd=$source; tool='node.exe'; arguments=@((Join-Path $PSScriptRoot 'capture.mjs'))} }
}
$timer = [Diagnostics.Stopwatch]::StartNew()
$code = -1
Push-Location $command.cwd
try {
  $tool = $command.tool
  $arguments = $command.arguments
  & $tool @arguments 2>&1 | Tee-Object "$evidence/$Stage.log"
  $code = $LASTEXITCODE
} finally {
  Pop-Location
  $timer.Stop()
  $productLockUnchanged = (Get-FileHash "$source/package-lock.json").Hash -ceq $provenance.productLockSha256
  $toolsLockUnchanged = (Get-FileHash "$toolRoot/package-lock.json").Hash -ceq $provenance.toolsLockSha256
  @{stage=$Stage; exitCode=$code; seconds=$timer.Elapsed.TotalSeconds; productLockUnchanged=$productLockUnchanged; toolsLockUnchanged=$toolsLockUnchanged} | ConvertTo-Json | Set-Content "$evidence/$Stage.json"
}
if ($code -ne 0 -or -not $productLockUnchanged -or -not $toolsLockUnchanged) { throw "Stage failed: $Stage; no automatic retry" }
if ($Stage -eq 'build') {
  if (-not (Test-Path "$source/dist/index.html" -PathType Leaf)) { throw 'Missing dist' }
  $dist = (Resolve-Path "$source/dist").Path
  @(Get-ChildItem $dist -File -Recurse | ForEach-Object { @{path=$_.FullName.Substring($dist.Length+1);bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash} }) | ConvertTo-Json | Set-Content "$evidence/build-manifest.json"
}
git -C $source diff --exit-code
if ($LASTEXITCODE -ne 0) { throw 'Tracked product changed' }
