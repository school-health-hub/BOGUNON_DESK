# UX-07C 집 PC 인계

## 최종 상태

- 판정: **CONDITIONAL**
- 브랜치: `codex/electron-h6-design-renewal`
- UX-07C 시작 HEAD: `53e49212e4bef7bab3e2e8ff967da598b173d770`
- WIP 제품 Source SHA: `944e34d3f09b79f9ce6d9563b984a0f21faf648c`
- 최종 인계 HEAD: `<HANDOFF_HEAD_PENDING>`
- UX-07D: 시작 금지. UX-07C 실물 검증 3건과 독립 검토가 먼저다.

## 구현된 범위

- 기본 모니터 `workArea`를 사용하는 별도 투명·frameless Desktop Palette BrowserWindow
- `skipTaskbar: true`, `alwaysOnTop: false`, 단일 팔레트 및 Workspace와 독립적인 show/hide 수명
- 별도 sandboxed preload와 제한된 palette protocol
- 기존 TD2 version 1, 12열 geometry, 13개 widget ID, `x/y/w/h/visible` 읽기 전용 투영
- 기존 Workspace 자동 표시와 UX-07B Finance·Newsletter close guard 유지
- 합성 target 기반 투명 gap 입력 통과와 명시적 종료 후 QA 프로세스 정리

구현하지 않은 범위:

- 멀티모니터 팔레트 및 모니터별 프로필
- Desktop-first 자동 시작 전환
- Dock 복제·마이그레이션
- 독립 Settings 창
- widget drag/resize 편집

## 남은 필수 검증

완전 격리 Windows 세션에서 다음 세 항목을 실제 입력과 화면 증거로 확인해야 한다.

1. Workspace를 숨긴 뒤 안전한 기존 TD2 widget action을 native click하여 Workspace가 재표시되는지 확인
2. 실제 작업 표시줄에서 Workspace 항목만 보이고 Palette 항목은 없으며 hide/show 후에도 중복이 없는지 확인
3. 실제 Alt+Tab 목록에서 Workspace만 보이고 Palette가 제외되는지 확인

현재 결과는 세 항목 모두 `NOT RUN`이다. 합성 target gap passthrough PASS는 위 세 항목을 대체하지 않는다.

## R2 차단 원인과 안전 주의사항

- 운영 앱 종료 후에도 정상 사용자 프로필을 사용하는 기존 BOGUNON 백그라운드 서비스가 남아 완전 격리를 증명하지 못했다.
- 새 QA 실행이 기존 인스턴스 또는 일반 프로필과 섞일 가능성이 있어 R2를 중단했다.
- 운영 보건 앱의 미저장 내용은 사용자 승인에 따라 앱 자체 경고의 정상 닫기 절차로 폐기됐다. 강제 종료·저장·복구·데이터 편집은 없었다.
- 초기 UX-07C 검증에서 운영 보건 앱으로 gap click이 전달되어 선택 상태가 바뀌었을 가능성이 있었다. 저장은 실행되지 않았다. 실제 운영 앱이나 바탕화면 아이콘을 click-through 대상으로 다시 사용하면 안 된다.
- 다음 검증은 기존 BOGUNON 서비스와 운영·개인 앱이 없는 별도 Windows 사용자 세션 또는 테스트 PC에서 수행한다.

## 기존 계약 보호

- TD2 version 1, 12열 layout, widget ID 및 원본 저장 문서 변경 없음
- Dock version 2 저장 문서와 기존 Dock 구성 변경 없음
- Finance, SCHOOL, AI, 파일 및 raw IPC를 Palette preload에 노출하지 않음
- 7개 업무 모듈 owner·저장·인증 계약 변경 없음
- 앱 ID와 기존 userData 경로 변경 없음

## 집 PC 복원 절차

집 PC에 다른 작업이 있을 수 있으므로 기존 checkout을 덮어쓰지 않는다. 먼저 상태를 확인한다.

```powershell
git -C <EXISTING_REPO> status --short --branch
git -C <EXISTING_REPO> fetch origin codex/electron-h6-design-renewal
git -C <EXISTING_REPO> worktree add <NEW_WORKTREE_PATH> -b codex/ux07c-home-resume origin/codex/electron-h6-design-renewal
git -C <NEW_WORKTREE_PATH> rev-parse HEAD
git -C <NEW_WORKTREE_PATH> status --short --branch
```

- `codex/ux07c-home-resume`가 이미 존재하면 새로운 로컬 브랜치 이름을 사용한다.
- 기존 dirty checkout에서 `reset`, `clean`, 강제 checkout, rebase를 실행하지 않는다.
- 복원 후 HEAD가 `<HANDOFF_HEAD_PENDING>`인지 확인한다.

## 검증 증거와 Git 외 자료

Git에 포함되는 항목:

- UX-07C 제품 코드와 집중 테스트
- `docs/UX07C_20261112_HANDOFF.md`
- 이 인계 문서

Git에 포함되지 않는 로컬 증거:

- `<QA_ROOT>\UX07C_DESKTOP_PALETTE_20261112\evidence\executor`
- `<QA_ROOT>\UX07C_R1_ISOLATED_WINDOWS_20261112`
- `<QA_ROOT>\UX07C_R2_SAFE_VERIFICATION_20261112`

로컬 복구 패키지:

- `<QA_ROOT>\UX07C_R2_SAFE_VERIFICATION_20261112\checkpoint`
- tracked patch와 모든 untracked UX-07C 원본을 포함하며 원본·복사본 SHA-256 불일치 0건으로 확인됐다.

이 외부 증거와 복구 패키지는 Git push로 집 PC에 전달되지 않는다. 코드 재개에는 원격 WIP commit이 충분하지만 기존 QA 증거의 원본 검토가 필요하면 별도 승인된 수단으로 복사해야 한다.

## 집 PC의 다음 작업

1. 새 worktree에서 WIP commit의 변경 파일과 인계 문서를 확인한다.
2. 제품 코드를 수정하기 전에 완전 격리 Windows 세션 여부를 확인한다.
3. 위젯 클릭·작업 표시줄·Alt+Tab 세 항목만 검증한다.
4. 세 항목 PASS 후 독립 검토를 받고 UX-07C를 PASS로 승격한다.
5. 그 전에는 UX-07D를 시작하지 않는다.

## 원격 상태

- push 결과: `<PUSH_RESULT_PENDING>`
- 원격 divergence: `<DIVERGENCE_PENDING>`
- working tree: `<WORKTREE_STATE_PENDING>`
- 원격에서 복원 가능한지: `<REMOTE_RESTORE_PENDING>`
