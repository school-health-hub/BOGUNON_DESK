# UX-09 — 사용자 선택형 워크스페이스 및 업무 도구 메뉴 개편

## 상태 / 출발점
- 상태: DESIGN APPROVED FOR IMPLEMENTATION PLANNING; PRODUCT IMPLEMENTATION NOT YET VERIFIED
- 기준: `design/soft-rose-bento-v1@3a207b3e5ff42fd08a3066d968caa6a4af2e1beb`
- 독립 브랜치: `design/ux-09-workspace-customization`
- RC2 참조: `codex/rc2-logout-integration@162dd2873efa8ac2a42d71d09add130dee0f3d83` (별도 계보; 병합 금지)
- 목적: 쌤보드식 위젯 선택/숨김과 업무 도구 발견성을 개선한다. DESIGN-07 Soft Rose Glass / Bento / Dock는 유지한다.

## 실제 코드 조사 근거 (DESIGN-07 기준)
- `electron-p0/renderer/P0App.tsx`: `active==='toolbox'`에서 `.p0-tools-grid`에 ToolCard를 직접 나열. onClick에 각각의 실행 경로가 연결되어 있다.
- `P0App.tsx`: `WidgetLibraryDrawer`, `hideWidget`, `restoreWidget` 및 `layout.widgets` 저장이 이미 존재한다. 새 저장 포맷을 만들지 않고 재사용한다.
- `P0App.tsx`: NewsletterStudio는 이미 lazy load되지만 진입은 설정의 `about` 버튼에 숨어 있다.
- `P0App.tsx`: `navigate` 및 `utilityBlocked`의 modal/pending-work 보호 로직을 변경하지 않는다.
- `src/components/dashboard/DesktopWidgetLayout.tsx`: 보이는 위젯만 렌더링하며 GridLayout drag/resize는 편집 모드에만 허용.
- `src/dashboard/design07Layout.ts`: 13개 위젯, 12열 Bento 기본 좌표. notifications는 최초 기본 숨김.

## 승인할 경험 설계

### A. 정보 구조
1. `데스크톱`: 기존 Bento 위젯 화면. 자유 배치·리사이즈·Dock 현행 유지.
2. `업무 도구`: 단순 2열 장문 목록 대신 카테고리 + 검색 + 짧은 실행 카드. 모든 기존 실행 항목을 잃지 않는다.
3. `내 화면 꾸미기`: 위젯 표시 ON/OFF, Dock 표시 항목, 배치·스타일을 한 흐름에서 접근. 기존 `WidgetLibraryDrawer`, `DockEditor`, `AppearancePanel`, `PresetSelector`를 재사용한다. 컨트롤을 중복 생성해 상태가 어긋나지 않게 한다.

### B. 위젯 ON/OFF
- 기존 13개 위젯 ID 및 단일 `DashboardLayout` 설정을 재사용.
- OFF: `hideWidget`; ON: `restoreWidget`에 연결. 내용/메모/업무 데이터 삭제 금지.
- 동일 상태 반복 클릭, 저장 실패, 재실행, StrictMode, 신규 프로필, 기존 사용자 custom geometry, hidden, explicit Reset를 테스트한다.
- 신규 디자인에서 강제 표시·좌표 재정렬 금지. 쌤보드식 설정은 '표시 여부'만 바꾼다.
- ON/OFF와 '로컬 저장/세션 전용/암호화'는 다른 개념. 데이터 보관/보안 동작을 설정 토글로 바꾸지 않는다.

### C. 업무 도구 메뉴
- 카드 제목은 업무 용어, 설명은 사용자 행동 중심으로 1줄. 기술 세부는 접근 가능한 '저장·보안 안내'에 둔다.
- 그룹 초안 (실제 code paths·도구 ID 확인 후 확정):
  - 보건실 업무: 우리 보건실, 보건소식지 제작소, 물품관리, 교육영상 찾기
  - 문서·행정: 공문작업실, 품의 도우미, 학교 행정 도우미, 생기부 도우미
  - 일정·정리: 내 일정, 일정·업무 관리, 빠른 업무 추가, 업무 폴더
  - 빠른 도구: 업무 계산기, 빠른 명령
  - 개인: MY FINANCE
