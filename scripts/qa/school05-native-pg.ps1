param([ValidateSet('Start','Stop','Offline','Online')][string]$Action='Start')
$ErrorActionPreference='Stop'
if(!$env:TD2_ROOT -or !(Split-Path $env:TD2_ROOT -Leaf).StartsWith('td2-portable-')){throw 'Dedicated CI root required'}
$data=Join-Path $env:TD2_ROOT 'school05-pg-data'
if($Action -ne 'Start'){
 if(!$env:SCHOOL05_PG_BIN -or $env:SCHOOL05_PG_DATA -cne $data){throw 'Owned DB identity mismatch'}
 $ctl=Join-Path $env:SCHOOL05_PG_BIN 'pg_ctl.exe'
 if($Action -in @('Stop','Offline')){& $ctl -D $data -m fast -w stop *> $null;if($LASTEXITCODE -ne 0 -and (Test-Path "$data/postmaster.pid")){throw 'Owned DB stop failed'}}
 else{& $ctl -D $data -l "$env:TD2_ROOT/school05-pg-runtime.log" -w start *> $null;if($LASTEXITCODE -ne 0){throw 'Owned DB restart failed'}}
 return
}
$bins=@(Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\initdb.exe' -ErrorAction SilentlyContinue|Sort-Object FullName -Descending)
if(!$bins.Count){throw 'Preinstalled native PostgreSQL not available; no global installation attempted'}
$bin=Split-Path $bins[0].FullName
if(Test-Path $data){throw 'Refusing existing PostgreSQL data root'}
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$listener.Start();$port=$listener.LocalEndpoint.Port;$listener.Stop()
$init=Join-Path $bin 'initdb.exe';$ctl=Join-Path $bin 'pg_ctl.exe';$psql=Join-Path $bin 'psql.exe'
& $init -D $data -U postgres --auth=trust --encoding=UTF8 --no-locale *> "$env:TD2_ROOT/school05-pg-init.log"
if($LASTEXITCODE -ne 0){throw 'Isolated native PostgreSQL initdb failed'}
@("listen_addresses = '127.0.0.1'","port = $port","log_statement = 'none'","log_min_error_statement = 'panic'","log_error_verbosity = 'terse'")|Add-Content "$data/postgresql.conf"
& $ctl -D $data -l "$env:TD2_ROOT/school05-pg-runtime.log" -w start *> $null
if($LASTEXITCODE -ne 0){throw 'Isolated native PostgreSQL start failed'}
$env:SCHOOL05_PG_BIN=$bin;$env:SCHOOL05_PG_PORT="$port";$env:SCHOOL05_PG_DATA=$data
"SCHOOL05_PG_BIN=$bin" >> $env:GITHUB_ENV;"SCHOOL05_PG_PORT=$port" >> $env:GITHUB_ENV;"SCHOOL05_PG_DATA=$data" >> $env:GITHUB_ENV
& $psql -X -w -h 127.0.0.1 -p $port -U postgres -d postgres -c 'CREATE DATABASE school01a' *> $null
if($LASTEXITCODE -ne 0){throw 'Synthetic DB creation failed'}
$files=@('school-workspace/local/tests/auth_fixture.sql')+@(Get-ChildItem 'school-workspace/local/supabase/migrations/*.sql'|Sort-Object Name|ForEach-Object FullName)+@('school-workspace/integration/sql/local-status.sql','school-workspace/school02/sql/extension.sql','school-workspace/school03/sql/extension.sql','school-workspace/school04/sql/extension.sql','school-workspace/local/tests/fixtures.sql','school-workspace/integration/sql/multi-school-fixture.sql','school-workspace/school02/sql/fixtures.sql','school-workspace/school03/sql/fixtures.sql')
foreach($f in $files){& $psql -X -w -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d school01a -f $f *> "$env:TD2_ROOT/school05-last-fixture.log";if($LASTEXITCODE -ne 0){throw "Synthetic fixture failed: $f"}}
[ordered]@{verdict='PASS';version=(& $psql --version);host='127.0.0.1';port=$port;data=$data;fixtures=$files.Count;backend='native Windows PostgreSQL; synthetic Auth; existing SQL unchanged';operatingDbRequests=0}|ConvertTo-Json|Set-Content "$env:TD2_EVIDENCE_ROOT/school05-native-db.json"
