# Sourced only inside the disposable GitHub-hosted native UI probe.
$authoring = [ordered]@{}
foreach ($item in @('title-body-edit','preview','template-picker','odt-save','cancel-preserves-manuscript')) {
    $authoring[$item] = @{status='NOT RUN'; detail='No actual native interaction evidence yet.'}
}
function Authoring-Result($Item,$Status,$Detail) {
    $authoring[$Item]=@{status=$Status;detail=$Detail}
    Record "p11-$Item" $Status $Detail
}
function Editable($Name) {
    $e=Find-Named $Name ([System.Windows.Automation.ValuePattern]::Pattern)
    if (-not $e) { throw "Native editor unavailable: $Name" }
    return $e
}
function Read-Editor($Name) {
    $e=Editable $Name; $p=$null
    if (-not $e.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$p)) { throw 'ValuePattern unavailable' }
    return $p.Current.Value.Replace("`r`n","`n")
}
function Set-Editor($Name,$Value) {
    $e=Editable $Name; Foreground; $e.SetFocus()
    if (-not $ids.Contains([int][System.Windows.Automation.AutomationElement]::FocusedElement.Current.ProcessId)) { throw 'Focus outside owned process tree' }
    [System.Windows.Forms.Clipboard]::SetText($Value)
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 350
    if ((Read-Editor $Name) -cne $Value.Replace("`r`n","`n")) { throw "Editor readback mismatch: $Name" }
}
function Template-Dialog {
    for($attempt=0;$attempt -lt 20;$attempt++) {
        $d=[NativeQaWindow]::ForProcess($ProcessId) | Where-Object { $_.Visible -and $_.Handle -ne $script:qaHandle.ToInt64() -and $_.Title -match 'Open|열기|표준서식' } | Select-Object -First 1
        if($d){return $d}; Start-Sleep -Milliseconds 200
    }
    return $null
}
function Save-Dialog {
    for($attempt=0;$attempt -lt 20;$attempt++) {
        $d=[NativeQaWindow]::ForProcess($ProcessId) | Where-Object { $_.Visible -and $_.Handle -ne $script:qaHandle.ToInt64() -and $_.Title -match 'Save|저장' } | Select-Object -First 1
        if($d){return $d}; Start-Sleep -Milliseconds 200
    }
    return $null
}
function Dialog-Key($Dialog,$Keys) {
    [void][NativeQaWindow]::SetForegroundWindow([IntPtr]$Dialog.Handle)
    Start-Sleep -Milliseconds 150
    if([NativeQaWindow]::GetForegroundWindow() -ne [IntPtr]$Dialog.Handle){throw 'Owned file dialog not foreground'}
    [System.Windows.Forms.SendKeys]::SendWait($Keys)
}
try {
    Set-Editor '업무명' 'GUI synthetic work'
    Set-Editor '주요 내용' 'GUI synthetic draft'
    if(-not(Invoke-Named '기본 초안 만들기')){throw 'Draft button unavailable'}
    $summary=Controls | Where-Object {$_.Current.Name -eq '제목·본문 수정' -and $_.Current.IsEnabled} | Select-Object -First 1
    if(-not $summary){throw 'Authoring disclosure unavailable'}
    Foreground; $summary.SetFocus(); [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Start-Sleep -Milliseconds 350
    $title='GUI edited title'
    $body="1. GUI paragraph alpha`n  가. GUI paragraph beta`n`n끝."
    Set-Editor '공문 제목 편집' $title
    Set-Editor '공문 본문 편집' $body
    Capture 'p11-edited'; Inventory 'p11-edited-controls'
    Authoring-Result 'title-body-edit' 'PASS' 'Actual WebView2 editor values read back after native keyboard input; screenshot captured.'
    $previewVerified=$true
    foreach($marker in @($title,'GUI paragraph alpha')) {
        $target=Controls | Where-Object {$_.Current.Name.Contains($marker) -and $_.Current.ControlType -ne [System.Windows.Automation.ControlType]::Edit} | Select-Object -First 1
        if(-not $target){$previewVerified=$false;continue}
        $scroll=$null
        if($target.TryGetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern,[ref]$scroll)){$scroll.ScrollIntoView();Start-Sleep -Milliseconds 250}
        $visible=Controls | Where-Object {$_.Current.Name.Contains($marker) -and -not $_.Current.IsOffscreen -and $_.Current.ControlType -ne [System.Windows.Automation.ControlType]::Edit} | Select-Object -First 1
        if(-not $visible){$previewVerified=$false}
        Capture $(if($marker -eq $title){'p11-preview-title'}else{'p11-preview-body'})
    }
    if($previewVerified){Authoring-Result 'preview' 'PASS' 'Edited heading and body independently visible outside input controls; actual native screenshots captured.'}
    else{Authoring-Result 'preview' 'NOT RUN' 'Edited preview visibility not independently verified; inspect captured window and UIA tree.'}
    if(-not(Invoke-Named '다른 승인 서식 선택 후 저장')){throw 'ODT button unavailable'}
    $dialog=Template-Dialog
    if(-not $dialog){throw 'Native template file picker not observed'}
    Capture 'p11-template-picker-cancel'
    Dialog-Key $dialog '{ESC}'; Start-Sleep -Milliseconds 600
    Foreground
    $preserved=(Read-Editor '공문 제목 편집') -ceq $title -and (Read-Editor '공문 본문 편집') -ceq $body
    $cancelNotice=@(Controls | Where-Object {$_.Current.Name -eq 'ODT 저장을 취소했습니다. 작성 중인 원고는 유지됩니다.'}).Count -gt 0
    if($preserved -and $cancelNotice){Authoring-Result 'cancel-preserves-manuscript' 'PASS' 'Actual native template picker cancelled; both edited values and cancellation notice verified.'}
    else{Authoring-Result 'cancel-preserves-manuscript' 'FAIL' 'Cancellation notice or manuscript readback differed.'}
    Capture 'p11-cancel-preserved'
    if(-not(Invoke-Named '다른 승인 서식 선택 후 저장')){throw 'Second ODT button invocation unavailable'}
    $dialog=Template-Dialog
    if(-not $dialog){throw 'Second native picker not observed'}
    $fixture=(Resolve-Path 'qa/official-document/fixtures/synthetic-document.odt').Path
    [System.Windows.Forms.Clipboard]::SetText($fixture)
    Dialog-Key $dialog '%n'; Dialog-Key $dialog '^v'; Dialog-Key $dialog '{ENTER}'
    Start-Sleep -Milliseconds 900
    Foreground
    $rejected=@(Controls | Where-Object {$_.Current.Name.Contains('선택한 표준서식의 SHA-256이 승인된 값과 다릅니다.')}).Count -gt 0
    if($rejected){Authoring-Result 'template-picker' 'PASS' 'Native manual picker selected CI synthetic ODT; unchanged production SHA guard rejected it.'}
    else{Authoring-Result 'template-picker' 'NOT RUN' 'No verified post-selection SHA rejection; inspect native evidence.'}
    Capture 'p11-synthetic-rejection'
    # Default action uses the exact approved embedded resource, never the synthetic picker file.
    if(-not(Invoke-Named 'K-에듀파인용 ODT 저장')){throw 'Default save button unavailable'}
    $saveDialog=Save-Dialog
    if(-not $saveDialog){throw 'Default action did not open a native save-location dialog'}
    Capture 'p11-save-location-cancel'
    Dialog-Key $saveDialog '{ESC}'; Start-Sleep -Milliseconds 600; Foreground
    if((Read-Editor '공문 제목 편집') -cne $title -or (Read-Editor '공문 본문 편집') -cne $body){throw 'Save-location cancellation changed manuscript'}
    $cancelNotice=@(Controls | Where-Object {$_.Current.Name -eq 'ODT 저장을 취소했습니다. 작성 중인 원고는 유지됩니다.'}).Count -gt 0
    if(-not $cancelNotice){throw 'Save-location cancellation notice missing'}
    Authoring-Result 'cancel-preserves-manuscript' 'PASS' 'Actual native save-location dialog cancelled; edited title/body and notice verified.'
    Capture 'p11-save-cancel-preserved'
    if(-not(Invoke-Named 'K-에듀파인용 ODT 저장')){throw 'Default save reinvocation unavailable'}
    $saveDialog=Save-Dialog
    if(-not $saveDialog){throw 'Native save-location dialog unavailable'}
    $destination=Join-Path $OutputDirectory 'synthetic-bundled-gui.odt'
    if(Test-Path -LiteralPath $destination){throw 'Refusing to overwrite a GUI output'}
    [System.Windows.Forms.Clipboard]::SetText($destination)
    Dialog-Key $saveDialog '%n'; Dialog-Key $saveDialog '^v'; Dialog-Key $saveDialog '{ENTER}'
    for($attempt=0;$attempt -lt 25 -and -not(Test-Path -LiteralPath $destination);$attempt++){Start-Sleep -Milliseconds 200}
    Foreground
    $savedNotice=@(Controls | Where-Object {$_.Current.Name -eq 'synthetic-bundled-gui.odt 파일을 저장했습니다.'}).Count -gt 0
    if(-not(Test-Path -LiteralPath $destination) -or -not $savedNotice){throw 'No verified saved output and UI confirmation'}
    if((Read-Editor '공문 제목 편집') -cne $title -or (Read-Editor '공문 본문 편집') -cne $body){throw 'Saving changed manuscript'}
    (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash | Set-Content (Join-Path $OutputDirectory 'synthetic-bundled-gui.sha256.txt')
    Authoring-Result 'odt-save' 'PASS' 'Actual WebView2 default action saved synthetic manuscript using embedded home-v1; native save dialog, output bytes and success notice observed.'
    Capture 'p11-bundled-saved'
    Inventory 'p11-final-controls'
} catch {
    Record 'p11-probe' 'NOT RUN' $_.Exception.Message
    $authoring['probeDiagnostic']=$_.Exception.Message
    Capture 'p11-diagnostic'
} finally {
    Save-Json 'p11-authoring' $authoring
}
