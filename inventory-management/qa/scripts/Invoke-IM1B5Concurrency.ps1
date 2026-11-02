[CmdletBinding()] param()
$ErrorActionPreference='Stop';$qaRoot=Split-Path -Parent $PSScriptRoot;$config=Get-Content -Raw (Join-Path $qaRoot 'supabase\config.toml');if($config -notmatch 'project_id\s*=\s*"inventory_qa"' -or $config -match 'https://|supabase\.co|xxownwxxajzrviuvvfiu'){throw 'Local QA isolation guard failed.'}
function Psql($sql){$o=@($sql|docker exec -i supabase_db_inventory_qa psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres);if($LASTEXITCODE-ne0){throw'psql failed'};$o}
$seed=@"
insert into auth.users(id,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,aud,role) values
('d5000000-0000-4000-8000-000000000001','race1@example.invalid','',now(),now(),now(),'{}','{}','authenticated','authenticated'),('d5000000-0000-4000-8000-000000000002','race2@example.invalid','',now(),now(),now(),'{}','{}','authenticated','authenticated');
insert into public.inventory_schools(school_id,display_name) values('d5100000-0000-4000-8000-000000000001','Synthetic Race');
insert into public.inventory_members(school_id,user_id,role) values('d5100000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','teacher_admin'),('d5100000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000002','teacher_admin');
insert into public.inventory_items(item_id,school_id,item_name,base_unit,purchase_unit,base_units_per_purchase_unit) values('d5200000-0000-4000-8000-000000000001','d5100000-0000-4000-8000-000000000001','Synthetic Race Item','piece','box',1);
select set_config('request.jwt.claims','{"sub":"d5000000-0000-4000-8000-000000000001","role":"authenticated"}',false);set role authenticated;
select public.inventory_create_purchase_batch('d5100000-0000-4000-8000-000000000001','d5300000-0000-4000-8000-000000000001','d5900000-0000-4000-8000-000000000001','race',jsonb_build_array(jsonb_build_object('candidate_id','race','item_id','d5200000-0000-4000-8000-000000000001','requested_purchase_quantity',10,'base_unit','piece','purchase_unit','box','base_units_per_purchase_unit',1,'specification_snapshot','synthetic','expected_unit_price',null,'currency',null)));
select public.inventory_set_purchase_batch_status('d5100000-0000-4000-8000-000000000001','d5300000-0000-4000-8000-000000000001','APPROVED','d5900000-0000-4000-8000-000000000002','approve');
select public.inventory_set_purchase_batch_status('d5100000-0000-4000-8000-000000000001','d5300000-0000-4000-8000-000000000001','ORDERED','d5900000-0000-4000-8000-000000000003','order');
select public.inventory_set_purchase_batch_status('d5100000-0000-4000-8000-000000000001','d5300000-0000-4000-8000-000000000001','AWAITING_RECEIPT','d5900000-0000-4000-8000-000000000004','await');reset role;
create table public.qa_im1b5_race(actor uuid,outcome text,error text);
"@;Psql $seed|Out-Null
$line=[string]((Psql "select line_id from public.inventory_purchase_lines where batch_id='d5300000-0000-4000-8000-000000000001';")|Select-Object -Last 1)
function Worker($actor,$receipt,$request){@"
select set_config('request.jwt.claims','{"sub":"$actor","role":"authenticated"}',false);
do `$`$ begin begin perform public.inventory_confirm_receipt('d5100000-0000-4000-8000-000000000001','d5300000-0000-4000-8000-000000000001','$receipt','$request',now(),'race receipt',jsonb_build_array(jsonb_build_object('line_id','$line','received_purchase_quantity',6,'expires_on',null)));insert into public.qa_im1b5_race values('$actor','SUCCESS',null);exception when others then insert into public.qa_im1b5_race values('$actor','ERROR',sqlerrm);end;end;`$`$;
"@}
function StartWorker($sql){$s=[Diagnostics.ProcessStartInfo]::new();$s.FileName='docker';$s.Arguments='exec -i supabase_db_inventory_qa psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres';$s.UseShellExecute=$false;$s.RedirectStandardInput=$true;$s.RedirectStandardOutput=$true;$s.RedirectStandardError=$true;$s.CreateNoWindow=$true;$p=[Diagnostics.Process]::new();$p.StartInfo=$s;$p.Start()|Out-Null;$p.StandardInput.WriteLine($sql);$p.StandardInput.Close();$p}
$before=[long]((Psql "select deadlocks from pg_stat_database where datname=current_database();")|Select-Object -Last 1)
$sql1=Worker 'd5000000-0000-4000-8000-000000000001' 'd5400000-0000-4000-8000-000000000001' 'd5900000-0000-4000-8000-000000000010'
$sql2=Worker 'd5000000-0000-4000-8000-000000000002' 'd5400000-0000-4000-8000-000000000002' 'd5900000-0000-4000-8000-000000000011'
$ps=@((StartWorker $sql1),(StartWorker $sql2))
foreach($p in $ps){if(-not $p.WaitForExit(30000)){$p.Kill();throw'worker timeout'};if($p.ExitCode-ne0){throw("worker failed "+$p.StandardError.ReadToEnd())};$p.Dispose()}
$success=[int]((Psql "select count(*) from public.qa_im1b5_race where outcome='SUCCESS';")|Select-Object -Last 1);$errors=[int]((Psql "select count(*) from public.qa_im1b5_race where outcome='ERROR' and error='PURCHASE_RECEIPT_EXCEEDS_REQUESTED';")|Select-Object -Last 1);$received=[long]((Psql "select received_base_quantity from public.inventory_purchase_lines where batch_id='d5300000-0000-4000-8000-000000000001';")|Select-Object -Last 1);$movements=[int]((Psql "select count(*) from public.inventory_purchase_receipt_lines where batch_id='d5300000-0000-4000-8000-000000000001';")|Select-Object -Last 1);$after=[long]((Psql "select deadlocks from pg_stat_database where datname=current_database();")|Select-Object -Last 1)
if($success -ne 1 -or $errors -ne 1 -or $received -ne 6 -or $movements -ne 1 -or $after -ne $before){throw "IM-1B-5 concurrency failed success=$success errors=$errors received=$received movements=$movements deadlocks=$($after-$before)"}
Psql "drop table public.qa_im1b5_race;"|Out-Null
[pscustomobject]@{suite='IM-1B-5-concurrency';status='PASS';success=$success;rejectedOverReceipt=$errors;receivedBaseQuantity=$received;receiptLines=$movements;deadlocks=$after-$before}
