[CmdletBinding()] param()
$ErrorActionPreference='Stop'
$qaRoot=Split-Path -Parent $PSScriptRoot
$config=Get-Content -Raw (Join-Path $qaRoot 'supabase\config.toml')
if($config -notmatch 'project_id\s*=\s*"inventory_qa"' -or $config -match 'https://|supabase\.co|xxownwxxajzrviuvvfiu'){throw 'Local QA isolation guard failed.'}
$savedPreference=$ErrorActionPreference; $ErrorActionPreference='Continue'
$statusEnv=@(npx --yes --package=supabase@2.121.0 -- supabase --workdir $qaRoot status -o env 2>$null)
$ErrorActionPreference=$savedPreference
$entry=@($statusEnv|Where-Object{$_ -match '^ANON_KEY='})
if($entry.Count-ne 1){throw 'Local publishable key unavailable.'}; $anon=($entry[0]-split '=',2)[1].Trim('"')
$base='http://127.0.0.1:56321'; $authHeaders=@{apikey=$anon;Authorization="Bearer $anon"}
function New-Actor([string]$label){
  $email="im1b4a-$label-$([guid]::NewGuid().ToString('N'))@example.invalid"; $password=[guid]::NewGuid().ToString('N')+'!Aa1'
  $s=Invoke-RestMethod -Method Post -Uri "$base/auth/v1/signup" -Headers $authHeaders -ContentType 'application/json' -Body (@{email=$email;password=$password}|ConvertTo-Json)
  return @{Id=[string]$s.user.id;Token=[string]$s.access_token}
}
function Invoke-Rpc($token,$name,$body){Invoke-RestMethod -Method Post -Uri "$base/rest/v1/rpc/$name" -Headers @{apikey=$anon;Authorization="Bearer $token"} -ContentType 'application/json' -Body ($body|ConvertTo-Json)}
function Expect-Http($token,$name,$body,[int]$status,[string]$message){try{Invoke-Rpc $token $name $body|Out-Null;return $false}catch{return ([int]$_.Exception.Response.StatusCode-eq$status -and [string]$_.ErrorDetails.Message-match $message)}}
$teacher=New-Actor 'teacher'; $instructor=New-Actor 'instructor'; $inactive=New-Actor 'inactive'
$school='b4100000-0000-4000-8000-000000000001'; $other='b4100000-0000-4000-8000-000000000002'; $item='b4200000-0000-4000-8000-000000000001'
$seed=@"
insert into public.inventory_schools(school_id,display_name) values('$school','Synthetic HTTP A'),('$other','Synthetic HTTP B');
insert into public.inventory_members(school_id,user_id,role,is_active) values('$school','$($teacher.Id)','teacher_admin',true),('$school','$($instructor.Id)','instructor',true),('$school','$($inactive.Id)','teacher_admin',false);
insert into public.inventory_items(item_id,school_id,item_name,base_unit,purchase_unit,base_units_per_purchase_unit) values('$item','$school','Synthetic HTTP Admin Item','piece','box',10);
"@
$seed|docker exec -i supabase_db_inventory_qa psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
$receive=@{p_school_id=$school;p_item_id=$item;p_purchase_quantity=2;p_base_units_per_purchase_unit=10;p_received_at='2026-10-23T00:00:00Z';p_expires_on='2027-10-23';p_purchase_link_id=$null;p_request_uuid='b4900000-0000-4000-8000-000000000001';p_reason='Synthetic HTTP receive'}
$r=Invoke-Rpc $teacher.Token 'inventory_receive_stock' $receive
$lot=[string]$r.lot_id; $receiveMovement=[string]$r.movement_id
$dispose=Invoke-Rpc $teacher.Token 'inventory_dispose_stock' @{p_school_id=$school;p_item_id=$item;p_lot_id=$lot;p_quantity=2;p_request_uuid='b4900000-0000-4000-8000-000000000002';p_reason='Synthetic HTTP dispose'}
$adjust=Invoke-Rpc $teacher.Token 'inventory_adjust_stock' @{p_school_id=$school;p_item_id=$item;p_lot_id=$lot;p_expected_quantity=18;p_counted_quantity=19;p_request_uuid='b4900000-0000-4000-8000-000000000003';p_reason='Synthetic HTTP adjust'}
$reverse=Invoke-Rpc $teacher.Token 'inventory_reverse_movement' @{p_school_id=$school;p_original_movement_id=[string]$adjust.movement_id;p_request_uuid='b4900000-0000-4000-8000-000000000004';p_reason='Synthetic HTTP reverse'}
$use=Invoke-Rpc $instructor.Token 'inventory_use_stock' @{p_school_id=$school;p_item_id=$item;p_quantity=1;p_request_uuid='b4900000-0000-4000-8000-000000000009';p_reason='Synthetic HTTP use'}
$replay=Invoke-Rpc $teacher.Token 'inventory_receive_stock' $receive
$instructorReceive=$receive.Clone(); $instructorReceive.p_request_uuid='b4900000-0000-4000-8000-000000000005'
$instructorDenied=Expect-Http $instructor.Token 'inventory_receive_stock' $instructorReceive 403 'PERMISSION_DENIED'
$inactiveDenied=Expect-Http $inactive.Token 'inventory_dispose_stock' @{p_school_id=$school;p_item_id=$item;p_lot_id=$lot;p_quantity=1;p_request_uuid='b4900000-0000-4000-8000-000000000006';p_reason='Synthetic inactive'} 403 'PERMISSION_DENIED'
$crossDenied=Expect-Http $teacher.Token 'inventory_adjust_stock' @{p_school_id=$other;p_item_id=$item;p_lot_id=$lot;p_expected_quantity=18;p_counted_quantity=17;p_request_uuid='b4900000-0000-4000-8000-000000000007';p_reason='Synthetic cross tenant'} 403 'PERMISSION_DENIED'
$anonReceive=$receive.Clone(); $anonReceive.p_request_uuid='b4900000-0000-4000-8000-000000000008'
$anonDenied=Expect-Http $anon 'inventory_receive_stock' $anonReceive 401 'UNAUTHENTICATED|permission denied'
$required=@('request_uuid','operation','school_id','item_id','quantity_delta','item_total_quantity','item_available_quantity','movements','processed_at','replayed','status','reactivation_required')
$responses=@($r,$dispose,$adjust,$reverse,$use)
$dtoOk=$true
foreach($response in $responses){if(@($required|Where-Object{$response.PSObject.Properties.Name -notcontains $_}).Count -ne 0){$dtoOk=$false}}
$operations=@($r.operation,$dispose.operation,$adjust.operation,$reverse.operation,$use.operation) -join ','
$replayStable=$replay.status-eq'replayed'-and$replay.item_total_quantity-eq$r.item_total_quantity-and$replay.item_available_quantity-eq$r.item_available_quantity-and(($replay.movements|ConvertTo-Json -Compress)-eq($r.movements|ConvertTo-Json -Compress))
$passed=$dtoOk-and$r.status-eq'applied'-and$replayStable-and$instructorDenied-and$inactiveDenied-and$crossDenied-and$anonDenied-and$operations-eq'RECEIVE,DISPOSE,ADJUST,REVERSAL,USE'
if(-not $passed){throw "IM-1B-4A HTTP E2E assertion failed: dto=$dtoOk operations=$operations replayStable=$replayStable"}
[pscustomobject]@{suite='IM-1B-4A-http';status='PASS';rpcCalls=6;dto=$dtoOk;operations=$operations;replayStable=$replayStable;instructorDenied=$instructorDenied;inactiveDenied=$inactiveDenied;crossTenantDenied=$crossDenied;anonDenied=$anonDenied}
$anon=$null; $teacher.Token=$null; $instructor.Token=$null; $inactive.Token=$null
