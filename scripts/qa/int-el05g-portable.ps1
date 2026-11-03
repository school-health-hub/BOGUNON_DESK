param([Parameter(Mandatory=$true)][string]$InputDirectory,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
$sourceSha='c06ce6a910002cc7658a5545e23e0d3ed914d377'
$expectedHash='b486402d625a968dab32b12534e0aa97d722781d478e37d4c1735e2938a992a0'
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$OutputDirectory=[IO.Path]::GetFullPath($OutputDirectory)
$report=@{sourceSha=$sourceSha;qaSha=$env:GITHUB_SHA;sourceRun=41573621249;sourceArtifact=13203310491;newBuild=$false;phases=@();verdict='BLOCKED';physicalDpi='NOT RUN';fullFeatureQa='NOT RUN'}
$runRoot=Join-Path $env:RUNNER_TEMP ('int-el05g-'+[guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force $runRoot | Out-Null
$script:owned=[Collections.Generic.HashSet[int]]::new()
function Hash([string]$Path){(Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Record([string]$Message){$line="$(Get-Date -Format o) $Message";$line | Add-Content (Join-Path $OutputDirectory 'events.log');Write-Host $line}
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class GWindow { public long Handle; public int Pid; public string Title; public bool Visible; public int X,Y,Width,Height; }
public static class GNative {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
 public delegate bool Callback(IntPtr h,IntPtr l);
 [DllImport("user32.dll")] static extern bool EnumWindows(Callback c,IntPtr l);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int w,int z,uint f);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr h,uint m,IntPtr w,IntPtr l,uint f,uint t,out IntPtr result);
 [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 public static GWindow[] Windows(){var result=new List<GWindow>();EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);var s=new StringBuilder(1024);GetWindowText(h,s,1024);RECT r;GetWindowRect(h,out r);result.Add(new GWindow{Handle=h.ToInt64(),Pid=(int)p,Title=s.ToString(),Visible=IsWindowVisible(h),X=r.Left,Y=r.Top,Width=r.Right-r.Left,Height=r.Bottom-r.Top});return true;},IntPtr.Zero);return result.ToArray();}
}
'@
[void][GNative]::SetThreadDpiAwarenessContext([IntPtr](-4))
Add-Type -AssemblyName System.Drawing
function Processes {
 $all=@(Get-CimInstance Win32_Process)
 # Only this job's private extracted paths or descendants of the directly started PID.
 for($pass=0;$pass -lt 4;$pass++){
  foreach($p in $all){
   $private=$p.ExecutablePath -and $p.ExecutablePath.StartsWith($runRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)
   if($private -or $script:owned.Contains([int]$p.ParentProcessId)){[void]$script:owned.Add([int]$p.ProcessId)}
  }
 }
 @($all | Where-Object {$script:owned.Contains([int]$_.ProcessId) -and $_.ExecutablePath -and ($_.ExecutablePath -eq $script:exe -or $_.ExecutablePath.StartsWith($runRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase))} | ForEach-Object {@{pid=[int]$_.ProcessId;parentPid=[int]$_.ParentProcessId;path=$_.ExecutablePath;name=$_.Name;created=[string]$_.CreationDate;commandLine=$_.CommandLine}})
}
function Capture([IntPtr]$Handle,[string]$Name){
 $rect=[GNative+RECT]::new();[void][GNative]::GetWindowRect($Handle,[ref]$rect)
 $w=$rect.Right-$rect.Left;$h=$rect.Bottom-$rect.Top
 if($w -le 0 -or $h -le 0){return @{valid=$false;reason='No drawable window rectangle'}}
 $bmp=[Drawing.Bitmap]::new($w,$h);$graphics=[Drawing.Graphics]::FromImage($bmp)
 try{
  $dc=$graphics.GetHdc();try{$printed=[GNative]::PrintWindow($Handle,$dc,2)}finally{$graphics.ReleaseHdc($dc)}
  $colors=[Collections.Generic.HashSet[int]]::new();$nonblack=0;$samples=0
  for($y=80;$y -lt $h-20;$y+=8){for($x=20;$x -lt $w-20;$x+=8){$pixel=$bmp.GetPixel($x,$y);[void]$colors.Add($pixel.ToArgb());$samples++;if(($pixel.R+$pixel.G+$pixel.B) -gt 30){$nonblack++}}}
  $valid=$printed -and $samples -gt 0 -and $colors.Count -ge 8 -and $nonblack/$samples -gt 0.5
  $prefix=if($valid){''}else{'invalid-'};$file=$prefix+$Name+'.png';$path=Join-Path $OutputDirectory $file;$bmp.Save($path,[Drawing.Imaging.ImageFormat]::Png)
  return @{file=$file;sha256=(Hash $path);valid=[bool]$valid;method='Win32 PrintWindow';colors=$colors.Count;note='Pixel-quality heuristic only; not a visual design approval';width=$w;height=$h}
 }finally{$graphics.Dispose();$bmp.Dispose()}
}
function Phase([string]$Name,[string[]]$LaunchArgs){
 $state=@{name=$Name;args=$LaunchArgs;status='BLOCKED';requestTime=(Get-Date -Format o);processSnapshots=@();captures=@();gracefulClose='NOT RUN'}
 $report.phases+=,$state
 $temp=Join-Path $runRoot $Name;New-Item -ItemType Directory -Force $temp | Out-Null
 $testProfile=[guid]::NewGuid().ToString();$watch=[Diagnostics.Stopwatch]::StartNew()
 $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$script:exe;$start.WorkingDirectory=[IO.Path]::GetDirectoryName($script:exe);$start.UseShellExecute=$false;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
 foreach($arg in $LaunchArgs){[void]$start.ArgumentList.Add($arg)}
 $start.Environment['TEMP']=$temp;$start.Environment['TMP']=$temp;$start.Environment['ELECTRON_P0_TEST_RUN']=$testProfile;$start.Environment['ELECTRON_P0_DEV_URL']='';$start.Environment['INVENTORY_LOCAL_QA']=''
 $process=[Diagnostics.Process]::Start($start);[void]$script:owned.Add($process.Id)
 $state.directPid=$process.Id;$state.directPidMeaning='Direct CreateProcess result for verified Portable, no shell wrapper';$state.profile=$testProfile;$state.privateTemp=$temp
 $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync();$window=$null;$state.observations=@{}
 Record "$Name direct PID=$($process.Id)"
 while($watch.Elapsed.TotalSeconds -lt 90){
  $rows=@(Processes);$windows=@([GNative]::Windows() | Where-Object {$script:owned.Contains($_.Pid)})
  $state.processSnapshots+=,@{ms=$watch.ElapsedMilliseconds;processes=$rows;windows=$windows}
  if(@($rows | Where-Object {$_.pid -ne $process.Id -and $_.path -and $_.path.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase)}).Count -gt 0 -and -not $state.observations.ContainsKey('firstChildMs')){$state.observations.firstChildMs=$watch.ElapsedMilliseconds}
  $dirs=@(Get-ChildItem -LiteralPath $temp -Directory -ErrorAction SilentlyContinue)
  if($dirs.Count -gt 0 -and -not $state.observations.ContainsKey('firstDirectoryMs')){$state.observations.firstDirectoryMs=$watch.ElapsedMilliseconds}
  foreach($dir in $dirs){if(Test-Path (Join-Path $dir.FullName 'resources/app.asar')){if(-not $state.observations.ContainsKey('firstAsarMs')){$state.observations.firstAsarMs=$watch.ElapsedMilliseconds}}}
  $window=$windows | Where-Object {$_.Visible -and $_.Pid -ne $process.Id -and $_.Title -like '*BOGUNON*' -and $_.Width -gt 300} | Sort-Object {-$_.Width*$_.Height} | Select-Object -First 1
  if($window){$state.observations.visibleWindowMs=$watch.ElapsedMilliseconds;break}
  if($process.HasExited -and $rows.Count -eq 0){break}
  Start-Sleep -Milliseconds 250
 }
 if(-not $window){$state.status='FAIL';$state.reason='No verified application window observed';$state.launcherExited=$process.HasExited;if($process.HasExited){$state.launcherExitCode=$process.ExitCode};return $state}
 $state.window=$window;$handle=[IntPtr]$window.Handle
 $child=@(Processes) | Where-Object {$_.pid -eq $window.Pid} | Select-Object -First 1
 if(-not $child.path -or -not $child.path.StartsWith($temp.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Window process is not in the owned Portable extraction directory'}
 $asar=Join-Path ([IO.Path]::GetDirectoryName($child.path)) 'resources/app.asar'
 $state.actualApp=$child;$state.actualAppSha256=Hash $child.path;$state.asarPath=$asar;$state.asarSha256=Hash $asar
 if($state.actualAppSha256 -ne $script:manifest.packagedApplication.sha256 -or $state.asarSha256 -ne $script:manifest.asar.sha256){throw 'Extracted application identity mismatch'}
 $result=[IntPtr]::Zero;$responsive=[GNative]::SendMessageTimeout($handle,0,[IntPtr]::Zero,[IntPtr]::Zero,2,2000,[ref]$result) -ne [IntPtr]::Zero
 $state.responding=$responsive;$state.runnerWindowDpi=[GNative]::GetDpiForWindow($handle);$state.captures+=,(Capture $handle "$Name-initial")
 try{
  Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
  $root=[Windows.Automation.AutomationElement]::FromHandle($handle);$elements=$root.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)
  $names=@();for($i=0;$i -lt [Math]::Min($elements.Count,300);$i++){if($elements.Item($i).Current.Name){$names+=$elements.Item($i).Current.Name}}
  $state.accessibleNames=$names;$state.dockObserved=($names -contains '주요 기능' -or ($names -contains '업무 도구' -and $names -contains '설정'));$state.koreanObserved=(@($names | Where-Object {$_ -match '[가-힣]'}).Count -gt 0)
 }catch{$state.accessibility='UNVERIFIED: '+$_.Exception.Message}
 [void][GNative]::SetWindowPos($handle,[IntPtr]::Zero,40,40,980,700,0x14);Start-Sleep -Milliseconds 500
 $rect=[GNative+RECT]::new();$client=[GNative+RECT]::new();[void][GNative]::GetWindowRect($handle,[ref]$rect);[void][GNative]::GetClientRect($handle,[ref]$client)
 $state.resize=@{requestedOuter=@{width=980;height=700};actualOuter=@{width=$rect.Right-$rect.Left;height=$rect.Bottom-$rect.Top};client=@{width=$client.Right-$client.Left;height=$client.Bottom-$client.Top}}
 $state.captures+=,(Capture $handle "$Name-980x700")
 $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.OwningProcess -eq $window.Pid} | Select-Object LocalAddress,LocalPort,OwningProcess);$state.listeners=$listeners
 if($Name -eq 'endpoint'){
  $port=[int]$LaunchArgs[0].Split('=')[1];$bound=@($listeners | Where-Object {$_.LocalPort -eq $port})
  if(@($bound | Where-Object {$_.LocalAddress -notin @('127.0.0.1','::1')}).Count -gt 0){throw 'Debug listener is not loopback-only'}
  if($bound.Count -eq 0){$state.endpoint=@{reachable=$false;ownerVerified=$false;reason='No owned loopback listener'}}else{try{
   $version=Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 3 -MaximumRedirection 0
   $targets=Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/list" -TimeoutSec 3 -MaximumRedirection 0
   $state.endpoint=@{reachable=$true;version=$version;targets=$targets;ownerVerified=(@($bound | Where-Object {$_.OwningProcess -eq $window.Pid}).Count -gt 0)}
  }catch{$state.endpoint=@{reachable=$false;error=$_.Exception.Message}}}
  $inspectArg=$LaunchArgs | Where-Object {$_ -like '--inspect=*'} | Select-Object -First 1
  if($inspectArg){
   $nodePort=[int]$inspectArg.Split(':')[-1];$nodeBound=@($listeners | Where-Object {$_.LocalPort -eq $nodePort})
   if(@($nodeBound | Where-Object {$_.LocalAddress -notin @('127.0.0.1','::1')}).Count -gt 0){throw 'Node inspector is not loopback-only'}
   if($nodeBound.Count -gt 0){try{$state.nodeInspector=@{reachable=$true;ownerVerified=$true;targets=(Invoke-RestMethod -Uri "http://127.0.0.1:$nodePort/json/list" -TimeoutSec 3 -MaximumRedirection 0)}}catch{$state.nodeInspector=@{reachable=$false;error=$_.Exception.Message}}}else{$state.nodeInspector=@{reachable=$false;ownerVerified=$false}}
  }
 }
 $state.closeRequested=(Get-Date -Format o);[void][GNative]::PostMessage($handle,0x10,[IntPtr]::Zero,[IntPtr]::Zero)
 $until=[DateTime]::UtcNow.AddSeconds(30)
 do{Start-Sleep -Milliseconds 250;$remaining=@(Processes)}while($remaining.Count -gt 0 -and [DateTime]::UtcNow -lt $until)
 $state.remaining=$remaining;$state.windowClosed=(-not [GNative]::IsWindow($handle));$state.launcherExited=$process.HasExited
 if($process.HasExited){$state.launcherExitCode=$process.ExitCode}
 $state.extractionCleaned=(-not (Test-Path ([IO.Path]::GetDirectoryName($child.path))));$state.remainingTempEntries=@(Get-ChildItem -LiteralPath $temp -Force | Select-Object Name,Mode);$state.gracefulClose=if($remaining.Count -eq 0 -and $state.windowClosed -and $process.HasExited){'PASS'}else{'FAIL'}
 if($stdout.Wait(1000)){$stdout.Result | Set-Content (Join-Path $OutputDirectory "$Name-stdout.log")}
 if($stderr.Wait(1000)){$stderr.Result | Set-Content (Join-Path $OutputDirectory "$Name-stderr.log");$state.stderrHasNodeEndpoint=($stderr.Result -match 'Debugger listening');$state.stderrHasChromeEndpoint=($stderr.Result -match 'DevTools listening')}
 $state.status=if($responsive -and $state.gracefulClose -eq 'PASS' -and $state.launcherExitCode -eq 0){'PASS'}else{'FAIL'}
 Record "$Name window=$($window.Title) child=$($window.Pid) status=$($state.status)"
 return $state
}
try{
 $manifests=@(Get-ChildItem -LiteralPath $InputDirectory -Recurse -File -Filter INT-EL-05E-MANIFEST.json)
 if($manifests.Count -ne 1){throw 'Expected exactly one original manifest'}
 $script:manifest=Get-Content $manifests[0].FullName -Raw | ConvertFrom-Json
 if($script:manifest.productSourceSha -ne $sourceSha -or $script:manifest.metadata.sourceSha -ne $sourceSha -or $script:manifest.metadata.dirty -ne $false){throw 'Original product metadata mismatch'}
 $exeFiles=@(Get-ChildItem -LiteralPath $InputDirectory -Recurse -File | Where-Object {$_.Name -eq $script:manifest.portable.file})
 if($exeFiles.Count -ne 1){throw 'Expected exactly one original Portable'}
 $script:exe=$exeFiles[0].FullName;$actual=Hash $script:exe
 if($actual -ne $expectedHash -or $script:manifest.portable.sha256 -ne $expectedHash){throw 'Original Portable hash mismatch'}
 $report.reused=@{file=$script:exe;sha256=$actual;signature=[string](Get-AuthenticodeSignature $script:exe).Status;sourceManifest=$script:manifest}
 $plain=Phase 'plain' @()
 if($plain.status -eq 'PASS'){
  $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$nodeListener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$listener.Start();$nodeListener.Start();$port=([Net.IPEndPoint]$listener.LocalEndpoint).Port;$nodePort=([Net.IPEndPoint]$nodeListener.LocalEndpoint).Port;$listener.Stop();$nodeListener.Stop()
  $debug=Phase 'endpoint' @("--remote-debugging-port=$port",'--remote-debugging-address=127.0.0.1',"--inspect=127.0.0.1:$nodePort")
  $visual=$plain.dockObserved -and $plain.koreanObserved -and $plain.resize.actualOuter.width -eq 980 -and $plain.resize.actualOuter.height -eq 700 -and @($plain.captures | Where-Object {-not $_.valid}).Count -eq 0
  $report.verdict=if($debug.status -eq 'PASS' -and $debug.endpoint.reachable -and $debug.endpoint.ownerVerified -and $plain.extractionCleaned -and $visual){'PASS'}else{'CONDITIONAL'}
 }else{$report.verdict='BLOCKED'}
}catch{$report.failure=$_.Exception.Message;Record $report.failure}
finally{
 $remaining=@(Processes);$report.forcedCleanup=$false
 if($remaining.Count -gt 0){$report.forcedCleanup=$true;$report.verdict='BLOCKED';foreach($p in $remaining){$now=Get-CimInstance Win32_Process -Filter "ProcessId=$($p.pid)" -ErrorAction SilentlyContinue;if($now -and $now.ExecutablePath -eq $p.path -and [string]$now.CreationDate -eq $p.created){Stop-Process -Id $p.pid -Force -ErrorAction Continue}}}
 $report.remainingBeforeCleanup=$remaining;$report.remainingAfterCleanup=@(Processes)
 $report | ConvertTo-Json -Depth 30 | Set-Content (Join-Path $OutputDirectory 'diagnostic.json') -Encoding utf8
 $summary=@{verdict=$report.verdict;exeHash=$report.reused.sha256;forcedCleanup=$report.forcedCleanup;remaining=$report.remainingAfterCleanup.Count;phases=@($report.phases | ForEach-Object {@{name=$_.name;status=$_.status;window=$_.window;actualApp=$_.actualApp;hash=$_.actualAppSha256;asar=$_.asarSha256;resize=$_.resize;responding=$_.responding;dockObserved=$_.dockObserved;koreanObserved=$_.koreanObserved;gracefulClose=$_.gracefulClose;extractionCleaned=$_.extractionCleaned;observations=$_.observations;endpoint=$_.endpoint;nodeInspector=$_.nodeInspector;stderrHasNodeEndpoint=$_.stderrHasNodeEndpoint;stderrHasChromeEndpoint=$_.stderrHasChromeEndpoint;captures=$_.captures}})}
 Write-Output "::notice title=INT_EL05G_DIAGNOSTIC::$($summary | ConvertTo-Json -Depth 20 -Compress)"
}
if($report.verdict -eq 'BLOCKED'){exit 1}
