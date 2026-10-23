[CmdletBinding()]
param(
  [Parameter(Mandatory, Position = 0)]
  [ValidateSet("start", "status", "stop")]
  [string]$Action
)

$ErrorActionPreference = "Stop"
$cliVersion = "2.121.0"
$expectedIntegrity = "sha512-xffhOgD9rXsXLK+DQ+3Gq8b2KmavMjPHGuJr7lfVlD8vKK1HHFggYlmzdRECqPmOL8g3Yd5PN3URcUR8xWZcWw=="
$qaRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $qaRoot "supabase\config.toml"

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Local QA config is missing: $configPath"
}

$config = Get-Content -Raw -LiteralPath $configPath
if ($config -notmatch 'project_id\s*=\s*"inventory_qa"') {
  throw "Refusing to run: local project_id is not inventory_qa."
}

if ($config -match 'https://|supabase\.co|xxownwxxajzrviuvvfiu') {
  throw "Refusing to run: remote Supabase material was found in the local QA config."
}

$databaseContainerName = "supabase_db_inventory_qa"

function Invoke-PinnedSupabaseCli {
  param([string[]]$Arguments)

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & npm @Arguments 1>$null 2>$null
    return $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

if ($Action -eq "status") {
  $services = @(docker ps --filter "name=supabase_.*_inventory_qa" --format "{{.Names}}|{{.Status}}|{{.Ports}}")
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect the isolated Docker services."
  }

  $services | ForEach-Object { $_ }
  return
}

$integrity = (npm view "supabase@$cliVersion" dist.integrity).Trim()
if ($integrity -ne $expectedIntegrity) {
  throw "Supabase CLI package integrity does not match the pinned value."
}

$existingDatabase = @(docker ps --filter "name=^/$databaseContainerName$" --format "{{.Names}}")
if ($LASTEXITCODE -ne 0) {
  throw "Unable to inspect the isolated QA database container."
}

if ($Action -eq "start" -and $existingDatabase.Count -eq 0) {
  $listeningPorts = netstat -ano -p tcp
  foreach ($port in 56320..56327) {
    if ($listeningPorts -match ":$port\s+.*LISTENING") {
      throw "Refusing to start: isolated QA port is already in use: $port"
    }
  }
}

$arguments = @("exec", "--yes", "--package=supabase@$cliVersion", "--", "supabase", "--workdir", $qaRoot, $Action)
if ($Action -eq "start" -and $existingDatabase.Count -eq 0) {
  $arguments += "--yes"
  $cliExitCode = Invoke-PinnedSupabaseCli -Arguments $arguments
  if ($cliExitCode -ne 0) {
    throw "Supabase CLI action failed: $Action"
  }
}
elseif ($Action -eq "stop") {
  $cliExitCode = Invoke-PinnedSupabaseCli -Arguments $arguments
  if ($cliExitCode -ne 0) {
    throw "Supabase CLI action failed: $Action"
  }
  return
}

$deadline = [DateTime]::UtcNow.AddSeconds(120)
do {
  $databaseState = @(docker inspect --format "{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" $databaseContainerName 2>$null)
  if ($LASTEXITCODE -eq 0 -and $databaseState.Count -eq 1 -and $databaseState[0] -eq "running|healthy") {
    [pscustomobject]@{
      ProjectId = "inventory_qa"
      DatabaseState = $databaseState[0]
      ApiPort = 56321
      DatabasePort = 56322
      StudioPort = 56323
    }
    return
  }
  Start-Sleep -Seconds 2
} while ([DateTime]::UtcNow -lt $deadline)

throw "The isolated inventory_qa database did not become healthy within 120 seconds."

