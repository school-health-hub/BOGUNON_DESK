[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$qaRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $qaRoot "supabase\config.toml"
$reportPath = Join-Path $qaRoot "reports\IM-1B-3-http-latest.json"

$config = Get-Content -Raw -LiteralPath $configPath
if ($config -notmatch 'project_id\s*=\s*"inventory_qa"' -or $config -match 'https://|supabase\.co|xxownwxxajzrviuvvfiu') {
  throw "Refusing HTTP E2E: local inventory_qa isolation guard failed."
}

$kong = @(docker ps --filter "name=^/supabase_kong_inventory_qa$" --format "{{.Names}}|{{.Status}}")
if ($LASTEXITCODE -ne 0 -or $kong.Count -ne 1 -or $kong[0] -notmatch '^supabase_kong_inventory_qa\|Up ') {
  throw "The isolated inventory_qa API gateway is not running."
}

$studioEnvironment = @(docker inspect --format "{{range .Config.Env}}{{println .}}{{end}}" supabase_studio_inventory_qa)
$anonEntry = @($studioEnvironment | Where-Object { $_ -like 'SUPABASE_ANON_KEY=*' })
if ($anonEntry.Count -ne 1) {
  throw "Unable to resolve the local anonymous key without printing it."
}
$anonKey = $anonEntry[0].Substring('SUPABASE_ANON_KEY='.Length)

$apiBase = "http://127.0.0.1:56321"
$email = "http-use-rpc@example.invalid"
$password = ([Guid]::NewGuid().ToString("N") + "!Aa1")
$signupBody = @{ email = $email; password = $password } | ConvertTo-Json
$authHeaders = @{ apikey = $anonKey; Authorization = "Bearer $anonKey" }
$signup = Invoke-RestMethod -Method Post -Uri "$apiBase/auth/v1/signup" -Headers $authHeaders -ContentType "application/json" -Body $signupBody

if ([string]::IsNullOrWhiteSpace([string]$signup.access_token) -or $null -eq $signup.user.id) {
  throw "Local synthetic signup did not return an access token and user ID."
}

$accessToken = [string]$signup.access_token
$userId = [Guid]$signup.user.id
$seedSql = @"
insert into public.inventory_schools (school_id, display_name)
values ('80000000-0000-4000-8000-00000000000a', 'Synthetic HTTP School');
insert into public.inventory_members (school_id, user_id, role, is_active)
values ('80000000-0000-4000-8000-00000000000a', '$userId', 'instructor', true);
insert into public.inventory_items (item_id, school_id, item_name, base_unit, purchase_unit, base_units_per_purchase_unit, recommended_stock, minimum_stock)
values ('f8100000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-00000000000a', 'Synthetic HTTP Item', 'unit', 'unit', 1, 5, 1);
insert into public.inventory_stock_lots (lot_id, school_id, item_id, received_at, expires_on, initial_quantity, remaining_quantity, status)
values ('f8110000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-00000000000a', 'f8100000-0000-4000-8000-000000000001', '2026-01-01T00:00:00Z', '2099-01-01', 5, 5, 'available');
"@
$seedSql | docker exec -i supabase_db_inventory_qa psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
if ($LASTEXITCODE -ne 0) {
  throw "Synthetic HTTP fixture setup failed."
}

$rpcHeaders = @{ apikey = $anonKey; Authorization = "Bearer $accessToken" }
$requestBody = @{
  p_school_id = "80000000-0000-4000-8000-00000000000a"
  p_item_id = "f8100000-0000-4000-8000-000000000001"
  p_quantity = 2
  p_request_uuid = "f8900000-0000-4000-8000-000000000001"
  p_reason = "Synthetic HTTP use"
} | ConvertTo-Json

$first = Invoke-RestMethod -Method Post -Uri "$apiBase/rest/v1/rpc/inventory_use_stock" -Headers $rpcHeaders -ContentType "application/json" -Body $requestBody
$replay = Invoke-RestMethod -Method Post -Uri "$apiBase/rest/v1/rpc/inventory_use_stock" -Headers $rpcHeaders -ContentType "application/json" -Body $requestBody

$conflictBody = @{
  p_school_id = "80000000-0000-4000-8000-00000000000a"
  p_item_id = "f8100000-0000-4000-8000-000000000001"
  p_quantity = 3
  p_request_uuid = "f8900000-0000-4000-8000-000000000001"
  p_reason = "Synthetic HTTP use"
} | ConvertTo-Json

$conflictStatus = 0
$conflictMessage = $null
try {
  Invoke-RestMethod -Method Post -Uri "$apiBase/rest/v1/rpc/inventory_use_stock" -Headers $rpcHeaders -ContentType "application/json" -Body $conflictBody | Out-Null
}
catch {
  $conflictStatus = [int]$_.Exception.Response.StatusCode
  $rawErrorBody = [string]$_.ErrorDetails.Message
  if ([string]::IsNullOrWhiteSpace($rawErrorBody)) {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = [System.IO.StreamReader]::new($stream)
    try {
      $rawErrorBody = $reader.ReadToEnd()
    }
    finally {
      $reader.Dispose()
      $stream.Dispose()
    }
  }
  $errorBody = $rawErrorBody | ConvertFrom-Json
  $conflictMessage = [string]$errorBody.message
}

$databaseCheck = @(
  docker exec supabase_db_inventory_qa psql -X -qAt -U postgres -d postgres -c "select remaining_quantity || '|' || (select count(*) from public.inventory_stock_movements where request_id='f8900000-0000-4000-8000-000000000001') from public.inventory_stock_lots where lot_id='f8110000-0000-4000-8000-000000000001'"
)
if ($LASTEXITCODE -ne 0 -or $databaseCheck.Count -ne 1) {
  throw "Unable to verify the HTTP RPC database side effects."
}

$passed = (
  [string]$first.deducted_quantity -eq "2" -and
  [string]$first.replayed -eq "False" -and
  [string]$replay.replayed -eq "True" -and
  $conflictStatus -eq 409 -and
  $conflictMessage -eq "IDEMPOTENCY_CONFLICT" -and
  $databaseCheck[0] -eq "3|1"
)
if (-not $passed) {
  $diagnostic = (
    "Actual local Auth/JWT HTTP RPC E2E mismatch: firstQuantity={0}; firstReplayed={1}; " +
    "retryReplayed={2}; conflictStatus={3}; conflictMessage={4}; databaseState={5}"
  ) -f @(
    [string]$first.deducted_quantity,
    [string]$first.replayed,
    [string]$replay.replayed,
    $conflictStatus,
    $conflictMessage,
    [string]$databaseCheck[0]
  )
  throw $diagnostic
}

$report = [pscustomobject]@{
  suite = "IM-1B-3-http-e2e"
  projectId = "inventory_qa"
  syntheticIdentity = $email
  firstDeductedQuantity = [long]$first.deducted_quantity
  replayed = [bool]$replay.replayed
  conflictHttpStatus = $conflictStatus
  conflictMessage = $conflictMessage
  databaseState = $databaseCheck[0]
  status = "PASS"
}

$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $reportPath -Encoding UTF8
$report

$accessToken = $null
$anonKey = $null
