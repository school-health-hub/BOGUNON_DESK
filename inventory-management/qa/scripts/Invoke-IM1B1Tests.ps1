[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$qaRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $qaRoot "supabase\config.toml"
$testPath = Join-Path $qaRoot "tests\IM-1B-1-tenancy-rls.sql"
$reportPath = Join-Path $qaRoot "reports\IM-1B-1-latest.json"

$config = Get-Content -Raw -LiteralPath $configPath
if ($config -notmatch 'project_id\s*=\s*"inventory_qa"') {
  throw "Refusing to test: project_id is not inventory_qa."
}
if ($config -match 'https://|supabase\.co|xxownwxxajzrviuvvfiu') {
  throw "Refusing to test: remote Supabase material was found."
}

$databaseContainer = @(docker ps --filter "name=^/supabase_db_inventory_qa$" --format "{{.Names}}|{{.Status}}")
if ($LASTEXITCODE -ne 0 -or $databaseContainer.Count -ne 1 -or $databaseContainer[0] -notmatch '^supabase_db_inventory_qa\|Up .*\(healthy\)$') {
  throw "The isolated inventory_qa database container is not healthy."
}

$sql = Get-Content -Raw -LiteralPath $testPath
$output = @($sql | docker exec -i supabase_db_inventory_qa psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres)
if ($LASTEXITCODE -ne 0) {
  throw "IM-1B-1 SQL test execution failed."
}

$testLines = @($output | Where-Object { $_ -match '^TEST\|' })
$summaryLine = @($output | Where-Object { $_ -match '^SUMMARY\|' })
if ($summaryLine.Count -ne 1 -or $summaryLine[0] -ne 'SUMMARY|17|17|0') {
  throw "IM-1B-1 test summary was not the expected 17/17 PASS."
}

$results = @($testLines | ForEach-Object {
  $parts = $_ -split '\|', 4
  [pscustomobject]@{
    testId = $parts[1]
    status = $parts[2]
    detail = $parts[3]
  }
})

$report = [pscustomobject]@{
  suite = "IM-1B-1-tenancy-rls"
  projectId = "inventory_qa"
  authenticationMode = "Postgres RLS with authenticated/anon roles and request.jwt.claims"
  total = $results.Count
  passed = @($results | Where-Object status -eq "PASS").Count
  failed = @($results | Where-Object status -eq "FAIL").Count
  results = $results
}

$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding UTF8
$report
