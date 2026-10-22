$ErrorActionPreference = 'Stop'

$overrideNames = @(
  'WEBVIEW2_BROWSER_EXECUTABLE_FOLDER',
  'WEBVIEW2_USER_DATA_FOLDER',
  'WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS',
  'WEBVIEW2_RELEASE_CHANNEL_PREFERENCE',
  'WEBVIEW2_CHANNEL_SEARCH_KIND',
  'WEBVIEW2_RELEASE_CHANNELS',
  'WEBVIEW2_PIPE_FOR_SCRIPT_DEBUGGER',
  'WEBVIEW2_WAIT_FOR_SCRIPT_DEBUGGER'
)
$presentOverrides = @($overrideNames | Where-Object { [Environment]::GetEnvironmentVariable($_) })

$policyRoots = @(
  'HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2',
  'HKCU:\SOFTWARE\Policies\Microsoft\Edge\WebView2'
)
$policyReadable = $true
$policyNames = @()
foreach ($root in $policyRoots) {
  try {
    if (Test-Path -LiteralPath $root) {
      $policyNames += (Get-ItemProperty -LiteralPath $root).PSObject.Properties.Name |
        Where-Object { $_ -notmatch '^PS(Path|ParentPath|ChildName|Drive|Provider)$' }
    }
  } catch {
    $policyReadable = $false
  }
}

$runtime = Get-Package -Name 'Microsoft Edge WebView2 Runtime' -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty Version
$result = [ordered]@{
  schema = 1
  overridesClear = ($presentOverrides.Count -eq 0)
  presentOverrideNames = $presentOverrides
  policiesReadable = $policyReadable
  policiesClear = ($policyNames.Count -eq 0)
  presentPolicyNames = $policyNames
  runtimeInstalled = [bool]$runtime
  runtimeVersion = if ($runtime) { [string]$runtime } else { 'NOT_DETECTED' }
  containsSensitiveData = $false
}
$result | ConvertTo-Json | Set-Content -LiteralPath $env:C2D2_PREFLIGHT_PATH -Encoding utf8
if (-not $result.overridesClear -or -not $result.policiesReadable -or -not $result.policiesClear -or -not $result.runtimeInstalled) {
  throw 'C-2D-2 WebView2 preflight blocked; see redacted preflight evidence'
}
