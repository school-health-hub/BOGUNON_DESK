param(
  [Parameter(Mandatory=$true)][string]$ExecutableRoot,
  [Parameter(Mandatory=$true)][int]$Width,
  [Parameter(Mandatory=$true)][int]$Height
)
$ErrorActionPreference='Stop'
if(-not [IO.Path]::IsPathFullyQualified($ExecutableRoot)){throw 'Executable root must be absolute'}
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Td2Window {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
  [DllImport("user32.dll", SetLastError=true)] public static extern bool MoveWindow(IntPtr handle,int x,int y,int width,int height,bool repaint);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool GetWindowRect(IntPtr handle,out Rect rect);
}
'@
$root=[IO.Path]::GetFullPath($ExecutableRoot).TrimEnd('\')+'\'
$candidates=@(Get-Process -Name 'BOGUNON DESK ELECTRON P0' -ErrorAction SilentlyContinue|Where-Object{
  $_.MainWindowHandle -ne 0 -and $_.Path -and [IO.Path]::GetFullPath($_.Path).StartsWith($root,[StringComparison]::OrdinalIgnoreCase)
})
if($candidates.Count -ne 1){throw "Expected one QA window under $root; found $($candidates.Count)"}
$target=$candidates[0]
if(-not [Td2Window]::MoveWindow($target.MainWindowHandle,0,0,$Width,$Height,$true)){throw "MoveWindow failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"}
$rect=New-Object Td2Window+Rect
if(-not [Td2Window]::GetWindowRect($target.MainWindowHandle,[ref]$rect)){throw "GetWindowRect failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"}
[ordered]@{pid=$target.Id;left=$rect.Left;top=$rect.Top;width=$rect.Right-$rect.Left;height=$rect.Bottom-$rect.Top;executable=$target.Path}|ConvertTo-Json -Compress
