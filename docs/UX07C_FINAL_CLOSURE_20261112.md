# UX-07C 최종 계약 확인 및 마감 — 2026-11-12

## 최종 판정: PASS

UX-07C 필수 Windows 계약은 모두 충족됐다. 제품 실행 전부터 존재한 빈 Alt+Tab 카드3개의 원본 식별은 아래 비차단 추적 항목으로 분리한다. 그 항목의 미확인은 Palette 제외 PASS의 근거도 아니며 UX-07C 차단 사유도 아니다. 판정 조건을 생략한 것이 아니라, 실제 제품 계약과 무관한 기존 현상을 분리한 결정이다.

UX-07D의 제품 게이트 선행조건은 충족됐다. **착수 가능하나 별도 지시 전 구현하지 않는다.** main 병합·배포·Portable 재빌드 승인이 아니다.

## 기준과 검증 범위

- 저장소 school-health-hub/BOGUNON_DESK, 브랜치 codex/electron-h6-design-renewal.
- 마감 검토 시작 HEAD/origin: 594523c5ffb8b402d1a6c180069ae39163d43b0e, divergence0/0, clean.
- 제품 WIP: 944e34d3f09b79f9ce6d9563b984a0f21faf648c.
- 실제 Windows 검증 실행본 build-meta: sourceSha a96e720e3369bea11c6067745309c749fe523f4f, dirty false. 위 WIP 이후 제품 diff는 없고 문서만 바뀌었다. 새 문서 HEAD로 재빌드했다고 주장하지 않는다.
- 기존 집 PC worktree를 유지했다. 이번 마감에서는 문서만 수정하며 앱 재실행·새 테스트·전체 프로세스 조사를 하지 않았다.

## 필수 계약과 완료 근거

| 계약 | 판정 | 증거 |
|---|---|---|
| 실제 Palette 위젯 영역의 Windows 입력 수신 | PASS | R3 correct-click.json: 날짜 BUTTON에 trusted pointerdown/mousedown/mouseup/click 수신 |
| 기존 컨트롤의 실제 반응 | PASS | Workspace 숨김 상태에서 날짜 버튼 클릭 후 workspace-show, visible/focused 확인 |
| 위젯 클릭의 배경/타 앱 유출 차단 | PASS | 같은 실물 클릭에서 합성 배경 backgroundClicks=[]; 개인/운영 창을 클릭 대상으로 사용하지 않음 |
| 투명 빈 영역 click-through | PASS | R3 gap-click.json: 합성 배경에만 trusted click 전달, Workspace 숨김 유지 |
| Palette 작업 표시줄 제외 | PASS | 사용자 직접 연 그룹에서 Workspace 미리보기1개만 표시; Palette 숨김/재표시 동일, c3980b1 기록 재사용 |
| Palette Alt+Tab 제외 | PASS | R4 7단계 실제 화면과 HWND 대조: Palette 표시/숨김/재표시가 항목을 추가하지 않음 |
| Workspace 표시 및 독립 수명 | PASS | R4 Workspace 숨김에서 실제 Workspace 카드1개만 제거, 재표시에서1개 복귀; Palette HWND 유지 |
| TD2 데이터·ID·geometry | PASS 유지 | 기존 v1/13종/12열 투영 계약, 관련 집중 테스트 및 합성 JSON 해시 일치; 이후 제품 변경 없음 |
| preload/보안 경계 | PASS 유지 | sandbox/contextIsolation, 제한된 Palette/local work IPC, Finance·SCHOOL·AI·파일·raw IPC 미노출; 기존 검증 재사용 |
| 정상 종료 | PASS | 기존 종료 점검에서 제품 및 QA 관측창 정상 종료, 해당 QA Electron 잔여0 |

이 판정은 기존 단일 기본 모니터 Palette 범위다. 13종 위젯 모든 내부 조작을 각각 native 검증했다거나 운영 프로필·새 DPI·다른 PC를 검증했다고 주장하지 않는다. 현재 범위에서 알려진 신규 P0/P1 결함은 없다.

## 위젯 클릭 계약과 UX-07D의 구분

