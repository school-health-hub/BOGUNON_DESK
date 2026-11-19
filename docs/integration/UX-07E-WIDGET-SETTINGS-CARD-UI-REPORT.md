# UX-07E Desktop Palette 위젯 설정창 UI 개편 보고서

## 기준

- 기준 UX-07E Git HEAD: `c09ad251469f5d46cdb6b4334715f1bd8783cb48`
- 기준 제품 Source SHA: `f7244b56e380d433581818750ca9d9e58273b8ce`
- 작업 브랜치: `codex/ux-07e-widget-settings-card-ui`
- 작업 경로: `C:\Users\sehwa\.codex\worktrees\ux-07e-widget-settings\source`
- 설치된 Beta, 기존 UX-07E worktree와 사용자 프로필: 변경 없음

## 구현 범위

- Soft Rose Glass 카드형 공통 `WidgetSettingsPanel`을 추가했다.
- 헤더와 하단 `취소`/`저장` 영역을 고정하고, 카드 본문만 스크롤한다.
- `내용 설정`, `표시 방식`, `모니터 및 배치`, `위젯별 추가 옵션`, `도움말`을 독립 카드로 구성했다.
- 빠른 메모, 주요 일정, 이번 주 실무일정, 빠른 실행, D-Day, 오늘의 보건업무에 공통 패널을 연결했다.
- 기존 Workspace의 소형 위젯 정보 팝업은 유지하고 Desktop Palette에서만 새 패널을 사용한다.
- 위젯 표시 여부와 소유 모니터는 패널 안의 draft로만 변경한다. `저장` 전에는 기존 layout과 모니터 소유권을 쓰지 않는다.
- 좌표와 크기는 읽기 전용으로 표시하며 기존 `x/y/w/h`, 데이터 원본, 설정 schema를 변경하지 않는다.

## 접근성·오류 처리

- 최초 포커스는 닫기 버튼으로 이동한다.
- Tab/Shift+Tab 포커스 트랩과 ESC 취소를 지원한다.
- 미저장 상태에서 닫으면 `계속 편집` 또는 `변경 취소하고 닫기`를 선택한다.
- `계속 편집` 후 닫기 버튼으로 포커스를 복원한다.
- 패널 종료 후 원래 위젯 설정 버튼으로 포커스를 복원한다.
- 설정 버튼의 `aria-controls`는 실제 공통 패널 ID를 가리킨다.
- 저장 실패 시 패널과 입력 draft를 유지하고 오류를 표시한다.

## 실제 Windows GUI QA

- 격리 QA 프로필과 실제 Electron 창을 사용했다.
- 물리 모니터 2대에서 주 모니터 Palette와 빈 보조 모니터 Palette가 각각 생성됨을 확인했다.
- 빠른 메모 설정창 열기, 모니터 변경 draft, ESC 보호, 취소 시 layout 불변, 저장 시 보조 모니터 이동, 주 모니터 복귀를 확인했다.
- 980×700 콘텐츠 크기에서 패널이 화면 안에 유지되고 가로 overflow가 없으며 하단 버튼이 항상 접근 가능함을 확인했다.
- QA 종료 후 Electron QA 프로세스는 종료됐다.

### 캡처

캡처는 Git-ignored 로컬 QA 증거이며 제품 소스에는 포함하지 않는다.

- `artifacts/ux-07e-widget-settings/quick-memo-panel.png`
  - SHA-256: `C933E61E4867DCB539EA6B979B49DCDB495B3877DD853BE01796A7CD4693D2EC`
- `artifacts/ux-07e-widget-settings/quick-memo-panel-980x700.png`
  - SHA-256: `84EA32043D6DF29050AF09B94E3D4FFA6FCC0EAD12EC23D3B97C672AF92CC789`

## 자동 검증

- 집중 Vitest: `21 PASS / 0 FAIL`
- 실제 Electron Playwright: `1 PASS / 0 FAIL`
- TypeScript: Electron 3개 설정 + 루트 `4/4 PASS`
- Electron 제품 빌드: `PASS`
- `git diff --check`: `PASS`
- 전용 lint script: `NOT RUN` — `package.json`에 lint script가 없다.

## 보호 및 제한

