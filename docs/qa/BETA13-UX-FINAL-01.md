# BETA13-UX-FINAL-01

## 적용 범위

- 기준 제품 Source SHA `2e8247f1b1a2961e80ed61bb15b252d27016b8ab`
- 전용 브랜치 `codex/beta13-ux-final-01`
- Dock 편집의 미리보기는 현재 표시 중인 아이콘을 저장 모델의 순서 그대로 보여준다. 설정 목록에는 숨긴 항목도 남는다. 스위치는 키보드로 조작하며, 손잡이는 드래그와 위·아래 방향키를 지원한다. 저장이 성공한 뒤 기존 Palette 알림으로 열린 Dock도 갱신한다.
- 새 Desktop Surface 문서는 shared 25%로 시작한다. 기존 문서에 배치 필드가 없으면 기존 방식으로 표시하고, 이미 저장된 프리셋·모니터·위젯 소유권·Dock 프로필은 기존 데이터 그대로 사용한다. 기본 배치 복원은 설정에 미리 적용되고 적용 버튼으로 저장한다.
- 시계는 라벨과 보조 아이콘, 고정폭 시간 숫자, 한국어 날짜 순으로 배치된다. 시간 계산·업데이트 주기와 카드 크기 저장은 기존 계약을 사용한다.

## 변경 파일

- Dock: `src/dock/DockEditor.tsx`, `src/dock/dock-editor.css`, `src/styles/dashboard.css`.
- 화면 배치 및 갱신: `electron-p0/desktop-surface-protocol.ts`, `electron-p0/main/desktop-surface-mode.ts`, `electron-p0/main/desktop-surface-controller.ts`, `electron-p0/main/main.mts`, `electron-p0/renderer/BoardPlacementSettings.tsx`.
- 시계: `src/widgets/ClockWidget.tsx`, `src/widgets/clock-widget.css`.
- 검증: `electron-p0/tests/desktop-surface-mode.test.ts`, `electron-p0/e2e/desktop-board-bounds.e2e.ts`, `electron-p0/e2e/beta13-ux-final.e2e.ts`.

## Windows 캡처

격리 QA 프로필의 앱 창 영역만 캡처했다. 비교는 같은 PC에서 기반 빌드와 후보 빌드를 사용했다. 원본은 worktree 내 Git-ignored `artifacts/` 아래에 보관했다.

| 확인 영역 | 기준 | 개선 |
| --- | --- | --- |
| Dock | `cdp-before/dock.png` | `cdp-after/dock.png`, `cdp-after/dock-narrow.png` |
| 시계 | `cdp-before/clock.png` | `cdp-after/clock.png`, `cdp-after/clock-narrow.png` |
| 화면 배치 | 기존 저장값 회귀 테스트 | `cdp-after/board-25.png`, `cdp-after/board-topology.json` |

기준 Dock의 체크박스와 드래그 손잡이 사이 거리를 줄이고, 컴팩트한 행과 Soft Rose 스위치, 읽기 전용 미리보기를 추가했다. 시계 캡처는 배치 영역에 따라 크기가 다르므로 정보 위계와 한글 잘림을 비교했다.

## 실행 기록

- TypeScript 및 Electron 프로덕션 빌드 PASS. 로그인 설정 없이 QA 빌드를 만들었다.
- 6개 파일, 집중 테스트 32/32 PASS. 기존 배치 필드 부재, 명시적 dedicated, 모니터 소유권·프로필, 기존 Dock 저장 형식 포함.
- 일반 Playwright Electron 런처는 inspector 연결 또는 초기 준비 단계에서 타임아웃했다. 대체로 Windows Electron을 격리 프로필로 직접 시작하고 로컬 CDP에 연결해 실창 동작을 검증했다. 이 경로는 소프트웨어 렌더링을 사용했다.
- 실제 듀얼 1920×1080, 배율 100% 두 대. 주 화면 작업 영역 1920×1032에서 왼쪽 480px을 확보하고 Palette 경계 x=480, 폭=1440을 확인했다. 물리 단일 화면 및 125% DPI는 NOT RUN.
- 운영 beta.13, 프로필, 바탕화면 아이콘 및 GitHub Release에는 변경을 가하지 않았다.

## 최종 판정

- 제품 Source SHA `24ba8c383f2654187beb42be15b78d7a50204702`. 아래 캡처는 해당 제품 변경을 커밋하기 직전의 소스로 빌드했다. 이 보고서 커밋은 제품 Source SHA와 구분한다.
- **PASS**. Windows Dock 미리보기의 순서와 표시 여부, 키보드 스위치, 실제 드래그, 저장 성공 표시, 같은 실행에서 실제 Dock 반영을 확인했다. 정상 종료 뒤 QA의 저장 파일에 숨김 및 순서가 유지됐다.
- **PASS**. 일반폭/112px 시계의 시간과 한글 날짜, 초 갱신 중 숫자 문자열 폭 유지, 전후 캡처와 독립 시각 검토를 확인했다. 시각 검토에서 지적된 닫기 버튼 안쪽 정렬을 수정하고 최종 캡처를 다시 확인했다.
- **PASS**. 새 공유 배치 25%, Windows HWND의 작업 영역 경계, 설정 취소 및 기본값 복원, 기존 프로필과 모니터 소유권 보존 단위 테스트를 확인했다.
- **CONDITIONAL**. 일반 Windows E2E 런처 타임아웃. 별도 Windows CDP 검증에서 dedicated 선택과 재실행 후 해당 대상은 읽었지만, 전체 프로필 비교가 JSON 왕복 과정에서 생략되는 `undefined` 옵션까지 비교해 중단됐다. 최종 빌드에서 반복한 Palette 재실행 검증도 창 준비 타임아웃이 발생했다. 저장 파일 보존과 재실행 시 Palette 화면 복원을 구분한다.
- **NOT RUN**. 물리 단일 화면, 125% DPI, 운영 프로필 및 운영 배포.

원격 브랜치는 `origin/codex/beta13-ux-final-01`이다. 제품 커밋과 QA 문서 커밋을 같은 전용 브랜치에 보존한다. 실제 원격 HEAD 및 divergence는 최종 응답에 기록한다.
