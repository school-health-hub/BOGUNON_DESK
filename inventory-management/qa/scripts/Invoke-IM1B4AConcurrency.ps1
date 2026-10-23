[CmdletBinding()] param()
$ErrorActionPreference='Stop'
$qaRoot=Split-Path -Parent $PSScriptRoot; $config=Get-Content -Raw (Join-Path $qaRoot 'supabase\config.toml')
if($config-notmatch 'project_id\s*=\s*"inventory_qa"'-or$config-match'https://|supabase\.co|xxownwxxajzrviuvvfiu'){throw'Isolation guard failed.'}
function Sql([string]$q){$o=@($q|docker exec -i supabase_db_inventory_qa psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres);if($LASTEXITCODE){throw'psql failed'};$o}
function Worker([string]$q){$p=[Diagnostics.Process]::new();$p.StartInfo.FileName='docker';$p.StartInfo.Arguments='exec -i supabase_db_inventory_qa psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres';$p.StartInfo.UseShellExecute=$false;$p.StartInfo.RedirectStandardInput=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true;$p.StartInfo.CreateNoWindow=$true;[void]$p.Start();$p.StandardInput.WriteLine($q);$p.StandardInput.Close();$p}
$actor='c4000000-0000-4000-8000-000000000001';$school='c4100000-0000-4000-8000-000000000001'
$seed=@"
insert into auth.users(id,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,aud,role) values('$actor','concurrency-im1b4a@example.invalid','',now(),now(),now(),'{}','{}','authenticated','authenticated');
insert into public.inventory_schools(school_id,display_name) values('$school','Synthetic Concurrency');
insert into public.inventory_members(school_id,user_id,role) values('$school','$actor','teacher_admin');
do `$`$ begin for i in 1..8 loop insert into public.inventory_items(item_id,school_id,item_name,base_unit,purchase_unit,base_units_per_purchase_unit) values(('c4200000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'$school','Synthetic Concurrent '||i,'unit','unit',1); insert into public.inventory_stock_lots(lot_id,school_id,item_id,received_at,expires_on,initial_quantity,remaining_quantity,status) values(('c4300000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'$school',('c4200000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,now(),current_date+365,10,10,'available'); end loop; end `$`$;
"@;Sql $seed|Out-Null
$claim="select set_config('request.jwt.claims','{`"sub`":`"$actor`",`"role`":`"authenticated`"}',false);set role authenticated;"
function Call([string]$body){return $claim+$body}
$original4=((Sql ($claim+"select public.inventory_adjust_stock('$school','c4200000-0000-4000-8000-000000000004','c4300000-0000-4000-8000-000000000004',10,12,'c4900000-0000-4000-8000-000000000007','setup');")|Select-Object -Last 1)|ConvertFrom-Json).movement_id
$original8=((Sql ($claim+"select public.inventory_adjust_stock('$school','c4200000-0000-4000-8000-000000000008','c4300000-0000-4000-8000-000000000008',10,12,'c4900000-0000-4000-8000-000000000015','setup');")|Select-Object -Last 1)|ConvertFrom-Json).movement_id
$pairs=@(
 @((Call "perform public.inventory_receive_stock('$school','c4200000-0000-4000-8000-000000000001',10,1,now(),null,null,'c4900000-0000-4000-8000-000000000001','race');"),(Call "perform public.inventory_use_stock('$school','c4200000-0000-4000-8000-000000000001',5,'c4900000-0000-4000-8000-000000000002','race');")),
 @((Call "perform public.inventory_dispose_stock('$school','c4200000-0000-4000-8000-000000000002','c4300000-0000-4000-8000-000000000002',6,'c4900000-0000-4000-8000-000000000003','race');"),(Call "perform public.inventory_use_stock('$school','c4200000-0000-4000-8000-000000000002',6,'c4900000-0000-4000-8000-000000000004','race');")),
 @((Call "perform public.inventory_adjust_stock('$school','c4200000-0000-4000-8000-000000000003','c4300000-0000-4000-8000-000000000003',10,8,'c4900000-0000-4000-8000-000000000005','race');"),(Call "perform public.inventory_use_stock('$school','c4200000-0000-4000-8000-000000000003',1,'c4900000-0000-4000-8000-000000000006','race');")),
 @((Call "perform public.inventory_reverse_movement('$school','$original4','c4900000-0000-4000-8000-000000000008','race');"),(Call "perform public.inventory_use_stock('$school','c4200000-0000-4000-8000-000000000004',1,'c4900000-0000-4000-8000-000000000009','race');")),
 @((Call "perform public.inventory_receive_stock('$school','c4200000-0000-4000-8000-000000000005',2,1,now(),null,null,'c4900000-0000-4000-8000-000000000019','race');"),(Call "perform public.inventory_receive_stock('$school','c4200000-0000-4000-8000-000000000005',3,1,now(),null,null,'c4900000-0000-4000-8000-000000000010','race');")),
 @((Call "perform public.inventory_dispose_stock('$school','c4200000-0000-4000-8000-000000000006','c4300000-0000-4000-8000-000000000006',6,'c4900000-0000-4000-8000-000000000011','race');"),(Call "perform public.inventory_dispose_stock('$school','c4200000-0000-4000-8000-000000000006','c4300000-0000-4000-8000-000000000006',6,'c4900000-0000-4000-8000-000000000012','race');")),
 @((Call "perform public.inventory_adjust_stock('$school','c4200000-0000-4000-8000-000000000007','c4300000-0000-4000-8000-000000000007',10,8,'c4900000-0000-4000-8000-000000000013','race');"),(Call "perform public.inventory_adjust_stock('$school','c4200000-0000-4000-8000-000000000007','c4300000-0000-4000-8000-000000000007',10,7,'c4900000-0000-4000-8000-000000000014','race');")),
 @((Call "perform public.inventory_reverse_movement('$school','$original8','c4900000-0000-4000-8000-000000000016','race');"),(Call "perform public.inventory_reverse_movement('$school','$original8','c4900000-0000-4000-8000-000000000017','race');"))
)
$pairs=@($pairs|ForEach-Object{,@($_|ForEach-Object{$_.Replace('perform public.','select public.')} )})
$expect=@(
 @{Min=2;Max=2;States=@(15)},@{Min=1;Max=1;States=@(4)},@{Min=1;Max=2;States=@(7,9)},@{Min=1;Max=2;States=@(9,11)},
 @{Min=2;Max=2;States=@(15)},@{Min=1;Max=1;States=@(4)},@{Min=1;Max=1;States=@(7,8)},@{Min=1;Max=1;States=@(10)}
)
$allowedErrors='INSUFFICIENT_STOCK|STALE_STOCK_STATE|MOVEMENT_NOT_REVERSIBLE|MOVEMENT_ALREADY_REVERSED|P0001'
$deadBefore=[long](Sql 'select deadlocks from pg_stat_database where datname=current_database();'|Select-Object -Last 1)
$results=@()
for($i=0;$i-lt$pairs.Count;$i++){
  $beforeMoves=[long](Sql "select count(*) from public.inventory_stock_movements where school_id='$school';"|Select-Object -Last 1)
  $beforeAudits=[long](Sql "select count(*) from public.inventory_audit where school_id='$school';"|Select-Object -Last 1)
  $ps=@((Worker $pairs[$i][0]),(Worker $pairs[$i][1]));$success=0;$errors=@()
  foreach($p in $ps){if(-not $p.WaitForExit(30000)){$p.Kill();throw 'worker timeout'};$stderr=$p.StandardError.ReadToEnd();if($p.ExitCode -eq 0){$success++}else{$errors+=$stderr;if($stderr -notmatch $allowedErrors){throw "Unexpected worker failure: $stderr"}};$p.Dispose()}
  $item=('c4200000-0000-4000-8000-' + ($i+1).ToString().PadLeft(12,'0'))
  $state=[long](Sql "select coalesce(sum(remaining_quantity),0) from public.inventory_stock_lots where school_id='$school' and item_id='$item';"|Select-Object -Last 1)
  $afterMoves=[long](Sql "select count(*) from public.inventory_stock_movements where school_id='$school';"|Select-Object -Last 1)
  $afterAudits=[long](Sql "select count(*) from public.inventory_audit where school_id='$school';"|Select-Object -Last 1)
  if($success -lt $expect[$i].Min -or $success -gt $expect[$i].Max -or $expect[$i].States -notcontains $state){throw "Pair $($i+1) invalid success/state: $success/$state"}
  if(($afterMoves-$beforeMoves)-ne$success-or($afterAudits-$beforeAudits)-ne$success){throw"Pair $($i+1) ledger/audit mismatch"}
  $results+=[pscustomobject]@{pair=$i+1;success=$success;rejected=2-$success;finalQuantity=$state;movements=$afterMoves-$beforeMoves;audits=$afterAudits-$beforeAudits}
}
$deadAfter=[long](Sql 'select deadlocks from pg_stat_database where datname=current_database();'|Select-Object -Last 1)
if($deadAfter-ne$deadBefore){throw'Deadlock observed'}
[pscustomobject]@{suite='IM-1B-4A-mixed-concurrency';status='PASS';executedPairs=$pairs.Count;deadlocks=0;results=$results}
