[CmdletBinding()]
param(
  [switch]$RequireRunning
)

$ErrorActionPreference = "Stop"
$qaRoot = Split-Path -Parent $PSScriptRoot
$contractsPath = Join-Path $qaRoot "contracts\qa-contracts.json"
$identitiesPath = Join-Path $qaRoot "fixtures\synthetic-identities.json"
$inventoryPath = Join-Path $qaRoot "fixtures\synthetic-inventory.json"
$configPath = Join-Path $qaRoot "supabase\config.toml"

$contracts = Get-Content -Raw -LiteralPath $contractsPath | ConvertFrom-Json
$identities = Get-Content -Raw -LiteralPath $identitiesPath | ConvertFrom-Json
$inventory = Get-Content -Raw -LiteralPath $inventoryPath | ConvertFrom-Json
$config = Get-Content -Raw -LiteralPath $configPath

$ids = @($contracts.contracts.id)
if ($ids.Count -ne 34 -or (@($ids | Sort-Object -Unique)).Count -ne 34) {
  throw "Contract manifest must preserve all 34 unique source IDs."
}

$requiredContractFields = @("id", "category", "entities", "environment", "fixture", "preconditions", "steps", "expected", "failureMessage", "cleanup", "implementationStage", "status")
$implementedContractIds = @(
  "INV-D01", "INV-D02", "INV-D03", "INV-D04", "INV-D05", "INV-D07", "INV-D08", "INV-D09",
  "INV-C01", "INV-C02", "INV-C03", "INV-C04", "INV-C05", "INV-C06",
  "INV-S01", "INV-S02", "INV-S03", "INV-S04", "INV-S05", "INV-S06", "INV-S07", "INV-S08"
)
foreach ($contract in $contracts.contracts) {
  foreach ($field in $requiredContractFields) {
    if ($null -eq $contract.$field -or [string]::IsNullOrWhiteSpace([string]$contract.$field)) {
      throw "Contract $($contract.id) is missing $field."
    }
  }
  $expectedStatus = if ($implementedContractIds -contains $contract.id) { "PASS" } else { "PENDING_IMPLEMENTATION" }
  if ($contract.status -ne $expectedStatus) {
    throw "Contract $($contract.id) has unexpected status $($contract.status); expected $expectedStatus."
  }
}

if (@($identities.schools).Count -ne 2 -or @($identities.actors).Count -ne 6) {
  throw "Synthetic identity fixture is incomplete."
}

foreach ($actor in $identities.actors) {
  if ($actor.email -notmatch '@example\.invalid$') {
    throw "Only reserved example.invalid identities are allowed."
  }
  [void][Guid]::Parse($actor.userId)
}

foreach ($item in $inventory.items) {
  if ($item.name -notmatch '^Synthetic ') {
    throw "Inventory fixture is not clearly synthetic."
  }
  if ([decimal]$item.recommendedStock -lt 0) {
    throw "Synthetic quantity must be non-negative."
  }
}

foreach ($lot in $inventory.lots) {
  if ([decimal]$lot.balance -lt 0) {
    throw "Synthetic lot balance must be non-negative."
  }
  [void][DateTime]::ParseExact($lot.expirationDate, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
}

$conversion = $inventory.unitConversion
if ([decimal]$conversion.purchaseQuantity * [decimal]$conversion.baseUnitsPerPurchaseUnit -ne [decimal]$conversion.expectedBaseQuantity) {
  throw "Exact unit conversion fixture is inconsistent."
}

if ($config -match 'https://|supabase\.co|xxownwxxajzrviuvvfiu') {
  throw "Remote Supabase material is forbidden in local QA config."
}

foreach ($port in 56320..56327) {
  if ($config -notmatch [regex]::Escape([string]$port)) {
    throw "Expected isolated port is missing from config: $port"
  }
}

if ($RequireRunning) {
  $databaseContainer = @(docker ps --filter "name=^/supabase_db_inventory_qa$" --format "{{.Names}}|{{.Status}}")
  if ($LASTEXITCODE -ne 0 -or $databaseContainer.Count -ne 1 -or $databaseContainer[0] -notmatch '^supabase_db_inventory_qa\|Up ') {
    throw "The isolated inventory_qa database container is not running."
  }

  $databaseName = docker exec supabase_db_inventory_qa psql -U postgres -d postgres -Atqc "select current_database()"
  if ($LASTEXITCODE -ne 0 -or $databaseName.Trim() -ne "postgres") {
    throw "Local QA database smoke query failed."
  }
}

[pscustomobject]@{
  PrepChecks = "PASS"
  ContractsPreserved = $ids.Count
  BehavioralContractsPassed = @($contracts.contracts | Where-Object status -eq "PASS").Count
  PendingImplementation = @($contracts.contracts | Where-Object status -eq "PENDING_IMPLEMENTATION").Count
  LocalStackRequired = [bool]$RequireRunning
  ProjectId = "inventory_qa"
}

