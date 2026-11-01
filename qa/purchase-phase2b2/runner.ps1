$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -cne 'true' -or $env:RUNNER_ENVIRONMENT -cne 'github-hosted' -or $env:OS -cne 'Windows_NT') { throw 'Browser QA installs and execution require a GitHub-hosted Windows runner' }
$source = [IO.Path]::GetFullPath($env:SOURCE_ROOT)
$evidence = [IO.Path]::GetFullPath($env:EVIDENCE_DIR)
$qa = Join-Path $source 'qa/purchase-phase2b2-runtime'
$baseQa = Join-Path $source 'qa/purchase-phase2b1'
New-Item -ItemType Directory -Force $evidence | Out-Null
$stages = [Collections.Generic.List[object]]::new()
$baseline = @{}
$failure = $null
function Invoke-Stage([string]$Name, [string]$Program, [string[]]$Arguments) {
    $stdout = Join-Path $evidence "$Name.stdout.log"
    $stderr = Join-Path $evidence "$Name.stderr.log"
    & $Program @Arguments 1> $stdout 2> $stderr
    $code = $LASTEXITCODE
    $stages.Add([ordered]@{ name = $Name; exitCode = $code; stdout = "$Name.stdout.log"; stderr = "$Name.stderr.log" })
    Get-Content $stdout | Write-Host
    Get-Content $stderr | Write-Host
    if ($code -ne 0) { throw "Stage $Name failed with exit code $code" }
}
function Assert-Product {
    $head = & git -C $source rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or $head -ne $env:PRODUCT_SHA) { throw 'Immutable product HEAD mismatch' }
    & git -C $source diff --exit-code HEAD -- .
    if ($LASTEXITCODE -ne 0) { throw 'Tracked product files changed' }
    foreach ($path in $baseline.Keys) {
        if ((Get-FileHash -LiteralPath (Join-Path $source $path) -Algorithm SHA256).Hash -ne $baseline[$path]) {
            throw "Product bytes changed: $path"
        }
    }
}
try {
    $tracked = @(& git -C $source -c core.quotepath=false ls-files)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inventory product files' }
    foreach ($path in $tracked) {
        $baseline[$path] = (Get-FileHash -LiteralPath (Join-Path $source $path) -Algorithm SHA256).Hash
    }
    $baseline | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $evidence 'product-before.sha256.json')
    Assert-Product
    if (Get-NetTCPConnection -LocalPort 1420 -State Listen -ErrorAction SilentlyContinue) { throw 'QA port already in use' }
    if (Test-Path $qa) { throw 'QA overlay unexpectedly exists in immutable product' }
    Copy-Item -LiteralPath $baseQa -Destination $qa -Recurse
    Copy-Item -Path (Join-Path $PSScriptRoot '*') -Destination $qa -Recurse -Force
    foreach ($file in @('package.json','package-lock.json')) {
        if ((Get-FileHash (Join-Path $qa $file) -Algorithm SHA256).Hash -cne (Get-FileHash (Join-Path $baseQa $file) -Algorithm SHA256).Hash) { throw 'QA dependency bytes changed' }
    }
    Assert-Product
    Push-Location $source
    try {
        Invoke-Stage 'product-npm-ci' 'npm.cmd' @('ci', '--ignore-scripts', '--no-audit', '--no-fund')
        Invoke-Stage 'product-typecheck' 'node.exe' @('node_modules/typescript/bin/tsc', '--noEmit')
        $purchaseTests = @(Get-ChildItem (Join-Path $source 'src/components/desktop') -Filter 'Purchase*.test.tsx' -File | Select-Object -ExpandProperty FullName)
        Invoke-Stage 'purchase-tests' 'node.exe' (@('node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=2', '--no-cache', '--reporter=default', '--reporter=junit', "--outputFile.junit=$evidence/vitest-purchase.xml", 'src/purchase') + $purchaseTests)
        Invoke-Stage 'account-settings-tests' 'node.exe' @('node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=2', '--no-cache', '--reporter=default', '--reporter=junit', "--outputFile.junit=$evidence/vitest-account-settings.xml", 'src/settings')
        Invoke-Stage 'production-build' 'npm.cmd' @('run', 'build')
        $env:PURCHASE_QA_FIXTURE_PATH = Join-Path $evidence 'mapping-fixtures.json'
        Invoke-Stage 'rust-purchase-tests' 'cargo.exe' @('test', '--locked', '--manifest-path', 'src-tauri/Cargo.toml', 'purchase')
        Invoke-Stage 'rust-check' 'cargo.exe' @('check', '--locked', '--manifest-path', 'src-tauri/Cargo.toml')
        if (-not (Test-Path -LiteralPath $env:PURCHASE_QA_FIXTURE_PATH)) { throw 'Actual Rust mapping fixtures missing' }
        Copy-Item -LiteralPath $env:PURCHASE_QA_FIXTURE_PATH -Destination (Join-Path $qa 'mapping-fixtures.json')
    }
    finally { Pop-Location }
    Push-Location $qa
    try {
        Invoke-Stage 'qa-npm-ci' 'npm.cmd' @('ci', '--ignore-scripts', '--no-audit', '--no-fund')
        Invoke-Stage 'typecheck' 'node.exe' @((Join-Path $source 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', (Join-Path $qa 'tsconfig.json'))
        $playwright = Join-Path $qa 'node_modules/@playwright/test/cli.js'
        Invoke-Stage 'test-list' 'node.exe' @($playwright, 'test', '--config', 'playwright.config.ts', '--list')
        Invoke-Stage 'chromium-install' 'node.exe' @($playwright, 'install', 'chromium')
        Invoke-Stage 'versions' 'node.exe' @((Join-Path $qa 'runner-versions.mjs'))
        Invoke-Stage 'browser-tests' 'node.exe' @($playwright, 'test', '--config', 'playwright.config.ts', '--workers=1', '--retries=0')
    } finally { Pop-Location }
} catch {
    $failure = $_.Exception.Message
    $failure | Set-Content (Join-Path $evidence 'failure.txt')
} finally {
    if (Get-NetTCPConnection -LocalPort 1420 -State Listen -ErrorAction SilentlyContinue) { $failure = 'QA server listener remained after test shutdown' }
    try { Assert-Product; $integrity = 'PASS' } catch { $integrity = 'FAIL'; $failure = $_.Exception.Message }
    $after = @{}
    foreach ($path in $baseline.Keys) {
        $fullPath = Join-Path $source $path
        $after[$path] = if (Test-Path -LiteralPath $fullPath) { (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash } else { 'MISSING' }
    }
    & git -C $source status --porcelain --untracked-files=all | Set-Content (Join-Path $evidence 'product-status.txt')
    $expectedStages = @('product-npm-ci','product-typecheck','purchase-tests','account-settings-tests','full-vitest','production-build','rust-purchase-tests','rust-check','qa-npm-ci','typecheck','test-list','chromium-install','versions','browser-tests')
    $stageResults = foreach ($name in $expectedStages) {
        $stage = @($stages.Where({ $_.name -eq $name }))
        [ordered]@{ name=$name; status=$(if ($stage.Count -eq 0) { 'NOT RUN' } elseif ($stage[0].exitCode -eq 0) { 'PASS' } else { 'FAIL' }) }
    }
    $stageResults | ConvertTo-Json | Set-Content (Join-Path $evidence 'stage-results.json')
    $after | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $evidence 'product-after.sha256.json')
    [ordered]@{
        productSHA = $env:PRODUCT_SHA; controllerSHA = $env:CONTROLLER_SHA
        node = (& node.exe --version); operatingSystem = [Environment]::OSVersion.ToString()
        productIntegrity = $integrity; stages = $stages; failure = $failure
        browserGUI = $(if ($stages.Where({ $_.name -eq 'browser-tests' -and $_.exitCode -eq 0 }).Count) { 'PASS' } else { 'FAIL_OR_NOT_RUN' })
        nativeTauri = 'NOT RUN'; nativePrint = 'NOT RUN'; realDatabase = 'NOT RUN'; nativePreviewIPC = 'NOT RUN'; nativeFileDialogs = 'NOT RUN'
        rustPurchaseContracts = $(if ($stages.Where({ $_.name -eq 'rust-purchase-tests' -and $_.exitCode -eq 0 }).Count) { 'PASS' } else { 'NOT RUN OR FAIL' })
        fullVitest = 'NOT RUN: targeted purchase/frontend and account-settings regression'; mappingFixtureOrigin = 'actual Rust cfg(test) export'; nativeMappingIPC = 'NOT RUN: deferred browser transport only'
        browserMode = 'headed Chromium'; realIme = 'NOT RUN'; windowsDpi = 'NOT RUN'
    } | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $evidence 'run-manifest.json')
    $hashes = Get-ChildItem $evidence -Recurse -File | Sort-Object FullName | ForEach-Object {
        [ordered]@{ path = [IO.Path]::GetRelativePath($evidence, $_.FullName); sha256 = (Get-FileHash $_.FullName -Algorithm SHA256).Hash; bytes = $_.Length }
    }
    $hashes | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $evidence 'evidence-sha256.json')
    @"
    ## Purchase Phase 2B2 browser QA
    Product: $env:PRODUCT_SHA
    Controller: $env:CONTROLLER_SHA
    Product integrity: $integrity
    Browser execution: $(($stageResults | Where-Object { $_.name -eq 'browser-tests' }).status)
    Overall runner: $(if ($failure) { 'FAIL / see stage logs' } else { 'PASS' })
    Native Tauri, native print, and real database: NOT RUN.
    Artifact includes stage stdout/stderr, reports and browser evidence produced by the tests, and SHA-256 inventory.
"@ | Add-Content $env:GITHUB_STEP_SUMMARY
}
if ($failure) { throw $failure }