- 메뉴의 실행 버튼은 **기존 onClick을 그대로 호출**하고, 기존 선행 검사·차단·오류 안내·모달 종료 시점도 보존한다.
- 개발용 Inventory QA/preview와 실제 물품관리 항목을 구별해 노출. 숨김/삭제가 기능 소실이 되어서는 안 된다.
- `독립 로컬 일정` vs `일정·업무`는 서로 다른 현재 실행 경로임을 반영. 임의로 합치지 않는다.
- `로컬 저장` `세션 전용` `SQLCipher` 등은 실행 카드 제목에서 빼되, 해당 기능의 실제 데이터 보관 설명은 정확히 남긴다.

### D. 도구 표시 ON/OFF — 두 단계
- 1단계: 기존 도구 전체가 검색·카테고리에서 접근 가능. 즐겨찾기/핀 UI를 제공하려면 별도 사용자 설정 계약 검토 후 처리.
- 2단계: '내 도구' 표시 토글을 추가할 때는 위젯 숨김과 다른 독립 설정으로 설계. 저장 스키마/버전 변경이 필요한지 검토 및 승인 전에는 영속 토글을 임의 도입하지 않는다.
- '숨김' 상태의 기능도 '전체 도구'에서 언제든 복구 가능해야 한다. 기능 실행권한/데이터 삭제와 연결하지 않는다.

### E. Newsletter 발견성
- 기존 `newsletterOpen`, `newsletterLoaded`, `NewsletterStudio` 경로 재사용.
- `보건소식지 제작소`를 '보건실 업무' 상위 그룹의 명확한 실행 항목으로 추가.
- 기존 settings/about 진입도 일단 호환 유지.
- 대화상자/미저장 상태에서 다른 작업 진입 시 기존 보호 동작을 우회하지 않는다. 중복 창 또는 silent discard 금지.

### F. 디자인
- DESIGN-07 Soft Rose Glass 유지; 카드 배경은 대부분 near-opaque, 얇은 경계/절제된 그림자.
- 스크린샷의 반복되는 ↗를 각 카드에 상시 노출하지 않고 하나의 자연스러운 카드 클릭 패턴으로 대체.
- 2열 고정 대신 실제 최소 콘텐츠 너비에 따라 1~3열 반응형. 키보드 탐색/포커스/검색 접근성 확인.
- PC용 Electron 작업 화면 우선. 980×700에서 경로 및 스크롤 사용 가능해야 한다.
- 빈 상태, 미연결, 경고 문구는 사용자 친화적이되 기능 지원 여부를 과장하지 않는다.
- Native WorkerW/Desktop Attachment OPTION C DEFERRED/NOT RUN 유지.

## 구현 순서 및 게이트
1. 이 문서와 실제 소스의 행위/ID 일치 확인, 현재 tool entry 전체 목록을 추출.
2. 아이콘/카피/카테고리 registry를 화면으로부터 분리하되 타입 안전성 및 기존 onClick 보장.
3. 업무 도구 화면의 그룹/검색/카드 레이아웃 구현. 모든 실행 경로 회귀 테스트.
4. 기존 WidgetLibraryDrawer 접근 경로를 '내 화면 꾸미기'로 개선. 13개 위젯 표시/복원 테스트.
5. Newsletter 진입 경로를 추가하고 보존/차단 플로우 검증.
6. 도구 사용자별 영속 ON/OFF는 저장 계약 리뷰 후 별도 구현 승인.
7. 정적 QA: TypeScript, lint, 관련 테스트, diff scope/security.
8. 격리 Windows GUI QA: 1440×900, 1366×768, 1280×720, 980×700; View/Edit/메뉴/모달/키보드.
9. 기존 RC2 계보와 계정/로그아웃/Newsletter runtime/protocol/packaging 차이 검증 후 통합 여부 별도 판단.

## 명시적 금지
- RC2 source/output/profile 변경, 강제 push, main/RC2/integration 병합, 배포.
- Electron Main/preload/IPC, 인증, 업무엔진, 데이터 보안·영속성 계약의 우발적 변경.
- 기존 사용자 위젯 크기/좌표/숨김/Reset 결과 덮어쓰기.
- 도구를 '숨김' 처리하며 데이터 삭제 또는 접근 불가로 만들기.

## 인수 기준
- 모든 기존 tool entry가 기능 경로를 보존하고 검색/카테고리에서 접근 가능.
- 위젯 13개 전부 ON/OFF/재실행 보존, 기존 사용자 레이아웃 불변.
- Newsletter 첫 수준 도구 메뉴에서 발견 가능.
- 디자인은 Soft Rose Bento/Dock와 일관.
- 검증 수치, 캡처, 파일 manifest, 잔여 제한 보고.
