# INT-SWL-02 beta.10 통합 인계

- 날짜: 2026-11-24 (Asia/Seoul)
- 브랜치: `codex/int-swl-02-beta10-integration`
- 기준: beta.10 `b18a68778bcdb1f61fce2a6180a7b42388a21b24`
- SWL-01 제품 커밋: `356bb5358e89811b6ad166ced9b7843024a4b501`
- 통합 커밋: `d6d3f656c5f6b477267502d3c99276c326f4be46`
- 검증 제품 Source SHA: `830e5f072e7b3fbd7e2afe77b893d1e56d1ddea8`
- 판정: **PASS — main 병합·배포는 별도 승인 필요**

## 통합 범위

SWL-01의 20개 WorkAction, 단일 FIELD_VERIFIED 경로, 검색·분류, 즐겨찾기·순서, 최근 실행 기본 OFF, 별도 원자적 저장·복구·revision 보호, `workActionId` 기반 Main 권한 경계를 beta.10에 합성했다. `main.mts`와 `preload.cts` 충돌은 beta.10의 updater, Desktop Palette, 종료·저장 flush, 온보딩, 계정 API를 유지하면서 SmartLauncher store/bridge만 추가하는 방식으로 해결했다.

런처는 `학교 업무 바로가기` 제목과 검색, 업무포털·나이스·K-에듀파인 주요 시스템, 시스템별 접기/펼치기 세부 업무, 즐겨찾기, 접힌 최근 실행 설정으로 간소화했다. 카드의 반복 `UNVERIFIED` 표시는 제거하고 선택한 업무 상세에서만 검증 상태를 표시한다. 검증된 물품 구매 품의 경로는 상세 메뉴 안내에서만 노출된다.

## 검증

- SWL/AdminBridge/preload/계정/Palette 집중 회귀: 12파일, 109 PASS
- SWL 변경 파일 집중 회귀: 6파일, 39 PASS (native fixture 준비 후)
- Electron Main/Renderer/tests TypeScript 및 제품 빌드: PASS
- `git diff --check`: PASS
- beta.10 updater: 서비스 29 PASS, 설치 도우미 3 PASS / 1 TIMEOUT(Windows 합성 실행 파일의 5초 테스트 제한). 통합 코드 결함은 재현되지 않았으며 제품 updater 코드는 변경하지 않았다.
- 기존 SWL-01 합성 주소 네이티브 취소 증거: 재사용 가능. 통합 후 AdminBridge/preload 취소·sender·stale-context 경계 집중 테스트 PASS. 실제 학교 시스템은 NOT RUN.

## 실제 Windows Electron GUI

격리 프로필 `F:\BOGUNON_QA\INT_SWL02_BETA10_INTEGRATION_20261124\runner-temp\playwright-profile`에서 실제 Electron 45.2.1 BrowserWindow를 실행했다. 검증된 Source SHA와 모든 store 경로가 QA root 내부임을 확인했다.

- 1440×900: PASS
- 980×700: PASS
- 900×680: PASS
- 검색 `품의`, 주요 시스템, 상세 접기/펼치기, 물품 구매 품의 메뉴 안내: PASS
- 수평 overflow, 버튼·한글 잘림, renderer/page error: 0
- 독립 시각 검토 2건: PASS. 900×680에서 상단 소개 높이 때문에 세부 업무에 세로 스크롤이 필요하다는 P3 관찰만 존재한다.

증거: `F:\BOGUNON_QA\INT_SWL02_BETA10_INTEGRATION_20261124\GUI-RESULT.json` 및 `screenshots\*.png`. Chromium QA profile은 Git 또는 공개 증거에 포함하지 않는다.

## 보호 결과와 제한

- main, 기존 beta.10 설치본, 기존 worktree, Dashboard/Dock/Workspace 공통 구조는 변경하지 않았다.
- 실제 학교 인증정보·운영 데이터·실제 행정시스템은 사용하지 않았다.
- NSIS·GitHub Release·main 병합·운영 배포·SWL-02는 NOT RUN이다.
- Windows CUA 서비스가 연속 timeout되어 실제 GUI 검증은 저장소의 Playwright Electron 경로로 수행했다. 이는 실제 BrowserWindow·정확한 외부 창 크기·합성 QA profile을 사용했으며 정적 브라우저 mock이 아니다.

다음 단계는 이 브랜치의 원격 SHA를 기준으로 별도 통합 승인 후 제품 버전 후보를 만드는 것이다. 배포 승인 전 updater 설치 도우미의 Windows 5초 timeout을 독립 환경에서 한 번 재확인한다.
