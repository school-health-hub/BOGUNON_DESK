# HOME-HANDOFF-20261127 — 학교 PC에서 집 PC로 인계

**인계 판정 PARTIAL.** 소스와 QA 문서는 Git으로 확인할 수 있다. 집 PC의 실제 복원·실행은 확인하지 않았다. Windows GUI 원본 증거와 로컬 재현 스크립트는 학교 PC에 있다.

## 기준과 상태

- 저장소 `school-health-hub/BOGUNON_DESK`, 브랜치 `codex/popup-ux-implement-01`. 최종 HEAD는 원격 해당 브랜치의 이 문서를 추가한 커밋이다. 아래 fetch와 `git log -1` 명령으로 확인한다.
- 제품 Source SHA `7b879bc3fb3adfb178812c9f85da34993d3b506c`. 운영 beta.14 SHA `242b03e3aa14f1c496dad9ea30b46e77d0a28608`와 구별한다.
- [구현·검증 보고서](POPUP-UX-IMPLEMENT-01.md)와 [감사 보고서](POPUP-UX-AUDIT-01.md)를 포함한다. 미저장 원고 보호와 Soft Rose 확인을 구현했고 TypeScript·Electron build, 집중 테스트 42/42와 위 보고서에 명시한 격리 Windows 항목이 PASS다. Windows 세션 종료와 실제 업데이트 설치는 NOT RUN이며 전체는 CONDITIONAL이다.
- 관련 감사 브랜치 `codex/popup-ux-audit-01`은 HEAD `b4e43d6e83686269c5efb6c21e9bf9d0b1288728`와 원격이 일치한다. 별도 beta.14 후보 worktree의 `release/beta14-candidate-01`도 원격 HEAD `5ff04bc1be681d1df539c60add15c9ed132ed35a`와 일치하며, 해당 worktree의 로컬 미추적 `docs/qa/BETA14-RELEASE-01.md`를 보존했다. 이 보고서는 다음 기능 작업의 실행 의존성이 아니다.

## 원격에 보존한 변경 파일

- `electron-p0/main/main.mts`, `electron-p0/main/pending-decision.ts`, `electron-p0/preload/preload.cts`, `electron-p0/preload/update-preload.cts`, `electron-p0/protocol.ts`, `electron-p0/update-protocol.ts`
- `electron-p0/renderer/P0App.tsx`, `electron-p0/renderer/bridge.d.ts`, `electron-p0/renderer/update/main.tsx`, `electron-p0/renderer/update/update.css`, `src/newsletter/NewsletterStudio.tsx`
- `electron-p0/e2e/dock-settings-handoff.e2e.ts`, `electron-p0/tests/pending-decision.test.ts`, `electron-p0/tests/update-window.test.tsx`, `src/newsletter/NewsletterStudio.test.tsx`
- `docs/qa/POPUP-UX-IMPLEMENT-01.md`, `docs/qa/HOME-HANDOFF-20261127.md`. 기존 업데이트 서비스 테스트와 npm lockfile은 같은 Git 트리에 있다.

## 증거 및 의존성 인계

- 학교 PC worktree `F:/BOGUNON_DEV/source/popup-ux-implement-01`에서만 접근할 수 있는 Windows 원본이다. Git에는 대조용 위치와 해시만 기록한다.
  - `artifacts/popup-ux-implement-01/newsletter-quit.png` — SHA-256 `72c19fbcb41cf7c6f950432457b083e4bf314cb44ef3e3bf9ffaeca6e5d7c338`
  - `artifacts/popup-ux-implement-01/newsletter-save-failure.png` — SHA-256 `2f85d88a5c2f56018fa357f0ea2e8af3558e6abbd6d0e6d2833ef7f4ca7a6ed8`
  - `artifacts/popup-ux-implement-01/update-confirmation-360.png` — SHA-256 `64edd59f9b8595e809df025cd9402ebe86d38a8cfcb570c8a02bde22981b7a32`
  - `artifacts/popup-ux-implement.mjs` — SHA-256 `fc22e73036d5a8bde35ed5924c8272a4b100ec2db6ba17660e7867b9427bfab9`. 로컬 Electron 45.2.1, Playwright, `build/electron-p0-app` 및 매 실행의 임시 합성 프로필을 사용한다. 합성 원고 JSON과 산출물도 이 디렉터리에 있다.
