# Run with pwsh -File from a dedicated repository clone. Never dot-source.
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
Set-Location $repo
$container = 'bogunon-school05-pg'
$image = 'postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
& docker inspect $container *> $null
if ($LASTEXITCODE -eq 0) { throw 'Existing QA container: refusing to overwrite' }
$qaRun = [guid]::NewGuid().ToString()
$qaRoot = Join-Path ([System.IO.Path]::GetTempPath()) 'bogunon-school05-qa'
New-Item -ItemType Directory -Force $qaRoot | Out-Null
$env:ELECTRON_P0_QA_PROFILE = '1'
$env:ELECTRON_P0_QA_ROOT = $qaRoot
$env:ELECTRON_P0_TEST_RUN = $qaRun
$env:SCHOOL_WORKSPACE_MODE = 'synthetic'
$env:NODE_ENV = 'development'
$env:ELECTRON_P0_DEV_URL = ''
# The default Docker Desktop engine must be Linux. No DB ports are published.
& docker run -d --name $container --network none --tmpfs '/var/lib/postgresql/data:rw,noexec,nosuid,size=256m' -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=school01a $image -c listen_addresses= -c log_statement=none -c log_min_error_statement=panic -c log_error_verbosity=terse
if ($LASTEXITCODE -ne 0) { throw 'Local synthetic DB creation failed' }
try {
  $ready = $false
  for ($n=0; $n -lt 120; $n++) { $initialized = ((& docker logs $container 2>&1 | Out-String) -match 'init process complete'); & docker exec $container pg_isready -U postgres -d school01a *> $null; if ($LASTEXITCODE -eq 0 -and $initialized) { $ready=$true; break }; Start-Sleep -Milliseconds 250 }
  if (!$ready) { throw 'Local DB readiness failed' }
  $files = @('school-workspace/local/tests/auth_fixture.sql') + @(Get-ChildItem 'school-workspace/local/supabase/migrations/*.sql' | Sort-Object Name | ForEach-Object FullName) + @('school-workspace/integration/sql/local-status.sql','school-workspace/school02/sql/extension.sql','school-workspace/school03/sql/extension.sql','school-workspace/school04/sql/extension.sql','school-workspace/local/tests/fixtures.sql','school-workspace/integration/sql/multi-school-fixture.sql','school-workspace/school02/sql/fixtures.sql','school-workspace/school03/sql/fixtures.sql')
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  foreach ($file in $files) { Get-Content -Raw -Encoding utf8 $file | & docker exec -i $container psql -X -q -v ON_ERROR_STOP=1 -U postgres -d school01a; if ($LASTEXITCODE -ne 0) { throw "Local fixture failed: $file" } }
  & node school-workspace/school05/tools/build-qa.mjs
  if ($LASTEXITCODE -ne 0) { throw 'External QA provider build failed' }
  & node node_modules/electron/cli.js build/electron-p0-app
  if ($LASTEXITCODE -ne 0) { throw 'Electron QA exit failure' }
} finally { & docker rm -f $container | Out-Null }