- UX-07C는 기존 TD2 위젯의 view mode 재사용이다. 표시 전용 위젯에는 임의 클릭 동작을 요구하지 않는다. 기존 task/memo 등 내부 컨트롤과 로컬 owner 계약을 보존하되 새로운 layout 편집·drag·resize를 추가하지 않는다.
- 클릭 가능한 안전한 기존 컨트롤은 이미 존재한다. CalendarWidget.tsx:79-87의 날짜 숫자20x20 BUTTON은 PaletteApp.tsx:66-70의 openWorkspace에 연결된다. 따라서 실제 Palette 입력 수신을 생략하거나 UX-07D로 미룬 것이 아니다.
- R3의 교정된 실물 입력(요청좌표568,418; 기록567,418)은 해당 BUTTON에 전달됐다. 이전605,430은 버튼 밖 셀 공백이므로 반응을 기대한 테스트 기준이 잘못됐다. 기존 전후 캡처와 trusted 이벤트/Workspace 상태를 재사용한다.
- UX-07D에서 다룰 Dock 기반 Desktop 진입점·Workspace 실행 흐름/시작 정책은 별도 후속 설계·구현이다. C에 이미 있는 위젯 callback과 혼동하지 않는다. C에서 Dock 복제·개편·Desktop-first 전환·독립 Settings·멀티모니터·신규 위젯·외부 실행 동작을 추가하지 않는다.

## 독립 검토와 증거 무결성

기존 인계의 독립 검토 조건도 이번 마감에서 완료했다. 읽기 전용 리뷰2건이 설계/코드/실물 증거를 각각 확인했으며, 필수 입력·보안·수명 계약에서 누락된 UX-07C 조건을 발견하지 않았다.

- final-widget-contract-review.md: SHA-256 8ab267013134be189c3d2eff9d2564aaac786da52b17d9d221043d8889609c28.
- final-boundary-review.md: SHA-256 612ba2122625fcae22a6f7e9e4d4b8cbd3d061a58c547029f2048747ac95d02e.
- 기존 R3 매니페스트24건/R4 매니페스트29건을 먼저 대조했고 크기·SHA 불일치0이었다. 리뷰 파일은 기존 R4 증거 디렉터리에 추가 보존한다.
- 기존7 files/16 tests, TypeScript 및 Electron production build PASS를 동일 제품 소스의 결과로 재사용했다. 이번에는 반복 실행하지 않았다. 문서 변경의 git diff --check는 커밋 전 확인한다.

## 비차단 별도 추적: EXISTING-SHELL-ALTTAB-01

상태: **OPEN / 원본 HWND·생성 원인 NOT VERIFIED / UX-07C 비차단**. 별도 GitHub 이슈를 생성한 것으로 표시하지 않으며 이 문서의 독립 추적 항목으로 보존한다.

제품 미실행 상태부터 빈 BOGUNON 카드3개가 있고, R4 전7상태에서 그대로다. 실제 Workspace 카드만 정확히 추가/제거되며 Palette는 추가0이다. 빈 카드3개를 Palette·Dock·QA 창·특정 helper HWND 또는 악성/손상 상태로 단정하지 않는다. 지원되는 UIA/MSAA는 Shell container까지만 노출했다. 향후 그 현상 자체를 다루라는 별도 지시가 있을 때만 기존 R4 증거로 이어가며, 이번 마감에서 광범위한 Windows 조사를 시작하지 않는다.

상세 원본 기록: [R4 단계별 조사](UX07C_R4_ALTTAB_FINAL_20261112.md), [R3 native 입력 및 taskbar](UX07C_R3_WINDOWS_DIAGNOSTIC_20261112.md). 당시 CONDITIONAL은 역사적 판정으로 보존하며 현재 판정은 본 문서가 우선한다.

## Git 및 인계

최종 문서 커밋은 git log -1 -- docs/UX07C_FINAL_CLOSURE_20261112.md로 확인한다. 일반 push 후 origin HEAD 일치, divergence0/0, working tree clean을 세션 완료 보고에서 확인한다. 제품 코드 변경 없음. UX-07D는 아직 시작하지 않았다.

증거 원본은 E:/BOGUNON_DEV/qa-output/UX07C_R3_20261112 및 UX07C_R4_20261112에 보존한다. 공개 Git에는 비민감 Markdown만 올린다. 전용 secret scanner 미설치로 의도된 Markdown 전체에 대한 수동/패턴 검사를 적용한다. 원본 캡처의 승인된 온라인 이전은 없으므로 **원본 증거까지 포함한 다른 PC 인계 READY를 주장하지 않는다**. 이는 UX-07C 제품 PASS와 별개의 원본 증거 접근 제한이다.