- 감사 원본 캡처는 별도 학교 PC 후보 worktree의 `artifacts/popup-audit-gui/`에 있다. 감사 보고서에 파일별 해시를 기록했다. 실행 프로필, node_modules, 빌드와 로그는 학교 PC 밖으로 복제하지 않았다. 운영 데이터 및 키·계정 설정도 인계에 포함하지 않는다.
- 보존 대상 Git diff와 문서에 자격증명 패턴 검사 및 수동 범위 검토를 적용했다. 패턴 검사로 모든 민감 데이터가 탐지되는 것은 아니다. 로컬 원본은 승인된 별도 전송 전까지 학교 PC에 둔다. 집 PC에서 재개할 때 과거 캡처 원본 비교가 필요하면 승인된 경로로 받아 해시를 확인한다.
- 학교 PC에서 QA Electron 프로세스는 0개다. 운영 beta.14 설치본, 운영 프로필, 기존 GitHub Release는 그대로 두었다.

## 집 PC에서 이어받기

Windows에서 이미 복제한 저장소 루트에서 실행한다. 새 경로가 기존 작업 경로와 겹치면 사용하지 않은 형제 폴더를 고른다. 이 명령은 집 PC에서만 실행한다.

```powershell
git fetch origin refs/heads/codex/popup-ux-implement-01:refs/remotes/origin/codex/popup-ux-implement-01
git log -1 --format="%H %s" origin/codex/popup-ux-implement-01
git show origin/codex/popup-ux-implement-01:docs/qa/HOME-HANDOFF-20261127.md
git diff --name-status 7b879bc3fb3adfb178812c9f85da34993d3b506c origin/codex/popup-ux-implement-01
git worktree add -b codex/windows-lifecycle-01 ../BOGUNON_DESK-windows-lifecycle-01 origin/codex/popup-ux-implement-01
Set-Location ../BOGUNON_DESK-windows-lifecycle-01
git status --short --branch
npm ci
node -p "require('electron')"
npm run electron:p0:build
$env:UPDATE_QA_TEMP = (New-Item -ItemType Directory -Path (Join-Path $env:TEMP ('popup-' + [guid]::NewGuid().ToString('N')))).FullName
node node_modules/vitest/vitest.mjs run --pool=forks --maxWorkers=1 electron-p0/tests/pending-decision.test.ts electron-p0/tests/update-service.test.ts electron-p0/tests/update-window.test.tsx src/newsletter/NewsletterStudio.test.tsx
```

재현 환경은 Node 22.23.3, npm 10.9.9, Electron 45.2.1, Windows x64다. 잠긴 의존성은 `package-lock.json`으로 설치한다. 학교 PC에서의 워커 시작 지연은 집 PC에서 그대로 재현된 것으로 가정하지 않는다.

## 다음 작업 WINDOWS-LIFECYCLE-01

로그인 시 자동 실행은 사용자 선택이며 기본 OFF다. Windows 종료·재시작 시 정상 종료, 트레이·Palette·업무 도구 정리, 미저장 보호와 기존 사용자 설정 보존을 독립 분기에서 검증한다. 먼저 격리 환경에서 세션 종료의 동작과 저장 취소 경계를 재현한다. 운영 beta.14 설치본·운영 자동 실행 설정·운영 데이터 또는 현재 Windows 세션을 시험 대상으로 사용하지 않는다. 학교 PC에서는 이 작업을 시작하지 않았다.
