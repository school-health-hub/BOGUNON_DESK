param(
    [Parameter(Mandatory)][int]$ProcessId,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [switch]$Interact
)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
    throw 'This probe is restricted to a disposable GitHub-hosted Actions runner.'
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
function Save-Json($Name, $Data) {
    $Data | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutputDirectory "native-window-$Name.json") -Encoding utf8
}
$results = [System.Collections.Generic.List[object]]::new()
function Record($Name, $Status, $Detail) { $results.Add([pscustomobject]@{ item=$Name; status=$Status; detail=$Detail }) }
Add-Type -AssemblyName System.Drawing, System.Windows.Forms, UIAutomationClient, UIAutomationTypes
Add-Type @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class NativeQaWindow {
 public delegate bool Callback(IntPtr h, IntPtr p);
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 public class Window { public long Handle; public long Owner; public string Title; public bool Visible; public Rect Bounds; }
 [DllImport("user32.dll")] static extern bool EnumWindows(Callback c, IntPtr p);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out Rect r);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h,uint c);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int n);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h,out Rect r);
 public static Window[] ForProcess(int pid) {
  var list=new List<Window>(); EnumWindows((h,p)=>{uint id;GetWindowThreadProcessId(h,out id);
   if(id==pid){Rect r;GetWindowRect(h,out r);var s=new StringBuilder(2048);GetWindowText(h,s,s.Capacity);
    list.Add(new Window{Handle=h.ToInt64(),Owner=GetWindow(h,4).ToInt64(),Title=s.ToString(),Visible=IsWindowVisible(h),Bounds=r});}return true;},IntPtr.Zero);
  return list.ToArray();
 }
}
'@
try {
    $process = Get-Process -Id $ProcessId
    $all = @(Get-CimInstance Win32_Process)
    $ids = [System.Collections.Generic.HashSet[int]]::new()
    [void]$ids.Add($ProcessId)
    do {
        $added = $false
        foreach ($p in $all) { if ($ids.Contains([int]$p.ParentProcessId) -and $ids.Add([int]$p.ProcessId)) { $added=$true } }
    } while ($added)
    Save-Json 'process-tree' @($all | Where-Object { $ids.Contains([int]$_.ProcessId) } | ForEach-Object {
        [pscustomobject]@{ processId=$_.ProcessId; parentProcessId=$_.ParentProcessId; name=$_.Name
            webView2CommandLine=$(if ($_.Name -ieq 'msedgewebview2.exe') { $_.CommandLine } else { $null }) }
    })
    try {
        Save-Json 'listeners' @(Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 9225 -or $ids.Contains([int]$_.OwningProcess) } | Select-Object LocalAddress,LocalPort,OwningProcess,State)
        Record 'listeners' 'PASS' 'Recorded port 9225 and QA process-tree listeners.'
    } catch { Record 'listeners' 'FAIL' $_.Exception.Message }
    $policies = foreach ($key in @('HKLM:\SOFTWARE\Policies\Microsoft\Edge','HKCU:\SOFTWARE\Policies\Microsoft\Edge','HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2','HKCU:\SOFTWARE\Policies\Microsoft\Edge\WebView2')) {
        foreach ($name in @('RemoteDebuggingAllowed','RemoteDebuggingEnabled','DeveloperToolsAvailability')) {
            $value = Get-ItemPropertyValue -LiteralPath $key -Name $name -ErrorAction SilentlyContinue
            [pscustomobject]@{key=$key; name=$name; value=$value; present=($null -ne $value)}
        }
    }
    Save-Json 'debugger-policy' @($policies)
    $windows = @([NativeQaWindow]::ForProcess($ProcessId))
    Save-Json 'inventory' $windows
    $screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
    $runtimeVersions=@($all | Where-Object { $ids.Contains([int]$_.ProcessId) -and $_.Name -ieq 'msedgewebview2.exe' -and $_.ExecutablePath } | ForEach-Object {
        $v=[System.Diagnostics.FileVersionInfo]::GetVersionInfo($_.ExecutablePath)
        @{path=$_.ExecutablePath;fileVersion=$v.FileVersion;productVersion=$v.ProductVersion}
    } | Sort-Object { $_.path } -Unique)
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
    $elevated=([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    Save-Json 'session' @{sessionId=$process.SessionId;runnerElevated=$elevated;webView2RuntimeVersions=$runtimeVersions;userInteractive=[Environment]::UserInteractive; virtualScreen=@{x=$screen.X;y=$screen.Y;width=$screen.Width;height=$screen.Height}; screens=@([System.Windows.Forms.Screen]::AllScreens | ForEach-Object { @{device=$_.DeviceName;bounds=$_.Bounds.ToString();primary=$_.Primary} })}
    $window = $windows | Where-Object { $_.Visible -and $_.Bounds.Right -gt $_.Bounds.Left -and $_.Bounds.Bottom -gt $_.Bounds.Top } | Select-Object -First 1
    $script:qaHandle = if ($window) { [IntPtr]$window.Handle } else { [IntPtr]::Zero }
    function Capture($Name) {
        $region = $screen
        $kind = 'desktop-fallback'
        if ($script:qaHandle -ne [IntPtr]::Zero) {
            $current = [NativeQaWindow]::ForProcess($ProcessId) | Where-Object Handle -eq $script:qaHandle.ToInt64() | Select-Object -First 1
            if ($current) {
                $b=$current.Bounds
                $r=[System.Drawing.Rectangle]::new($b.Left,$b.Top,($b.Right-$b.Left),($b.Bottom-$b.Top))
                if ($current.Visible -and $screen.Contains($r) -and [NativeQaWindow]::GetForegroundWindow() -eq $script:qaHandle) { $region=$r; $kind='foreground-qa-window' }
            }
        }
        $bitmap=[System.Drawing.Bitmap]::new($region.Width,$region.Height)
        $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.CopyFromScreen($region.Location,[System.Drawing.Point]::Empty,$region.Size)
            $bitmap.Save((Join-Path $OutputDirectory "native-window-$Name.png"),[System.Drawing.Imaging.ImageFormat]::Png)
            Save-Json "$Name-capture" @{kind=$kind;x=$region.X;y=$region.Y;width=$region.Width;height=$region.Height}
            Record "capture-$Name" 'PASS' "$kind $($region.Width)x$($region.Height)"
        } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
    function Controls {
        if ($script:qaHandle -eq [IntPtr]::Zero) { return @() }
        $script:root=[System.Windows.Automation.AutomationElement]::FromHandle($script:qaHandle)
        return @($script:root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition))
    }
    function Inventory($Name) {
        Save-Json $Name @(Controls | Where-Object { $_.Current.Name } | ForEach-Object {
            $c=$_.Current
            @{name=$c.Name;automationId=$c.AutomationId;controlType=$c.ControlType.ProgrammaticName;enabled=$c.IsEnabled;offscreen=$c.IsOffscreen;bounds=$c.BoundingRectangle.ToString()}
        })
    }
    function Foreground {
        if ($script:qaHandle -eq [IntPtr]::Zero) { throw 'No visible QA window.' }
        [void][NativeQaWindow]::SetForegroundWindow($script:qaHandle)
        Start-Sleep -Milliseconds 250
        if ([NativeQaWindow]::GetForegroundWindow() -ne $script:qaHandle) { throw 'QA foreground verification failed.' }
    }
    function Invoke-Named($Name) {
        $control=Find-Named $Name ([System.Windows.Automation.InvokePattern]::Pattern)
        if (-not $control) { Record "invoke-$Name" 'NOT RUN' 'Named visible control unavailable.'; return $false }
        $pattern=$null
        if (-not $control.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)) { Record "invoke-$Name" 'NOT RUN' 'InvokePattern unavailable.'; return $false }
        Foreground
        $pattern.Invoke()
        Start-Sleep -Milliseconds 400
        Record "invoke-$Name" 'PASS' 'InvokePattern completed; resulting state is in UIA inventory and screenshot.'
        return $true
    }
    function Find-Named($Name, $RequiredPattern) {
        $control=Controls | Where-Object { $_.Current.Name -eq $Name -and $_.Current.IsEnabled -and ($_.GetSupportedPatterns().Id -contains $RequiredPattern.Id) } | Select-Object -First 1
        $scroll=$null
        if ($control -and $control.TryGetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern,[ref]$scroll)) { $scroll.ScrollIntoView(); Start-Sleep -Milliseconds 150 }
        return $control
    }
    if ($window) {
        [void][NativeQaWindow]::ShowWindow($script:qaHandle,9)
        $initialClient=[NativeQaWindow+Rect]::new()
        [void][NativeQaWindow]::GetClientRect($script:qaHandle,[ref]$initialClient)
        $initialOuter=[NativeQaWindow]::ForProcess($ProcessId) | Where-Object Handle -eq $script:qaHandle.ToInt64() | Select-Object -First 1
        $chromeWidth=($initialOuter.Bounds.Right-$initialOuter.Bounds.Left)-($initialClient.Right-$initialClient.Left)
        $chromeHeight=($initialOuter.Bounds.Bottom-$initialOuter.Bounds.Top)-($initialClient.Bottom-$initialClient.Top)
        $targetWidth=1440+$chromeWidth; $targetHeight=900+$chromeHeight
        $fit=[System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.WorkingArea.Width -ge $targetWidth -and $_.WorkingArea.Height -ge $targetHeight } | Select-Object -First 1
        if (-not $fit) {
            $fit=[System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.WorkingArea.Width -ge 1440 -and $_.WorkingArea.Height -ge 900 } | Select-Object -First 1
            $targetWidth=1440; $targetHeight=900
            Record 'client-1440x900' 'NOT RUN' 'Screen cannot fit target client plus measured window chrome; actual client dimensions recorded.'
        }
        if ($fit) { [void][NativeQaWindow]::SetWindowPos($script:qaHandle,[IntPtr]::Zero,$fit.WorkingArea.X,$fit.WorkingArea.Y,$targetWidth,$targetHeight,0x0044) }
        else {
            $small=[System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.WorkingArea.Width -ge (900+$chromeWidth) -and $_.WorkingArea.Height -ge (680+$chromeHeight) } | Select-Object -First 1
            if ($small) { [void][NativeQaWindow]::SetWindowPos($script:qaHandle,[IntPtr]::Zero,$small.WorkingArea.X,$small.WorkingArea.Y,(900+$chromeWidth),(680+$chromeHeight),0x0044) }
            Record 'fit-1440x900' 'NOT RUN' 'Physical display is too small; attempted screen-supported 900x680 client fallback, actual geometry recorded.'
        }
        try { Foreground; Record 'foreground' 'PASS' 'Verified QA HWND before native capture.' } catch { Record 'foreground' 'FAIL' $_.Exception.Message }
        $client=[NativeQaWindow+Rect]::new()
        [void][NativeQaWindow]::GetClientRect($script:qaHandle,[ref]$client)
        Save-Json 'measured-geometry' @{outer=@([NativeQaWindow]::ForProcess($ProcessId) | Where-Object Handle -eq $script:qaHandle.ToInt64());client=$client;virtualDesktop=$screen.ToString();requestedClientWidth=1440;requestedClientHeight=900;actualClientWidth=($client.Right-$client.Left);actualClientHeight=($client.Bottom-$client.Top);targetOuterWidth=$targetWidth;targetOuterHeight=$targetHeight}
    }
    Capture 'before'
    Inventory 'controls-before'
    if ($Interact -and $window) {
        Foreground
        $filled=0
        foreach ($field in @(@('업무명','QA synthetic document'),@('주요 내용','QA synthetic main content'),@('붙임','QA synthetic plan, QA synthetic notice'))) {
            $control=Find-Named $field[0] ([System.Windows.Automation.ValuePattern]::Pattern)
            $pattern=$null
            if ($control -and $control.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$pattern) -and -not $pattern.Current.IsReadOnly) {
                $pattern.SetValue($field[1])
                if ($pattern.Current.Value -eq $field[1]) { $filled++; Record "field-$($field[0])" 'PASS' 'Synthetic value read back.'; Capture "field-$($field[0])" } else { Record "field-$($field[0])" 'FAIL' 'Value readback differs.' }
            } else { Record "field-$($field[0])" 'NOT RUN' 'Writable ValuePattern unavailable.' }
        }
        if ($filled -eq 3) {
            $draft=Invoke-Named '기본 초안 만들기'
            if ($draft) {
                Inventory 'controls-draft'
                $matches=@(Controls | Where-Object { $_.Current.Name -match 'QA synthetic (plan|notice)' } | ForEach-Object { $_.Current.Name })
                Save-Json 'attachment-observation' $matches
                Record 'attachment-duplicate-inspection' 'NOT RUN' 'Saved UIA evidence only; no deduplication assertion performed.'
                Capture 'draft'
                foreach ($label in @('제목','본문','전체')) {
                    if (Invoke-Named "$label 복사") {
                        $notice="$label"+'을(를) 복사했습니다.'
                        if (@(Controls | Where-Object { $_.Current.Name -eq $notice }).Count) {
                            $text=[System.Windows.Forms.Clipboard]::GetText()
                            $marker=if ($label -eq '본문') { 'QA synthetic main content' } else { 'QA synthetic document' }
                            Record "copy-$label" $(if ($text.Contains($marker)) {'PASS'} else {'FAIL'}) 'Clipboard read only after synthetic draft copy success notice; synthetic marker checked, clipboard bytes not logged.'
                            Capture "copy-$label"
                        } else { Record "copy-$label" 'NOT RUN' 'No confirmed copy success notice; clipboard not read.' }
                    }
                }
            }
        } else { Record 'draft' 'NOT RUN' 'All three synthetic fields must be confirmed before generating a draft.' }
        foreach ($name in @('찾기','관리')) { if (Invoke-Named $name) { Inventory "controls-$name"; Capture $name } }
        $focus=Controls | Where-Object { $_.Current.Name -eq '업무명' -and $_.Current.IsKeyboardFocusable -and -not $_.Current.IsOffscreen } | Select-Object -First 1
        if ($focus) {
            Foreground; $focus.SetFocus()
            foreach ($keys in @('{TAB}','+{TAB}')) {
                Foreground
                $previous=[System.Windows.Automation.AutomationElement]::FocusedElement
                [System.Windows.Forms.SendKeys]::SendWait($keys)
                Start-Sleep -Milliseconds 150
                $focused=[System.Windows.Automation.AutomationElement]::FocusedElement
                Record "keyboard-$keys" $(if ($ids.Contains([int]$focused.Current.ProcessId) -and -not [System.Windows.Automation.Automation]::Compare($previous,$focused)) {'PASS'} else {'FAIL'}) "Focus movement and QA process ownership checked; focus: $($focused.Current.Name), PID $($focused.Current.ProcessId)."
                Inventory "focus-$keys"; Capture "focus-$keys"
            }
        } else { Record 'keyboard' 'NOT RUN' 'Named focusable workName control unavailable.' }
        Inventory 'controls-after'
        Capture 'after'
    } else { Record 'interaction' 'NOT RUN' 'Interaction not requested or no visible QA window.' }
    Record 'window-enumeration' $(if ($windows.Count) {'PASS'} else {'FAIL'}) "$($windows.Count) top-level windows belong to QA PID."
    Record 'sticky-scroll-layout' 'NOT RUN' 'No sticky-position or scroll-layout assertion performed.'
    Record 'clipboard-copy-summary' 'NOT RUN' 'See individual copy results if synthetic draft was generated; no blanket copy PASS inferred.'
} catch {
    Record 'probe' 'FAIL' $_.Exception.Message
} finally {
    Save-Json 'results' @($results.ToArray())
}