- 위젯 데이터 구조, 설정 schema/version, 모니터 layout profile 계약을 변경하지 않았다.
- 13개 위젯 기능과 기존 위젯 이동·크기 조절·숨김·복원 경로를 유지했다.
- NSIS 설치, 기존 Beta 교체, main 병합과 운영 배포는 수행하지 않았다.
- 보조 CDP QA 실행 1회가 승인 임시 루트 규칙을 위반해 시작 단계에서 차단됐고 해당 보조 프로세스만 종료했다. 공식 Electron E2E 경로의 최종 GUI QA는 PASS했다.

## 판정

**PASS — 승인된 위젯 설정창 UI·UX 개선 범위 내**

## Desktop Palette 투명 캔버스 회귀 수정

### 원인과 수정

- Palette `BrowserWindow`의 `transparent: true`, `frame: false`, `skipTaskbar: true` 설정은 정상적으로 유지되고 있었다.
- Palette 루트가 카드 스타일 재사용을 위해 `workspace-shell`을 함께 사용하면서, 일반 Workspace 전용 `design-07.css` 캔버스 배경과 `dashboard.css`의 전체 화면 `::before`/`::after` 재질 레이어까지 상속한 것이 원인이었다.
- Palette 전용 최종 스타일에서 루트 배경을 투명으로 고정하고 두 재질 가상 요소를 제거했다. 일반 Workspace의 Soft Rose 캔버스와 위젯 카드 스타일은 변경하지 않았다.
- Palette는 계속 모니터별 독립 `x/y/w/h` 배치 렌더러를 사용하며 일반 Dashboard의 `.workspace-dashboard` 컨테이너를 렌더링하지 않는다.

### 회귀 검증

- 새 정적 계약 테스트는 수정 전 RED, 수정 후 GREEN으로 확인했다.
- 새 실제 Electron E2E는 두 Palette 각각의 `html`, `body`, `#root`, Palette 루트 배경이 투명이고 배경 이미지가 없으며, `::before`/`::after`가 생성되지 않음을 확인했다.
- 각 Palette의 빈 좌상단 1×1 픽셀을 실제 `BrowserWindow.capturePage()`로 측정해 알파값 `0`을 확인했다.
- 물리 모니터 2대에서 투명 Palette가 각각 생성됐다. 빈 영역에는 실제 Edge/YouTube 및 Windows 바탕화면이 그대로 보였다.
- OS hit-test에서 빈 영역 좌표는 Electron이 아니라 아래 Edge 창에 속하는 것으로 확인돼 클릭 통과가 PASS했다.
- Palette 카드의 `위젯 선택` 영역은 실제 클릭을 받아 편집 도구가 표시돼 위젯 영역 입력이 PASS했다.
- 빠른 메모는 콘텐츠가 실제 높이를 초과할 때만 내부 스크롤을 제공했고, 빈 Palette에는 불필요한 전체 화면 스크롤이나 Dashboard 컨테이너가 없었다.
- Dock 단일화, 모니터별 위젯 소유권, 설정 draft/취소/저장과 포커스 복원 E2E를 함께 재실행해 기존 계약을 보존했다.

### 최신 검증 결과

- 집중 Vitest: `21 PASS / 0 FAIL`
- 실제 Electron Playwright: `2 PASS / 0 FAIL`
- TypeScript: 루트 + Electron 3개 설정 `4/4 PASS`
- Electron 제품 빌드: `PASS`
- `git diff --check`: `PASS`
- 전용 lint script: `NOT RUN` — 기존과 동일하게 정의되지 않았다.
- 투명 캔버스 캡처: `artifacts/ux-07e-widget-settings/palette-transparent-canvas.png`
  - SHA-256: `70159C599485EA24F557E98F35DB77E82F6724D74431FDCA507754A36786915E`
  - Git-ignored 로컬 QA 증거이며 제품 커밋에는 포함하지 않는다.

### 보호 결과와 판정

- 설치된 Beta, 기존 사용자 프로필, UX-07D/E 원본, 다른 worktree 및 Windows Shell은 변경하지 않았다.
- WorkerW, Progman, SetParent 및 Shell 조작은 수행하지 않았다.
- QA Electron 프로세스는 정상 종료됐고 잔여 Electron 프로세스는 `0`이었다.

**PASS — Desktop Palette 투명 캔버스 및 실제 빈 영역 클릭 통과 회귀 수정 범위 내**
