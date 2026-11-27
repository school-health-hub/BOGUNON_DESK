# BETA13-UX-FINAL-02 — Windows 재실행 QA

**판정 PASS**. 기준 제품 Source SHA는 `24ba8c383f2654187beb42be15b78d7a50204702`, 작업 브랜치는 `codex/beta13-ux-final-01`이다.

## 검증 결과

| 항목 | 실제 Windows 결과 |
| --- | --- |
| 신규 shared 25% | PASS. 신규 합성 프로필의 설정이 `shared`, 25%였다. 듀얼 모니터에서 주 화면 작업 영역 1920×1032의 왼쪽 480px이 비워졌고 Palette는 x=480, 폭=1440으로 배치됐다. |
| Dock 재실행 표시 | PASS. Dock 설정에서 업무 도구를 숨기고 BOGUNON과 홈의 순서를 교환한 뒤 저장했다. 재실행 직후 실제 Palette Dock 버튼의 순서가 BOGUNON → 홈 → 업무 폴더 → 빠른 메모 → 설정과 일치했고 숨긴 업무 도구는 표시되지 않았다. |
| dedicated 프로필 복원 | PASS. 같은 QA 프로필에서 보조 모니터를 지정하고 적용했다. 재실행 후 실제 Palette 창 경계가 보조 모니터 작업 영역과 일치했다. 프리셋, 대상, Dock 프로필, 위젯 위치·크기·표시 상태 및 모니터별 소유권을 대조했다. 선택적 `undefined` 필드는 JSON 정규화 후 비교했다. |
| 정상 종료 | PASS. 최초 및 재실행 Electron PID 29572, 44392의 정상 종료 코드가 모두 0이었다. 종료 뒤 이 worktree의 Electron 프로세스는 0개였다. |

## 실행 및 증거

- 기존 QA 빌드와 Windows Electron의 로컬 CDP 연결을 재사용했다. 제품 변경을 커밋하기 전에 만든 기존 빌드의 메타데이터는 부모 SHA와 `dirty: true`를 기록한다. 기준 제품 커밋 이후 브랜치 변경이 QA 문서에만 해당함을 Git diff로 확인했다. 이번 단계의 제품 소스 변경은 없다.
- 격리 합성 프로필만 사용했다. 최초 실행에서 신규 기본값을 검증한 뒤, 같은 프로필에서 Dock과 dedicated 배치를 저장하고 재실행했다.
- 로컬 증거는 `artifacts/ux-final-02/`의 `shared-25.png`, `palette-dock-restored.png`, `restart-expected.json`, `restart-actual.json`이다.
- 운영 beta.13 및 사용자 프로필, 모니터 구성, 기존 릴리스 자산은 그대로 두었다.
