param(
 [ValidateSet('discover','list','observe','input','accept','cancel','open','save','review','source-confirm','purchase-review','save-existing','deny')][string]$Action='observe',
 [Parameter(Mandatory=$true)][int]$LauncherPid,
 [Parameter(Mandatory=$true)][string]$QaRoot,
 [string]$FilePath='',
 [string]$Evidence='dialog',
 [string]$ExpectedFileHash='',
 [ValidateSet('value','keys')][string]$InputMode='keys',
 [string]$ExpectedTitle='',
 [Parameter(Mandatory=$true)][string]$ExpectedLauncher,
 [Parameter(Mandatory=$true)][string]$AllowedQaParent,
 [int]$CdpPort=15448
)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
function Hash-File([string]$Path){
 $stream=[IO.File]::OpenRead($Path);$hasher=[Security.Cryptography.SHA256]::Create()
 try{return [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-','')}finally{$stream.Dispose();$hasher.Dispose()}
}
function Verify-Output([string]$Path,[string]$Expected){
 if(Test-Path -LiteralPath $Path){
  if($Expected -notmatch '^[a-fA-F0-9]{64}$' -or (Hash-File $Path) -ne $Expected){throw 'Existing output hash mismatch or approval missing'}
 }elseif($Expected){throw 'Expected existing output missing'}
}
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NativeQaWindow {
 [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
}
'@
$base=[IO.Path]::GetFullPath($QaRoot).TrimEnd('\')
$parent=[IO.Path]::GetFullPath($AllowedQaParent).TrimEnd('\'); if(-not $base.StartsWith($parent+'\',[StringComparison]::OrdinalIgnoreCase) -or -not $base.StartsWith('E:\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected QA root'}
if($Evidence -notmatch '^[a-z0-9-]+$'){throw 'Invalid evidence name'}
$launcher=Get-CimInstance Win32_Process -Filter "ProcessId=$LauncherPid"
if(-not $launcher -or $launcher.ExecutablePath -ne [IO.Path]::GetFullPath($ExpectedLauncher)){throw 'Launcher ownership mismatch'}
$mains=@(Get-CimInstance Win32_Process -Filter "ParentProcessId=$LauncherPid" | Where-Object {$_.Name -eq 'BOGUNON DESK.exe' -and $_.ExecutablePath.StartsWith($base+'\temp\',[StringComparison]::OrdinalIgnoreCase)})
if($mains.Count -ne 1){throw "Expected one owned main process; found $($mains.Count)"}
$main=$mains[0]; $mainPid=[int]$main.ProcessId
if($Action -eq 'discover'){
 $ports=@(Get-NetTCPConnection -LocalPort $CdpPort -State Listen -ErrorAction SilentlyContinue)
 if($ports.Count -ne 1 -or $ports[0].LocalAddress -ne '127.0.0.1' -or $ports[0].OwningProcess -ne $mainPid){throw 'CDP port owner mismatch'}
 @{mainPid=$mainPid;launcherPid=$LauncherPid;path=$main.ExecutablePath}|ConvertTo-Json -Compress
 exit 0
}
$conditions=New-Object System.Windows.Automation.AndCondition (
 (New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$mainPid)),
 (New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::ClassNameProperty,'#32770'))
)
function Find-OwnedDialogs {
 $roots=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,(New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$mainPid)))
 $matches=@(foreach($w in $roots){
  if($w.Current.ClassName -eq '#32770'){$w}
  foreach($d in $w.FindAll([System.Windows.Automation.TreeScope]::Descendants,$conditions)){$d}
 })
 return ,$matches
}
$found=Find-OwnedDialogs
if($Action -ne 'list' -and ($Action -ne 'observe' -or $Evidence -notlike '*unexpected-still-open')){
 $deadline=(Get-Date).AddSeconds(15)
 while($found.Count -eq 0 -and (Get-Date) -lt $deadline){
  Start-Sleep -Milliseconds 400
  $found=Find-OwnedDialogs
 }
}
$raw=@(foreach($d in $found){
 $h=[IntPtr]$d.Current.NativeWindowHandle;$o=[NativeQaWindow]::GetWindow($h,4);[uint32]$p=0;[void][NativeQaWindow]::GetWindowThreadProcessId($o,[ref]$p)
 @{handle=$h.ToInt64();owner=$o.ToInt64();ownerPid=$p;rootOwner=[NativeQaWindow]::GetAncestor($h,3).ToInt64();name=$d.Current.Name;type=$d.Current.ControlType.ProgrammaticName;id=$d.Current.AutomationId;class=$d.Current.ClassName;offscreen=$d.Current.IsOffscreen;enabled=$d.Current.IsEnabled;runtimeId=($d.GetRuntimeId() -join ',')}
})
$raw|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $base ('results\'+$Evidence+'-candidates.json')) -Encoding UTF8
if($Action -eq 'list'){
 $visible=@($raw|Where-Object {$_.handle -ne 0 -and $_.type -eq 'ControlType.Window' -and -not $_.offscreen -and [NativeQaWindow]::IsWindow([IntPtr]$_.handle)}|Group-Object handle|ForEach-Object {$_.Group[0]})
 @{mainPid=$mainPid;rawCandidates=$raw;candidates=$visible}|ConvertTo-Json -Depth 5 -Compress;exit 0
}
$found=@($found|Where-Object {$_.Current.NativeWindowHandle -ne 0 -and $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Window -and -not $_.Current.IsOffscreen -and $_.Current.IsEnabled})
if($ExpectedTitle){$found=@($found|Where-Object {$_.Current.Name -eq $ExpectedTitle})}
$groups=@($found|Group-Object {$_.Current.NativeWindowHandle})
$found=@(foreach($group in $groups){[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr][int64]$group.Name)})
if($Action -eq 'deny'){
 $found=@($found|Where-Object {$_.Current.Name -eq '다른 이름으로 저장 확인'})
}
if($found.Count -eq 0){
 $owned=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,(New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$mainPid)))
 $diagnostic=@(foreach($w in $owned){@{title=$w.Current.Name;class=$w.Current.ClassName;handle=$w.Current.NativeWindowHandle;children=@($w.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)|ForEach-Object {@{class=$_.Current.ClassName;type=$_.Current.ControlType.ProgrammaticName;name=$_.Current.Name}})}})
 $diagnostic|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $base ('results\'+$Evidence+'-missing.json')) -Encoding UTF8
}
if($found.Count -ne 1){throw "Expected one owned Native dialog; found $($found.Count)"}
$dialog=$found[0]; $hwnd=[IntPtr]$dialog.Current.NativeWindowHandle
$owner=[NativeQaWindow]::GetWindow($hwnd,4); [uint32]$ownerPid=0
[void][NativeQaWindow]::GetWindowThreadProcessId($owner,[ref]$ownerPid)
if($owner -eq [IntPtr]::Zero -or $ownerPid -ne $mainPid){throw 'Dialog owner does not match owned Electron main'}
$rootOwner=[NativeQaWindow]::GetAncestor($hwnd,3)
$rootElement=[System.Windows.Automation.AutomationElement]::FromHandle($rootOwner)
if($rootElement.Current.ProcessId -ne $mainPid -or $rootElement.Current.ClassName -ne 'Chrome_WidgetWin_1'){throw 'Root owner is not the approved Electron window'}
$knownFileDialog='^(합성 공문 가져오기|활동보고서 선택 · 세션 메모리 전용|Purchase Helper (CSV|Excel|PDF) 가져오기|검토한 공문을 새 ODT로 저장|구매 품목 출력 저장)$'
if($Action -in @('input','accept','cancel','open','save','save-existing') -and $dialog.Current.Name -notmatch $knownFileDialog){throw 'Native file dialog title outside allowlist'}
$children=$dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
$tree=@(foreach($e in $children){$c=$e.Current; @{name=$c.Name;id=$c.AutomationId;type=$c.ControlType.ProgrammaticName;enabled=$c.IsEnabled}})
$rect=$dialog.Current.BoundingRectangle
$result=@{action=$Action;mainPid=$mainPid;ownerPid=$ownerPid;windowHandle=$hwnd.ToInt64();ownerHandle=$owner.ToInt64();title=$dialog.Current.Name;class=$dialog.Current.ClassName;path=$main.ExecutablePath;elements=$tree;observedAt=(Get-Date -Format o);rawCandidates=$raw;scriptSha256=(Hash-File $PSCommandPath)}
[void][NativeQaWindow]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 200
$result.foregroundVerified=([NativeQaWindow]::GetForegroundWindow() -eq $hwnd)
if(-not $result.foregroundVerified){throw 'Owned Native dialog could not be foregrounded safely'}
$png=Join-Path $base ('screenshots\'+$Evidence+'.png')
if(Test-Path -LiteralPath $png){throw 'Evidence already exists'}
$bmp=New-Object System.Drawing.Bitmap ([int]$rect.Width),([int]$rect.Height)
$g=[System.Drawing.Graphics]::FromImage($bmp)
try{$g.CopyFromScreen([int]$rect.X,[int]$rect.Y,0,0,$bmp.Size);$bmp.Save($png,[System.Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$bmp.Dispose()}
$result.screenshot=$png
$result|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $base ('results\'+$Evidence+'-before.json')) -Encoding UTF8
if($Action -eq 'cancel'){
 $cancel=@($dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'2')))|Where-Object {$_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $_.Current.Name -match '^취소'})
 if($cancel.Count -ne 1 -or $cancel[0].Current.ControlType -ne [System.Windows.Automation.ControlType]::Button -or $cancel[0].Current.Name -notmatch '^취소'){throw 'Unique cancel button (ID 2) not found'}
 $result.invoked=$cancel[0].Current.Name
 ([System.Windows.Automation.InvokePattern]$cancel[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke()
} elseif($Action -eq 'review'){
 if(($tree.name -join ' ') -notmatch '미리보기와 개인정보 경고'){throw 'Not an approved local ODT review'}
 $buttons=@(foreach($e in $children){if($e.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $e.Current.Name -eq '검토 후 저장'){$e}})
 if($buttons.Count -ne 1){throw 'Unique local review button missing'}
 ([System.Windows.Automation.InvokePattern]$buttons[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke()
} elseif($Action -eq 'source-confirm'){
 $approved=@('현재 원문을 가져온 텍스트로 바꿀까요?','저장하지 않은 입력이나 가져온 원문이 있습니다. 작업실을 닫으면 임시 입력은 사라집니다. 닫을까요?')
 if($dialog.Current.Name -ne 'BOGUNON DESK' -or @($tree|Where-Object {$_.id -eq 'ContentText' -and $_.name -in $approved}).Count -ne 1){throw 'Not an approved synthetic draft confirmation'}
 $buttons=@(foreach($e in $children){if($e.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $e.Current.AutomationId -eq 'CommandButton_1' -and $e.Current.Name -eq '확인'){$e}})
 if($buttons.Count -ne 1){throw 'Unique source confirmation button missing'}
 ([System.Windows.Automation.InvokePattern]$buttons[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke()
} elseif($Action -eq 'purchase-review'){
 if(($tree.name -join ' ') -notmatch '선택 품목·수량·단가·합계를 확인하고 출력할까요'){throw 'Not an approved local Purchase export review'}
 $buttons=@(foreach($e in $children){if($e.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $e.Current.Name -eq '확인 후 저장 위치 선택'){$e}})
 if($buttons.Count -ne 1){throw 'Unique local Purchase review button missing'}
 ([System.Windows.Automation.InvokePattern]$buttons[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke()
} elseif($Action -eq 'deny'){
 $buttons=@(foreach($e in $children){if($e.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $e.Current.AutomationId -eq 'CommandButton_7' -and $e.Current.Name -match '^아니요'){$e}})
 if($buttons.Count -ne 1){throw 'Unique overwrite denial button missing'}
 ([System.Windows.Automation.InvokePattern]$buttons[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke()
} elseif($Action -eq 'accept'){
 if($FilePath){
  $full=[IO.Path]::GetFullPath($FilePath)
  if(-not $full.StartsWith($base+'\outputs\',[StringComparison]::OrdinalIgnoreCase)){throw 'Accept path outside outputs'}
  Verify-Output $full $ExpectedFileHash
  $edit=@($children|Where-Object {$_.Current.AutomationId -eq '1001' -and $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit})
  if($edit.Count -ne 1 -or ([System.Windows.Automation.ValuePattern]$edit[0].GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)).Current.Value -ne $full){throw 'Accept filename mismatch'}
  $result.file=$full
 }
 $buttons=@($dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1')))|Where-Object {$_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $_.Current.Name -match '^(저장|열기)'})
 if($buttons.Count -ne 1){throw 'Unique accept button not found'}
 ([System.Windows.Automation.InvokePattern]$buttons[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke()
} elseif($Action -in @('input','open','save','save-existing')) {
 $full=[IO.Path]::GetFullPath($FilePath)
 $isOpen=($Action -eq 'open' -or $dialog.Current.Name -match '가져오기|활동보고서 선택')
 $allowed=if($isOpen){$base+'\fixtures\'}else{$base+'\outputs\'}
 if(-not $full.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'File path outside approved QA subtree'}
 if(-not $isOpen){Verify-Output $full $ExpectedFileHash}
 if($Action -eq 'open' -and -not(Test-Path -LiteralPath $full -PathType Leaf)){throw 'Synthetic file missing'}
 if($Action -eq 'save' -and (Test-Path -LiteralPath $full)){throw 'Existing output must not be overwritten'}
 if($Action -eq 'save-existing' -and ($ExpectedFileHash -notmatch '^[a-fA-F0-9]{64}$' -or (Hash-File $full) -ne $ExpectedFileHash)){throw 'Existing QA output hash mismatch'}
 $editId=if($isOpen){'1148'}else{'1001'}
 $children=$dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 $edits=@(foreach($e in $children){if($e.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit -and $e.Current.AutomationId -eq $editId){$e}})
 if($edits.Count -ne 1){throw "Unique file name edit (ID $editId) not found"}
 $edits[0].SetFocus()
 $valuePattern=[System.Windows.Automation.ValuePattern]$edits[0].GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
 if($InputMode -eq 'value'){$valuePattern.SetValue($full)}else{
  if($full -notmatch '^[A-Za-z0-9_:\\\. /-]+$'){throw 'Keyboard input path contains unsupported characters'}
  if([NativeQaWindow]::GetForegroundWindow() -ne $hwnd -or ([System.Windows.Automation.AutomationElement]::FocusedElement.GetRuntimeId() -join ',') -ne ($edits[0].GetRuntimeId() -join ',')){throw 'File name focus not verified'}
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  [System.Windows.Forms.SendKeys]::SendWait($full)
 }
 Start-Sleep -Milliseconds 250
 $fresh=$dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::AutomationIdProperty,$editId)))
 $fresh=@($fresh|Where-Object {$_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit})
 if($fresh.Count -ne 1){throw 'Fresh filename edit not unique'}
 $valuePattern=[System.Windows.Automation.ValuePattern]$fresh[0].GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
 if($valuePattern.Current.Value -ne $full){throw 'File name value did not match approved path'}
 $accept=@($dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1')))|Where-Object {$_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $_.Current.Name -match '^(저장|열기)'})
 if($accept.Count -ne 1){throw 'Unique accept button not found'}
 $result.file=$full
 if([NativeQaWindow]::GetForegroundWindow() -ne $hwnd){throw 'Native focus changed before commit'}
 [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
 Start-Sleep -Milliseconds 200
 if($valuePattern.Current.Value -ne $full){throw 'File name changed before accepting'}
 $result.fileNameVerified=$true
 $result.inputMode=$InputMode;$result.valueAfterInput=$valuePattern.Current.Value
 $bmp=New-Object System.Drawing.Bitmap ([int]$rect.Width),([int]$rect.Height);$g=[System.Drawing.Graphics]::FromImage($bmp)
 try{$g.CopyFromScreen([int]$rect.X,[int]$rect.Y,0,0,$bmp.Size);$bmp.Save((Join-Path $base ('screenshots\'+$Evidence+'-input.png')),[System.Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$bmp.Dispose()}
 if($Action -ne 'input'){([System.Windows.Automation.InvokePattern]$accept[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)).Invoke()}
}
Start-Sleep -Milliseconds 300
$result.originalWindowStillExists=[NativeQaWindow]::IsWindow($hwnd)
$out=Join-Path $base ('results\'+$Evidence+'.json')
if(Test-Path -LiteralPath $out){throw 'Evidence already exists'}
$result|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $out -Encoding UTF8
$result|ConvertTo-Json -Depth 5 -Compress
