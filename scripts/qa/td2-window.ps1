param([Parameter(Mandatory=$true)][string]$ExecutableRoot,[int]$Width=980,[int]$Height=700,[ValidateSet('Resize','Probe','Close','DialogProbe','DialogApprove','DialogCancel','TrayReturn')][string]$Action='Resize',[string]$Screenshot)
$ErrorActionPreference='Stop'
if($ExecutableRoot -notmatch '^[A-Za-z]:[\\/]'){throw 'Executable root must be an absolute Windows drive path'}
Add-Type @'
using System;using System.Text;using System.Collections.Generic;using System.Runtime.InteropServices;
public static class Td2Window{
 public delegate bool EnumProc(IntPtr h,IntPtr p);
 [StructLayout(LayoutKind.Sequential)]public struct Rect{public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")]public static extern int GetSystemMetrics(int n);
 [DllImport("user32.dll")]public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int z,bool r);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern IntPtr FindWindow(string c,string t);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]public static extern bool IsWindowEnabled(IntPtr h);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")]public static extern bool EnumWindows(EnumProc c,IntPtr p);
 [DllImport("user32.dll")]public static extern bool EnumChildWindows(IntPtr h,EnumProc c,IntPtr p);
 [DllImport("user32.dll")]public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")]public static extern IntPtr SendMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")]public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e);
 public static string Text(IntPtr h){var s=new StringBuilder(512);GetWindowText(h,s,512);return s.ToString();}
 public static string Class(IntPtr h){var s=new StringBuilder(128);GetClassName(h,s,128);return s.ToString();}
 public static IntPtr[] Windows(int pid){var a=new List<IntPtr>();EnumWindows((h,p)=>{uint n;GetWindowThreadProcessId(h,out n);if(n==pid&&IsWindowVisible(h))a.Add(h);return true;},IntPtr.Zero);return a.ToArray();}
 public static IntPtr[] Children(IntPtr root){var a=new List<IntPtr>();EnumChildWindows(root,(h,p)=>{a.Add(h);return true;},IntPtr.Zero);return a.ToArray();}
}
'@
function Capture([IntPtr]$handle){
 if(!$Screenshot){return}
 $path=[IO.Path]::GetFullPath($Screenshot);$root=[IO.Path]::GetFullPath($env:TD2_EVIDENCE_ROOT)+'\'
 if(!$path.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){throw 'Screenshot escaped QA evidence'}
 $r=New-Object Td2Window+Rect;[void][Td2Window]::GetWindowRect($handle,[ref]$r)
 if($r.Right-$r.Left -le 0 -or $r.Bottom-$r.Top -le 0){throw 'Native screenshot has no area'}
 Add-Type -AssemblyName System.Drawing
 $b=[Drawing.Bitmap]::new($r.Right-$r.Left,$r.Bottom-$r.Top);$g=[Drawing.Graphics]::FromImage($b)
 try{$g.CopyFromScreen($r.Left,$r.Top,0,0,$b.Size);$b.Save($path,[Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$b.Dispose()}
}
$shell=[Td2Window]::FindWindow('Shell_TrayWnd',$null)
if($Action -eq 'Probe'){
 [ordered]@{platform=[Environment]::OSVersion.VersionString;architecture=$env:PROCESSOR_ARCHITECTURE;userInteractive=[Environment]::UserInteractive;sessionId=(Get-Process -Id $PID).SessionId;explorerCount=@(Get-Process explorer -ErrorAction SilentlyContinue).Count;shellTrayHandle=$shell.ToInt64();shellTrayVisible=($shell -ne [IntPtr]::Zero -and [Td2Window]::IsWindowVisible($shell))}|ConvertTo-Json -Compress;exit
}
$root=[IO.Path]::GetFullPath($ExecutableRoot).TrimEnd('\')+'\'
$candidates=@(Get-Process -Name 'BOGUNON DESK ELECTRON P0' -ErrorAction SilentlyContinue|Where-Object{($_.MainWindowHandle -ne 0 -or $Action -eq 'TrayReturn') -and $_.Path -and [IO.Path]::GetFullPath($_.Path).StartsWith($root,[StringComparison]::OrdinalIgnoreCase)})
if(($Action -ne 'TrayReturn' -and $candidates.Count -ne 1) -or ($Action -eq 'TrayReturn' -and $candidates.Count -lt 1)){throw "Expected one owned QA process with a window; found $($candidates.Count)"}
$target=$candidates[0];$handle=$target.MainWindowHandle
if($Action -eq 'Resize'){
 if(![Td2Window]::MoveWindow($handle,0,0,$Width,$Height,$true)){throw 'MoveWindow failed'}
 $r=New-Object Td2Window+Rect;[void][Td2Window]::GetWindowRect($handle,[ref]$r)
 [ordered]@{pid=$target.Id;left=$r.Left;top=$r.Top;width=$r.Right-$r.Left;height=$r.Bottom-$r.Top;executable=$target.Path}|ConvertTo-Json -Compress;exit
}
if($Action -eq 'Close'){[void][Td2Window]::PostMessage($handle,0x0112,[IntPtr]0xF060,[IntPtr]::Zero);@{requested=$true;method='Win32 WM_SYSCOMMAND SC_CLOSE';pid=$target.Id}|ConvertTo-Json -Compress;exit}
if($Action -like 'Dialog*'){
 $dialogs=@([Td2Window]::Windows($target.Id)|Where-Object{[Td2Window]::Class($_) -eq '#32770'})
 if($dialogs.Count -ne 1){@{found=$false;count=$dialogs.Count;reason='No unique visible owned Win32 dialog'}|ConvertTo-Json -Compress;exit}
 $dialog=$dialogs[0];$buttons=@([Td2Window]::Children($dialog)|Where-Object{[Td2Window]::Class($_) -eq 'Button' -and [Td2Window]::IsWindowVisible($_) -and [Td2Window]::IsWindowEnabled($_)})
 $names=@($buttons|ForEach-Object{[Td2Window]::Text($_).Replace('&','')})
 Capture $dialog
 if($Action -eq 'DialogProbe'){$rect=New-Object Td2Window+Rect;[void][Td2Window]::GetWindowRect($dialog,[ref]$rect);@{found=$true;class='#32770';buttons=$names;pid=$target.Id;left=$rect.Left;top=$rect.Top;width=($rect.Right-$rect.Left);height=($rect.Bottom-$rect.Top);screenWidth=[Td2Window]::GetSystemMetrics(0);screenHeight=[Td2Window]::GetSystemMetrics(1)}|ConvertTo-Json -Compress;exit}
 $selected=@($buttons|Where-Object{$n=[Td2Window]::Text($_).Replace('&','');if($Action -eq 'DialogCancel'){$n -match '취소|^Cancel$'}else{$n -match '확인|적용|계속|^OK$|^Yes$' -and $n -notmatch '취소|Cancel'}})
 if($selected.Count -ne 1){@{found=$true;clicked=$false;reason='Native button not uniquely identified';buttons=$names}|ConvertTo-Json -Compress;exit}
 [void][Td2Window]::SetForegroundWindow($dialog);[void][Td2Window]::PostMessage($selected[0],0x00F5,[IntPtr]::Zero,[IntPtr]::Zero)
 @{found=$true;clicked=$true;button=[Td2Window]::Text($selected[0]);method='Win32 native Button BM_CLICK';pid=$target.Id}|ConvertTo-Json -Compress;exit
}
if($Action -eq 'TrayReturn'){
 if($shell -eq [IntPtr]::Zero){@{verdict='NOT RUN';reason='Windows Explorer Shell_TrayWnd absent'}|ConvertTo-Json -Compress;exit}
 try{
  Add-Type -AssemblyName UIAutomationClient;Add-Type -AssemblyName UIAutomationTypes
  $condition=[Windows.Automation.Condition]::TrueCondition;$explorerId=[uint32]0;[void][Td2Window]::GetWindowThreadProcessId($shell,[ref]$explorerId)
  $desktop=[Windows.Automation.AutomationElement]::RootElement
  $all=$desktop.FindAll([Windows.Automation.TreeScope]::Descendants,$condition)
  $icons=@($all|Where-Object{$_.Current.Name -like '*BOGUNON*' -and !$_.Current.IsOffscreen -and $_.Current.ProcessId -eq $explorerId})
  if(!$icons.Count){$expand=@($all|Where-Object{$_.Current.AutomationId -eq 'NotificationChevron' -or $_.Current.Name -match 'Show hidden icons|숨겨진 아이콘 표시|Notification Chevron'});if($expand.Count -eq 1){$expand[0].GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern).Invoke();Start-Sleep -Milliseconds 500;$all=$desktop.FindAll([Windows.Automation.TreeScope]::Descendants,$condition);$icons=@($all|Where-Object{$_.Current.Name -like '*BOGUNON*' -and !$_.Current.IsOffscreen -and $_.Current.ProcessId -eq $explorerId})}}
  if($icons.Count -ne 1){@{verdict='NOT RUN';reason='No unique visible BOGUNON tray icon';count=$icons.Count;visibleShellControls=@($all|Where-Object{$_.Current.ProcessId -eq $explorerId -and !$_.Current.IsOffscreen -and $_.Current.Name}|Select-Object -First 60|ForEach-Object{@{name=$_.Current.Name;automationId=$_.Current.AutomationId;controlType=$_.Current.ControlType.ProgrammaticName}})}|ConvertTo-Json -Compress;exit}
  $r=$icons[0].Current.BoundingRectangle;if($r.Width -le 0 -or $r.Height -le 0){throw 'Tray icon rectangle unavailable'}
  Capture $shell
  [void][Td2Window]::SetCursorPos([int]($r.X+$r.Width/2),[int]($r.Y+$r.Height/2));[Td2Window]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[Td2Window]::mouse_event(4,0,0,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds 80;[Td2Window]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[Td2Window]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  @{verdict='GESTURE SENT';method='actual Explorer icon UIA bounds + native mouse double-click';icon=$icons[0].Current.Name}|ConvertTo-Json -Compress
 }catch{@{verdict='NOT RUN';reason='Native tray automation unavailable';detail=$_.Exception.Message}|ConvertTo-Json -Compress};exit
}
