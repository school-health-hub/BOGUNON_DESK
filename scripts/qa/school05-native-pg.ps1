param([ValidateSet('Start','Stop','Offline','Online')][string]$Action='Start')
$ErrorActionPreference='Stop'
if(!$env:TD2_ROOT -or !(Split-Path $env:TD2_ROOT -Leaf).StartsWith('td2-portable-')){throw 'Dedicated CI root required'}
$data=Join-Path $env:TD2_ROOT 'school05-pg-data'
function Invoke-OwnedPg([string]$Binary,[string[]]$Arguments,[string]$Stage,[int]$Seconds=60){
  Write-Output "SCHOOL05 native PG stage: $Stage"
  $out=Join-Path $env:TD2_ROOT "school05-$Stage.stdout"
  $err=Join-Path $env:TD2_ROOT "school05-$Stage.stderr"
  $quoted=@($Arguments|ForEach-Object{'"'+($_ -replace '"','\"')+'"'})
  $process=Start-Process -FilePath $Binary -ArgumentList $quoted -PassThru -NoNewWindow -RedirectStandardOutput $out -RedirectStandardError $err
  if(!$process.WaitForExit($Seconds*1000)){Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue;throw "Owned PostgreSQL command timed out: $Stage"}
  if($process.ExitCode -ne 0){if($Stage -in @('initdb','start','createdb')){Get-Content $err -Tail 8|Write-Output};throw "Owned PostgreSQL command failed: $Stage"}
}
if($Action -ne 'Start'){
 if(!$env:SCHOOL05_PG_BIN -or $env:SCHOOL05_PG_DATA -cne $data){throw 'Owned DB identity mismatch'}
 $ctl=Join-Path $env:SCHOOL05_PG_BIN 'pg_ctl.exe'
 if($Action -in @('Stop','Offline')){if(Test-Path "$data/postmaster.pid"){Invoke-OwnedPg $ctl @('-D',$data,'-m','fast','-w','stop') 'stop' 30}}
 else{Invoke-OwnedPg $ctl @('-D',$data,'-l',"$env:TD2_ROOT/school05-pg-runtime.log",'-w','start') 'restart' 90}
 return
}
$bins=@(Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\initdb.exe' -ErrorAction SilentlyContinue|Sort-Object FullName -Descending)
if(!$bins.Count){throw 'Preinstalled native PostgreSQL not available; no global installation attempted'}
$bin=Split-Path $bins[0].FullName
if(Test-Path $data){throw 'Refusing existing PostgreSQL data root'}
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$listener.Start();$port=$listener.LocalEndpoint.Port;$listener.Stop()
$init=Join-Path $bin 'initdb.exe';$ctl=Join-Path $bin 'pg_ctl.exe';$psql=Join-Path $bin 'psql.exe'
$env:SCHOOL05_PG_BIN=$bin;$env:SCHOOL05_PG_PORT="$port";$env:SCHOOL05_PG_DATA=$data
"SCHOOL05_PG_BIN=$bin" >> $env:GITHUB_ENV;"SCHOOL05_PG_PORT=$port" >> $env:GITHUB_ENV;"SCHOOL05_PG_DATA=$data" >> $env:GITHUB_ENV
Invoke-OwnedPg $init @('-D',$data,'-U','postgres','--auth=trust','--encoding=UTF8','--no-locale') 'initdb' 90
@("listen_addresses = '127.0.0.1'","port = $port","log_statement = 'none'","log_min_error_statement = 'panic'","log_error_verbosity = 'terse'")|Add-Content "$data/postgresql.conf"
Invoke-OwnedPg $ctl @('-D',$data,'-l',"$env:TD2_ROOT/school05-pg-runtime.log",'-w','start') 'start' 90
Invoke-OwnedPg $psql @('-X','-w','-h','127.0.0.1','-p',"$port",'-U','postgres','-d','postgres','-c','CREATE DATABASE school01a') 'createdb' 30
$files=@('school-workspace/local/tests/auth_fixture.sql')+@(Get-ChildItem 'school-workspace/local/supabase/migrations/*.sql'|Sort-Object Name|ForEach-Object FullName)+@('school-workspace/integration/sql/local-status.sql','school-workspace/school02/sql/extension.sql','school-workspace/school03/sql/extension.sql','school-workspace/school04/sql/extension.sql','school-workspace/local/tests/fixtures.sql','school-workspace/integration/sql/multi-school-fixture.sql','school-workspace/school02/sql/fixtures.sql','school-workspace/school03/sql/fixtures.sql')
$i=0
foreach($f in $files){$i++;Invoke-OwnedPg $psql @('-X','-w','-q','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',"$port",'-U','postgres','-d','school01a','-f',"$f") "fixture-$i" 30}
[ordered]@{verdict='PASS';version=(& $psql --version);host='127.0.0.1';port=$port;data=$data;fixtures=$files.Count;backend='native Windows PostgreSQL; synthetic Auth; existing SQL unchanged';operatingDbRequests=0}|ConvertTo-Json|Set-Content "$env:TD2_EVIDENCE_ROOT/school05-native-db.json"
