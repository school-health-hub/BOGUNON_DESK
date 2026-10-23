[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$qaRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $qaRoot "supabase\config.toml"
$sequentialPath = Join-Path $qaRoot "tests\IM-1B-3-use-rpc.sql"
$setupPath = Join-Path $qaRoot "tests\IM-1B-3-concurrency-setup.sql"
$verifyPath = Join-Path $qaRoot "tests\IM-1B-3-concurrency-verify.sql"
$reportPath = Join-Path $qaRoot "reports\IM-1B-3-latest.json"

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

function Invoke-PsqlText {
  param([Parameter(Mandatory)][string]$Sql)

  $output = @($Sql | docker exec -i supabase_db_inventory_qa psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres)
  if ($LASTEXITCODE -ne 0) {
    throw "Local PostgreSQL test execution failed."
  }
  return $output
}

function Start-PsqlWorker {
  param([Parameter(Mandatory)][string]$Sql)

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = "docker"
  $startInfo.Arguments = "exec -i supabase_db_inventory_qa psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres"
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.CreateNoWindow = $true

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  if (-not $process.Start()) {
    throw "Unable to start a local PostgreSQL worker."
  }
  $process.StandardInput.WriteLine($Sql)
  $process.StandardInput.Close()
  return $process
}

function New-WorkerSql {
  param(
    [Parameter(Mandatory)][string]$Scenario,
    [Parameter(Mandatory)][string]$ActorId,
    [Parameter(Mandatory)][string]$ItemId,
    [Parameter(Mandatory)][long]$Quantity,
    [Parameter(Mandatory)][string]$RequestId,
    [Parameter(Mandatory)][string]$Reason
  )

  return @"
select set_config('request.jwt.claims', '{"sub":"$ActorId","role":"authenticated"}', false);
set role authenticated;
do `$worker`$
declare
  worker_response jsonb;
  worker_state text;
  worker_message text;
begin
  begin
    worker_response := public.inventory_use_stock(
      '70000000-0000-4000-8000-00000000000a',
      '$ItemId',
      $Quantity,
      '$RequestId',
      '$Reason'
    );
    insert into public.qa_im1b3_concurrency_results (
      scenario, actor_user_id, outcome, response
    ) values (
      '$Scenario', '$ActorId', 'SUCCESS', worker_response
    );
  exception
    when others then
      get stacked diagnostics worker_state = returned_sqlstate, worker_message = message_text;
      insert into public.qa_im1b3_concurrency_results (
        scenario, actor_user_id, outcome, error_code, error_message
      ) values (
        '$Scenario', '$ActorId', 'ERROR', worker_state, worker_message
      );
  end;
end;
`$worker`$;
"@
}

$sequentialOutput = @(Invoke-PsqlText -Sql (Get-Content -Raw -LiteralPath $sequentialPath))
$sequentialSummary = @($sequentialOutput | Where-Object { $_ -match '^SUMMARY\|' })
if ($sequentialSummary.Count -ne 1 -or $sequentialSummary[0] -ne 'SUMMARY|20|20|0') {
  throw "IM-1B-3 sequential summary was not the expected 20/20 PASS."
}

Invoke-PsqlText -Sql (Get-Content -Raw -LiteralPath $setupPath) | Out-Null
$deadlocksBefore = [long](Invoke-PsqlText -Sql "select deadlocks from pg_stat_database where datname = current_database();" | Select-Object -Last 1)

$workerSpecs = @(
  @{ Scenario = "teacher-instructor"; Actor = "f1000000-0000-4000-8000-000000000001"; Item = "f1100000-0000-4000-8000-000000000001"; Quantity = 6; Request = "f1900000-0000-4000-8000-000000000001"; Reason = "Synthetic teacher race" },
  @{ Scenario = "teacher-instructor"; Actor = "f1000000-0000-4000-8000-000000000002"; Item = "f1100000-0000-4000-8000-000000000001"; Quantity = 6; Request = "f1900000-0000-4000-8000-000000000002"; Reason = "Synthetic instructor race" },
  @{ Scenario = "two-instructors"; Actor = "f1000000-0000-4000-8000-000000000002"; Item = "f1100000-0000-4000-8000-000000000002"; Quantity = 6; Request = "f1900000-0000-4000-8000-000000000003"; Reason = "Synthetic instructor one race" },
  @{ Scenario = "two-instructors"; Actor = "f1000000-0000-4000-8000-000000000003"; Item = "f1100000-0000-4000-8000-000000000002"; Quantity = 6; Request = "f1900000-0000-4000-8000-000000000004"; Reason = "Synthetic instructor two race" },
  @{ Scenario = "last-unit"; Actor = "f1000000-0000-4000-8000-000000000001"; Item = "f1100000-0000-4000-8000-000000000003"; Quantity = 1; Request = "f1900000-0000-4000-8000-000000000005"; Reason = "Synthetic last unit teacher" },
  @{ Scenario = "last-unit"; Actor = "f1000000-0000-4000-8000-000000000002"; Item = "f1100000-0000-4000-8000-000000000003"; Quantity = 1; Request = "f1900000-0000-4000-8000-000000000006"; Reason = "Synthetic last unit instructor" },
  @{ Scenario = "same-uuid"; Actor = "f1000000-0000-4000-8000-000000000002"; Item = "f1100000-0000-4000-8000-000000000004"; Quantity = 3; Request = "f1900000-0000-4000-8000-000000000007"; Reason = "Synthetic same UUID race" },
  @{ Scenario = "same-uuid"; Actor = "f1000000-0000-4000-8000-000000000002"; Item = "f1100000-0000-4000-8000-000000000004"; Quantity = 3; Request = "f1900000-0000-4000-8000-000000000007"; Reason = "Synthetic same UUID race" }
)

for ($offset = 0; $offset -lt $workerSpecs.Count; $offset += 2) {
  $pair = @($workerSpecs[$offset], $workerSpecs[$offset + 1])
  $processes = @($pair | ForEach-Object {
    Start-PsqlWorker -Sql (New-WorkerSql -Scenario $_.Scenario -ActorId $_.Actor -ItemId $_.Item -Quantity $_.Quantity -RequestId $_.Request -Reason $_.Reason)
  })
  foreach ($process in $processes) {
    if (-not $process.WaitForExit(30000)) {
      $process.Kill()
      throw "A concurrent PostgreSQL worker exceeded 30 seconds."
    }
    $standardOutput = $process.StandardOutput.ReadToEnd()
    $standardError = $process.StandardError.ReadToEnd()
    if ($process.ExitCode -ne 0) {
      throw "Concurrent PostgreSQL worker failed: $standardOutput $standardError"
    }
    $process.Dispose()
  }
}

$concurrencyOutput = @(Invoke-PsqlText -Sql (Get-Content -Raw -LiteralPath $verifyPath))
$concurrencySummary = @($concurrencyOutput | Where-Object { $_ -match '^SUMMARY\|' })
if ($concurrencySummary.Count -ne 1 -or $concurrencySummary[0] -ne 'SUMMARY|4|4|0') {
  throw "IM-1B-3 concurrency summary was not the expected 4/4 PASS."
}

$deadlocksAfter = [long](Invoke-PsqlText -Sql "select deadlocks from pg_stat_database where datname = current_database();" | Select-Object -Last 1)
if ($deadlocksAfter -ne $deadlocksBefore) {
  throw "Deadlock count increased during IM-1B-3 concurrency tests."
}

$testLines = @($sequentialOutput + $concurrencyOutput | Where-Object { $_ -match '^TEST\|' })
$results = @($testLines | ForEach-Object {
  $parts = $_ -split '\|', 4
  [pscustomobject]@{
    testId = $parts[1]
    status = $parts[2]
    detail = $parts[3]
  }
})

$report = [pscustomobject]@{
  suite = "IM-1B-3-use-rpc"
  projectId = "inventory_qa"
  authenticationMode = "Postgres RLS claims; independent concurrent database sessions"
  total = $results.Count
  passed = @($results | Where-Object status -eq "PASS").Count
  failed = @($results | Where-Object status -eq "FAIL").Count
  deadlocksObserved = $deadlocksAfter - $deadlocksBefore
  results = $results
}

$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding UTF8
$report
