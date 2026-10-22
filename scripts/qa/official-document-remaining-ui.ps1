# Dot-sourced only by the runner-guarded native window probe.
function Named-Control($Name) {
    return Controls | Where-Object { $_.Current.Name -eq $Name -and $_.Current.IsEnabled -and $_.Current.IsKeyboardFocusable } | Select-Object -First 1
}
function Focus-Qa($Control) {
    if (-not $Control) { throw 'Requested native control is unavailable.' }
    Foreground
    $Control.SetFocus()
    Start-Sleep -Milliseconds 150
    $focused=[System.Windows.Automation.AutomationElement]::FocusedElement
    if (-not $ids.Contains([int]$focused.Current.ProcessId)) { throw 'Focus escaped owned QA process tree.' }
}
function Native-Key($Keys) {
    Foreground
    $focused=[System.Windows.Automation.AutomationElement]::FocusedElement
    if (-not $ids.Contains([int]$focused.Current.ProcessId)) { throw 'Keyboard focus is outside QA process tree.' }
    [System.Windows.Forms.SendKeys]::SendWait($Keys)
    Start-Sleep -Milliseconds 250
}
function Activate-Key($Name,$Keys=' ') {
    $control=Named-Control $Name
    if (-not $control) { Record "key-$Name" 'NOT RUN' 'Focusable named control unavailable.'; return $false }
    Focus-Qa $control
    Native-Key $Keys
    return $true
}
function Has-Name($Name) { return @(Controls | Where-Object { $_.Current.Name -eq $Name }).Count -gt 0 }
function Check-State($Name,$Condition,$Detail) { Record $Name $(if ($Condition) {'PASS'} else {'FAIL'}) $Detail }
function Snapshot($Name) { Inventory "controls-$Name"; Capture $Name }
function Current-Value($Name) {
    $control=Find-Named $Name ([System.Windows.Automation.ValuePattern]::Pattern)
    $pattern=$null
    if ($control -and $control.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$pattern)) { return $pattern.Current.Value }
    return $null
}
function Scroll-Evidence($Name,$Percent) {
    $found=0
    foreach ($element in @(Controls)) {
        $pattern=$null
        if ($element.TryGetCurrentPattern([System.Windows.Automation.ScrollPattern]::Pattern,[ref]$pattern) -and $pattern.Current.VerticallyScrollable) {
            try { $pattern.SetScrollPercent(-1,$Percent); $found++ } catch { Record "scroll-$Name" 'NOT RUN' $_.Exception.Message }
        }
    }
    Start-Sleep -Milliseconds 250
    Snapshot $Name
    Record "scroll-$Name" $(if ($found) {'PASS'} else {'NOT RUN'}) "$found native ScrollPattern containers positioned; geometry saved, sticky correctness requires screenshot review."
}
function Run-RemainingUi {
    # Expand/collapse controls expose ExpandCollapsePattern rather than InvokePattern.
    if (Activate-Key '찾기' '{ENTER}') {
        Check-State 'reference-find-open' (Has-Name '공문 참고자료') 'Enter activation followed by picker heading presence.'
        Snapshot 'find-open'
        if (Activate-Key '찾기') { Check-State 'reference-find-close' (-not (Has-Name '공문 참고자료')) 'Space activation followed by picker heading absence.'; Snapshot 'find-closed' }
    }
    if (Activate-Key '관리') {
        Check-State 'reference-manage-open' (Has-Name '로컬 참고자료 패키지') 'Space activation followed by manager heading presence.'
        Snapshot 'manage-open'
        if (Activate-Key '관리' '{ENTER}') { Check-State 'reference-manage-close' (-not (Has-Name '로컬 참고자료 패키지')) 'Enter activation followed by manager heading absence.'; Snapshot 'manage-closed' }
    }
    # Open only the existing reviewed synthetic JSON fixture via the native file dialog.
    if (Activate-Key '관리') {
        $fileControl=Controls | Where-Object { $_.Current.Name -eq '참고자료 JSON 패키지 선택' -and $_.Current.IsKeyboardFocusable } | Select-Object -First 1
        if ($fileControl) {
            Focus-Qa $fileControl; Native-Key ' '
            $dialog=@([NativeQaWindow]::ForProcess($ProcessId)) | Where-Object { $_.Visible -and $_.Title -match 'Open|열기' } | Select-Object -First 1
            if ($dialog) {
                $dialogRoot=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$dialog.Handle)
                $edits=@($dialogRoot.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition))
                $filename=$edits | Where-Object { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit -and $_.Current.Name -match 'File name|파일 이름' } | Select-Object -First 1
                $value=$null
                if ($filename -and $filename.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$value)) {
                    $fixture=Join-Path $env:GITHUB_WORKSPACE 'qa/official-document/fixtures/reference-valid.json'
                    $value.SetValue($fixture)
                    $open=$edits | Where-Object { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $_.Current.Name -match '^Open$|^열기' } | Select-Object -First 1
                    $invoke=$null
                    if ($open -and $open.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$invoke)) { $invoke.Invoke(); Start-Sleep -Milliseconds 700 }
                }
            }
            Snapshot 'package-preview'
            if (Activate-Key '확인 후 패키지 반입') { Check-State 'synthetic-package-import' ((Has-Name '이번 실행에서만 사용') -and -not (Has-Name '확인 후 패키지 반입') -and @(Controls | Where-Object { $_.Current.Name -like '*official-document-qa-valid*' -and $_.Current.Name -notlike '반입 후보:*' }).Count -gt 0) 'Existing synthetic package imported in session mode only.'; Snapshot 'package-imported' }
        } else { Record 'synthetic-package-import' 'NOT RUN' 'Native file input not exposed as focusable control.' }
        # Do not continue with keyboard input if a file dialog remains open.
        if (@([NativeQaWindow]::ForProcess($ProcessId) | Where-Object { $_.Visible -and $_.Title -match 'Open|열기' }).Count) { Record 'file-dialog' 'NOT RUN' 'Native file dialog remained open; stop interactions safely.'; return }
    }
    if (Activate-Key '찾기') {
        Snapshot 'reference-list'
        $reference=Controls | Where-Object { $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $_.Current.Name -like '합성 보건업무 계획*' } | Select-Object -First 1
        if ($reference) {
            Focus-Qa $reference; Native-Key ' '
            if (Activate-Key '초안에 적용') {
                Check-State 'reference-confirmation' (Has-Name '참고자료를 초안에 적용할까요?') 'Application requires explicit confirmation.'
                Snapshot 'apply-confirmation'
                Native-Key '{ESC}'
                Check-State 'escape-dialog-close' (-not (Has-Name '참고자료를 초안에 적용할까요?')) 'Escape cancels only reference confirmation.'
                if (Activate-Key '초안에 적용') {
                    if (Activate-Key '확인 후 적용' '{ENTER}') {
                        Check-State 'input-protection' ((Current-Value '업무명') -eq 'QA synthetic document' -and (Current-Value '주요 내용') -eq 'QA synthetic main content') 'Explicit user inputs preserved after synthetic reference application.'
                        Snapshot 'reference-applied'
                    }
                }
            }
        } else { Record 'reference-selection' 'NOT RUN' 'Synthetic reference button unavailable; no substitute operational data used.' }
        if (Has-Name '공문 참고자료') { [void](Activate-Key '찾기') }
        $focus=[System.Windows.Automation.AutomationElement]::FocusedElement
        Record 'collapsed-focus' $(if ($focus.Current.IsOffscreen) {'FAIL'} else {'PASS'}) "Focused control after collapse: $($focus.Current.Name)."
    }
    $work=Named-Control '업무명'
    if ($work) {
        Focus-Qa $work
        foreach ($key in @('{TAB}','+{TAB}')) {
            $before=[System.Windows.Automation.AutomationElement]::FocusedElement
            Native-Key $key
            $after=[System.Windows.Automation.AutomationElement]::FocusedElement
            Check-State "focus-$key" (-not [System.Windows.Automation.Automation]::Compare($before,$after) -and -not $after.Current.IsOffscreen) "Visible focus movement to $($after.Current.Name)."
            Snapshot "keyboard-$key"
        }
    }
    # Long synthetic text; no production data or API requests.
    $main=Named-Control '주요 내용'
    if ($main) { Focus-Qa $main; Native-Key '^a'; Native-Key (('QA synthetic long content. ' * 65)+'QA END MARKER'); [void](Activate-Key '기본 초안 만들기')
    }
    Scroll-Evidence 'scroll-top' 0
    [void](Activate-Key '관리')
    Scroll-Evidence 'scroll-middle-manager' 50
    Scroll-Evidence 'scroll-bottom' 100
    Save-Json 'scroll-observation' @(Controls | Where-Object { $_.Current.Name -match 'QA END MARKER|교직원 메신저|기안 전 체크리스트|전체 복사' } | ForEach-Object { @{name=$_.Current.Name;offscreen=$_.Current.IsOffscreen;bounds=$_.Current.BoundingRectangle.ToString()} })
    $copy=Named-Control '전체 복사'
    if ($copy) { Focus-Qa $copy; Snapshot 'toolbar-reachable'; Record 'copy-toolbar-reachable' $(if ($copy.Current.IsOffscreen) {'FAIL'} else {'PASS'}) 'Copy toolbar can be reached by keyboard focus after bottom scroll.' }
    Record 'sticky-900' 'NOT RUN' '900px responsive CSS uses static preview; desktop side-by-side sticky is outside this viewport. Review scroll captures for clipping.'
    if (Activate-Key '새 작업') {
        Check-State 'new-work-reset' ((Current-Value '업무명') -eq '' -and -not (Has-Name '공문 참고자료') -and -not (Has-Name '로컬 참고자료 패키지')) 'New work clears input and collapses both reference views.'
        Snapshot 'new-work-reset'
    }
}
Run-RemainingUi
