# BOGUNON DESK beta.4 P2 학교 PC 후속 검증

검증일: 2026-11-23. 대상은 `codex/beta4-weekly-widget-p2`의 `14ea35cb8875a0b899e3583a89c9944daafcc000`에서 분기한 독립 작업 브랜치다. 이 문서는 설치된 beta.4의 전체 기능 승인이 아니라 새 소스 빌드에서 미완료였던 흐름의 집중 검증 기록이다.

## 계보와 보호

- 원격 P2 HEAD `14ea35cb8875a0b899e3583a89c9944daafcc000`을 확인했다. `696fd4f`의 학교 beta.4 Palette·Inventory 작업을 포함하며, 마지막 커밋은 `electron-p0/renderer/design-polish.css`와 `electron-p0/e2e/weekly-widget-layout.e2e.ts`의 주간 일정 P2 변경이다. 따라서 두 파일을 중복 적용하지 않았다.
- 새 작업 경로: `C:\Users\sehwa\.codex\worktrees\beta4-p2-school-qa\source`, 브랜치 `codex/beta4-p2-school-continuation`.
- 기존 `release-final-palette` worktree는 HEAD `904a45e3cdefff44759211b61e4803c4430a4c41`와 미커밋 3개 파일을 유지했다. 메인 저장소의 기존 미커밋 14개도 정리하지 않았다. 설치된 beta.4, 실사용 프로필, 다른 worktree는 변경하지 않았다.
- 설치된 앱은 이번 새 소스의 검증 실행본으로 사용하지 않았다. QA는 별도 `ELECTRON_P0_TEST_RUN` 프로필에서 실행했다.

## 이번 결과

| 범위 | 결과 | 실제 확인 |
| --- | --- | --- |
| Inventory | PASS | 합성 물품 등록, 입고 2개, 저장, Electron 재실행 후 수량과 이력 복원. 기존 `inventory.e2e.ts` 1/1. |
| 교육영상 Finder | PASS | 외부 검색 없이 합성 Mock 영상 선택, 안내문·메모 로컬 저장, 재실행 후 항목·메모·교육 일정 복원. 신규 `finder-local-persistence.e2e.ts` 1/1. |
| 보건소식지 제작소 | PASS | 합성 원고와 승인 합성 이미지의 로컬 미리보기, JSON 저장·재열기, A4 PNG/PDF 및 카드 PDF/PNG 출력 검사. `newsletter.e2e.ts` 1/1. 제품 문구 변경에 따른 기대값과 느린 학교 PC의 120초 테스트 제한만 수정했다. |
| 주간 일정 P2 | PASS | 4개 창 크기, View/Edit에서 월~일 표시·스크롤 영역·가로 overflow 0과 기존 좌표 파일 불변. 기존 P2 E2E 1/1. |
| Electron 빌드 | PASS | P2 소스에서 `npm run electron:p0:build`; 출력은 F: 격리 빌드 폴더. |
| TypeScript | PASS | Electron main, renderer, tests 설정 각 1개씩 3/3. |
| 집중 Vitest | PASS | Finder V2 UI 및 Newsletter export 15/15. |
| 전체 회귀·설치본 업데이트·패키징 | NOT RUN | 이번 요청 범위 밖. 홈 PC P2 증거를 학교 PC 원본으로 간주하지 않았다. |

첫 Inventory GUI 실행에서 `zod`를 찾지 못한 것은 F: 격리 빌드 경로의 Node 의존성 탐색 문제였다. QA 출력의 `node_modules` 연결을 검증된 F: 의존성으로 지정해 해결했다. Finder의 초기 자동화 실패는 필수 안내사항 누락과 잘못된 화면 표시 기대값이었고, 수정 후 PASS했다. 보건소식지의 초기 자동화 실패는 안내 문구 기대값과 학교 PC 실행 시간 제한이었으며, 기대값·제한 수정 후 출력까지 PASS했다. 제품 소스 결함으로 분류하지 않는다.

## 비 Git 증거와 복원

학교 PC 증거 원본: `F:\BOGUNON_DEV\beta4-p2-school-qa-20261123\handoff-evidence`. 합성 출력과 캡처 6개는 이 폴더의 SHA-256 매니페스트로 검증한다. 빌드 출력, 임시 QA 프로필, Electron 캐시는 기기별 재생성 대상으로 분류한다. 설치 실행 파일은 이번 작업에서 생성하지 않았다. 이전 홈 PC 캡처·로그는 원격에 있다고 가정하지 않는다.

집 PC에서는 원격 `codex/beta4-p2-school-continuation`을 새 폴더에 clone한 다음 `git rev-parse HEAD`, `git status --short`, 아래 인계 증거의 SHA를 확인한다. `npm ci`가 필요하면 집 PC의 검증된 의존성 환경과 잠금 파일을 우선 대조한다. 검증 명령은 `npm run electron:p0:build`, `npx tsc --noEmit -p electron-p0/tsconfig.tests.json`, `npx playwright test --config electron-p0/playwright.config.ts finder-local-persistence.e2e.ts --workers=1`이다. 실제 GUI 재검증에는 독립 `ELECTRON_P0_QA_ROOT`와 해당 PC의 검증된 Electron 바이너리가 필요하다. 기존 설치본·프로필을 테스트 대상으로 자동 전환하지 않는다.

## 보안과 다음 단계

증거는 합성 영상·원고·이미지만 포함한다. 인증 프로필, 토큰, 학교 문서, 실제 학생정보는 인계하지 않는다. 저장된 SHA 매니페스트와 비공개 Drive 폴더의 문서를 받은 PC에서 재확인한다. 다음 승인 작업은 beta.4 P2를 후속 배포 후보에 포함할지 결정하고, 그때 새 제품 패키지의 실제 GUI와 업데이트 호환성을 별도로 검증하는 것이다. 설치된 beta.4는 이번 검증에서 그대로 유지했다.
