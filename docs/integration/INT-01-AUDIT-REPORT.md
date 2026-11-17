# INT-01 — RC2 / DESIGN-07–UX-11 통합 호환성 감사

감사일: 2026-11-18 (Asia/Seoul)
최종 판정: **CONDITIONAL — 별도 통합 후보 구현 단계는 조건부 진행 가능. 현재 제품 통합·출시 GO는 아님.**
이 보고서는 정적 Git/코드 감사다. 실제 merge, merge-tree, rebase, cherry-pick, 제품 수정, 설치, 테스트, 빌드, GUI 실행은 수행하지 않았다.

## 1. 비교 기준과 환경

| 기준 | 정확한 SHA / 원격 ref |
|---|---|
| 감사 시작 | `8fbacface8f8b0d2d431c0256b851cace383b745` / `integration/int-01-rc2-design-audit` |
| RC2 | `162dd2873efa8ac2a42d71d09add130dee0f3d83` / `codex/rc2-logout-integration` |
| DESIGN-07 | `3a207b3e5ff42fd08a3066d968caa6a4af2e1beb` / `design/soft-rose-bento-v1` |
| UX-09 | `d1141bd720f4775c253846bf8b232ca4d7806e49` / `design/ux-09-workspace-customization` |
| UX-10 | `f36a32e5b8e8e2190e60ad3929a0f4b8c388b796` / `design/ux-10-widget-selection-grid` |
| UX-11 | `be3b6ac35dcb07bb2a9976497b39241f343ab411` / `design/ux-11-polish-dpi-qa` |
| 공통 조상 B | `19daed8689e6e06000d6d7367525b89d6abeca53` |

모든 위 원격 branch HEAD는 이번 감사에서 `git ls-remote --heads origin`으로 확인했다. 감사 시작은 UX-11과 제품 내용이 같고 감사 계획 Markdown 하나만 추가된 커밋이다. DESIGN-07 → UX-09 → UX-10 → UX-11 ancestry 모두 exit 0으로 확인했다.

환경은 E:의 새 독립 clone `E:/BOGUNON_DEV/int-01-audit`이다. 기존 저장소의 refs/index/worktree metadata를 사용하지 않는다. 시작 HEAD 정확히 일치, clean 확인. 이 clone 안에서만 RC2 단일 ref를 제한적으로 fetch해 정적 비교 객체를 확보했다. 기존 저장소에서는 fetch/checkout/수정하지 않았다. 새 node_modules, 캐시, 앱 프로필은 만들지 않았다.

관측 자원: C: 약 2.31 GiB, E: 약 813 GiB 여유. 물리 RAM 약 15.71 GiB, 관측 가용 RAM 약 3.84 GiB. 시간에 따라 변하는 스냅샷이며 다음 실행 허가/자원 보장은 아니다. 감사에는 빌드 자원이 필요하지 않다.

## 2. Git 계보와 변경량

`git rev-list --left-right --count RC2...UX11` = **5 / 11**. 서로 조상이 아니므로 **fast-forward 통합 불가**다. DESIGN-07부터 UX-11까지 누적 계보이므로 네 브랜치를 각각 다시 cherry-pick하면 안 된다.

공통 조상 대비 RC2 140경로, UX-11 139경로, 교집합 3경로, 합집합 276경로다. 따라서 RC2 전용 137, UX 전용 136이다. 제품 코드만의 숫자가 아니라 테스트·문서·이미지·아이콘도 포함한다. 양쪽에서 삭제/rename은 발견되지 않았다 (`--name-status --diff-filter=DR`). `package.json`, `package-lock.json`, root `tsconfig.json`, `vite.config.ts`, root `Cargo.lock`, `src-tauri/Cargo.toml`은 양쪽 변경 목록에 없다. 의존성 충돌이 없다는 정적 근거이지 통합 빌드 성공의 증거는 아니다.

### 고유 커밋

RC2 5개:
- `77541dd` Newsletter Studio Electron 연결
- `47183bc` 검토용 pending asset 재연결
- `0cf2c82` Newsletter 테스트 공백 정리
- `38fda49` Newsletter AI runtime protocol 패키징
- `162dd28` 계정 logout 완료 시간 제한

UX-11 11개:
- `e2f5df7` 브랜드 로고
- `ee54f6e` UX-08-1 navigation chrome
- `78bba7c` UX-08-1 review receipt
- `3a207b3` Soft Rose Bento
- `41d37b5` UX-09 scope 문서
- `d1141bd` 업무 도구·위젯 설정
- `f36a32e` 위젯 선택 grid
- `0cf7a3d` UX-11 scope 문서
- `9850930` 직접 편집 시에만 위젯 좌표 저장
- `1af77ab` modal 자동 초기 focus를 기다리는 테스트 보강
- `be3b6ac` 위젯 선택 시각 정리·공유 switch 스타일

## 3. 코드 충돌과 의미상 충돌

아래 범위는 `git diff --unified=0 B SIDE -- path`의 **공통 조상 줄 번호**다. 실제 병합을 하지 않았으므로 확정 conflict marker 목록이 아니라 정적 예상이다.

| 양쪽 수정 파일 | RC2 변경 | UX 변경 | 코드 충돌 예측 / 필요한 결합 |
|---|---|---|---|
| `electron-p0/renderer/P0App.tsx` | B189 NewsletterStudio에 `onOpenAiSettings` 전달 | import/초기 설정 B17–74, 저장 guard B107/116, 도구 dispatcher B158 뒤, header B161, library B171, 설정/도구 B177 | 실제 변경 줄은 비중첩. 텍스트 충돌 가능성 낮음. UX 본문을 유지하면서 RC2 prop 반드시 보존. 파일 전체 ours/theirs 선택 금지. |
| `electron-p0/main/main.mts` | B0 imports, B157 consent, B167/169 AI wiring, B183 QA stores, B334 project authority | B106 BrowserWindow app icon | 비중첩. RC2 IPC/수명주기/보안 wiring 전체와 UX icon 옵션 공존 필요. |
| `electron-p0/builder.json` | B13 뒤 `newsletter-ai-protocol.js` 추가 | B25 뒤 `app-icon.png` 추가 | 비중첩. allowlist에 두 항목 모두 필요. 한쪽 파일 교체 시 packaged runtime 누락 위험. |

**확정된 동일 줄 충돌은 없음. 실제 merge clean 여부는 NOT RUN.** diff hunk 문맥이 가까워도 동일 수정 줄과 동일한 뜻은 아니다. 텍스트가 자동 결합돼도 다음 의미상 위험은 남는다.

- RC2 `protocol.ts`의 필수 `newsletter.ai`, AI text/image model fields와 preload/main/runtime 파일은 하나의 계약이다. 렌더러 UI만 가져오거나 protocol package 항목을 버리면 런타임 실패 가능.
- RC2 P0App의 AI settings callback이 없으면 새 Newsletter production panel의 설정 진입이 약해진다. UX toolbox의 직접 진입은 RC2의 동일 live Newsletter 인스턴스를 사용해야 한다.
- UX의 `settingsBootstrap.ts`는 저장 설정이 없을 때만 Bento를 저장한다. 기존 saved settings는 parse하고 mount 시 다시 쓰지 않는다. logout/session restore와 독립된 로컬 배치가 계정 전환으로 초기화되면 안 된다.
- `restoreWidget`은 visible만 복원한다. 공유 DesktopWidgetLayout은 자동 compaction을 저장하지 않고 완료된 drag/resize만 전달한다. Electron adapter의 button cancel selector 예외도 함께 보존해야 한다.
- UX의 global/workspace CSS 및 header 래퍼가 RC2의 새 Newsletter controls/출력 lock/dialog까지 영향을 줄 수 있다. 별도 화면의 PASS를 합쳐 통합 GUI PASS로 판단할 수 없다.

## 4. 기능별 보존·호환성 매트릭스

정적 신뢰도는 코드 소유/계약 확인 수준이다. 아래 모든 **통합 실행 결과는 NOT RUN**이다.

| 기능 | RC2 계약 / UX 계약 | 통합 보존 조건 | 위험 / 필요한 검증 |
|---|---|---|---|
| 로그인 | RC2 AccountService, PKCE, vault, stale epoch guard. UX SurfaceSettings 학교 프로필 진입 유지 | account service/protocol을 RC2 그대로 보존; 사용자 DTO/계정 vault와 배치 JSON 분리 | P0 후보: 이전 계정 재등장·잘못된 학교 적용 금지. account.test/account-ui + Windows 허가된 별도 로그인 QA |
| 로그아웃 | RC2 `signingOut`, vault 삭제 deadline, 서버 revoke deadline, storageError/temporaryError의 정직한 결과 | 10초 deadline과 재시도·flush 보존, local school/memo/layout 유지 | P0 후보: 정보 재노출/무한 종료 대기. never-resolving vault/revoke, rejected revoke, late login 테스트 필수 |
| 세션 복원 | RC2 initialize/refresh/expiry; UX saved settings와 initial write guard | vault 복원과 화면 boot 동시 실행 때 설정 초기화/추가 write 없음 | P1: cold start, expiry, 계정 전환, 손상 vault/settings, write 실패. 실제 restart 비교 |
| 트레이 숨김/복귀 | Main close는 preventDefault 후 hide 또는 quit, show는 restore/show/focus이며 reload 없음 | hide에 dispose/logout/flush를 옮기지 않음. main icon 추가만 UX 영향 | P1: 연속 hide/show 동안 Finder/Newsletter 원고·계정·메모 유지; 실제 native tray QA |
| 공문 취소 | 초안 close/import/save의 소유권은 OfficialDocumentWorkspace; UX WorkspaceHeader가 기존 close 호출 | dirty confirm 취소 후 원고·preview 유지, busy back disabled, ODT 취소를 성공으로 표시 금지 | P1: official-document-files-ui 및 Windows 실제 file dialog 취소/실패/저장 |
| Record Helper | 기존 소유 request 취소, 삭제/close confirm, 늦은 응답 폐기 | P0App 새 runTool은 같은 Host 열기; 설정/Escape 복귀 시 기존 work 유지 | P1: record-helper-ui, record-helper, file-drop-ui; 합성 학생 자료만 사용 |
| Newsletter 직접 진입 | UX `openNewsletter`, loaded 상태 유지 및 hidden/inert, Toolbox와 About 두 진입 | RC2 NewsletterStudio+onOpenAiSettings 사용, close 때 remount하여 임시원고 손실 금지 | P1: toolbox→새원고→settings→취소→닫기→재진입→원고/이미지 연결 비교 |
| Newsletter 프로젝트/출력 | RC2 revision authority, SHA asset 연결, reference-only는 검토용, busy output modal 잠금 | 출력 승인·복구 승인·AI 후보 commit을 혼동하지 않음; 취소가 원고 교체/출력 승인으로 변하지 않음 | P0 후보: 미승인 자산 출력/권한 우회. project authority/export/output-lock/asset review 테스트 |
| Newsletter AI | Main candidate store/owner+session/project authority/consent/connection router; preload typed bridge | sender 검사·연결 변경 시 후보 무효화·production mock opt-in 차단·no silent API fallback 보존 | P0 후보: 무동의 외부 전송/다른 project 후보 적용. consent/preload/ipc/contract/connection tests; mock만 사용 |
| Soft Rose Bento | UX design-07/ux-09/ux-10 로딩과 design-07-candidate body | layout preset을 기존 저장좌표에 강제로 덮어쓰지 않음. RC2 신규 Newsletter 클래스에도 대비/overflow 확인 | P2 시각, clipping이 기능을 막으면 P1. 신규 computed CSS·실제 GUI 필요 |
| 도구 5그룹/검색 | UX toolDefinitions, ToolboxMenu, P0App runTool | 17개 ID와 switch case 1:1 유지. inventory-qa는 dev-only: 개발17 / production16 표시를 구분 | P1 진입 누락, P2 분류/검색. ux09-toolbox+desktop-utilities-routing+workspace navigation e2e |
| 위젯 13 ON/OFF | 기존 hideWidget/restoreWidget/동일 DashboardLayout 구조 | ID/x/y/w/h/visible/settings 비교. OFF는 데이터 삭제 아님. 재실행에도 저장값 보존 | P1 데이터 손상 후보. shared component+widget-selection-layout+widgetVisibilityPreservation tests, 실제13 토글 |
| 배치·메모 보존 | 자동 compact callback 저장 차단, 직접 drag/resize 저장. PersistentMemoProvider Electron 저장 | 첫 intentional canonical projection과 실제 데이터 파괴를 구분. 일반 frontend memo는 session-only인 현 계약 유지 | P1: 무조작 mount/width/mode에서 write0, drag/resize write1, OFF/ON/restart; settings bytes/필드 비교 |
| Floating Dock | 기존 ID/order/actions + BrandSymbolIcon, bottom-center safe row | 로그인/Newsletter modal보다 아래, focus 복귀·스크롤 마지막 콘텐츠 접근 | P1 가림/키보드 불가, P2 스타일. view/edit·짧은 창·dialog 재진입 GUI |
| 125/150% DPI | UX11의 기존 실제 Windows 증거, renderer zoom1; 물리 work area 제약 존재 | 새 통합 빌드에서 Windows scale/DPI/inner size/outer size를 따로 기록 | P1 잘림 가능. 실제125/150%는 사용자 승인 필요, DPR 시뮬레이션 대체 금지 |
| 빌드·패키징 | RC2 protocol runtime + UX icon/build copy; root lock/scripts 동일 | builder 두 항목 합집합, compiled main/preload/renderer 산출물·license·workers 유지 | P1 패키지 실행불가. build 성공 외 unpacked/asar inventory와 mock/offline cold launch 검증 |

P0/P1은 확인된 통합 버그가 아니라 **실패 시 영향과 수용 게이트**다. 통합 실행이 없으므로 신규 재현 결함으로 확정하지 않았다.

## 5. 파일별 안전한 통합 순서 (이번에는 실행하지 않음)

1. 재개 직전 RC2/UX11 원격 HEAD를 다시 고정하고 위 SHA와 다르면 새 감사. 독립 후보 `integration/int-02-rc2-ux11-candidate`를 RC2에서 만드는 방안을 권장한다. RC2의 계정·IPC·Newsletter 계약을 기반으로 하고 UX 누적 계보를 **한 번만** 통합한다. 이번 INT-01에는 후보를 만들지 않았다.
2. RC2 전용 137경로의 보존 inventory를 먼저 잡는다. 특히 account-service/account-protocol, ai-service/network/vault, newsletter-ai-* 계약·main helpers, preload, protocol, NewsletterStudio와 rendering/schema/assets를 같이 보존한다. 단순 화면 파일만 옮기지 않는다.
3. UX 전용 136경로를 계보 전체에서 검토한다. Brand/WorkspaceHeader, settingsBootstrap, design07Layout, ToolboxMenu, shared layout/switch CSS와 직접 테스트를 함께 가져오는 승인된 통합을 준비한다. 실제 병합 명령/충돌 해결은 별도 승인 단계다.
4. 겹치는 세 파일은 `builder.json` 두 항목 → `main.mts` RC2 전체wiring+UX icon → `P0App.tsx` UX boot/menu/persist+RC2 Newsletter prop 순으로 수동 검토한다. ours/theirs로 파일 전체 선택 금지. 이 순서는 검사 순서이며 세 파일 모두 갖춰지기 전 실행하지 않는다.
5. CSS import 순서 및 workspace 래퍼/hidden/inert/Newsletter busy modal의 결합을 검토한다. saved settings와 empty settings 양쪽을 비교하고 17개 도구 정의/production dev gate를 확인한다.
6. 아래 자동 테스트를 직렬 통과한 동일 후보 SHA에서 실제 Windows GUI 수행. 실패 시 자동 배포/재시도/기본좌표 reset 금지. 제품 통합 GO는 모든 게이트 통과 후 별도 승인한다.

RC2 기준으로 보존하면 검사 기준이 분명하지만 충돌이 사라지는 것은 아니다. UX 기준을 선택해도 세 파일과 계약 합집합을 동일하게 검증해야 한다. 감사 문서 커밋 자체를 제품 기능으로 가져올 필요는 없다.

## 6. 다음 승인 단계 자동 검증 계획

현재 감사에서는 모두 NOT RUN. 이전 UX11 1,063 PASS/0 FAIL/3 SKIP는 **UX11 SHA에서만 유효**하며 RC2와 합쳐진 결과가 아니다. RC2 별도 QA 결과를 이번에 재실행하거나 증거 아티팩트까지 재검증하지 않았다.

실제 package.json에는 `electron:p0:test`, `electron:p0:build`, `electron:p0:test:e2e`가 있으며 lint/typecheck script는 없다. 기존 독립 dependency와 승인된 prepare/Rust 경로를 사용해야 한다. 무조건 release/package script를 실행하지 않는다.

후보 환경 준비 후 명령 예시 (경로/환경은 해당 PC에서 재검증):

```powershell
node scripts/electron-p0/prepare-tests.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.renderer.json --noEmit
node node_modules/typescript/bin/tsc -p electron-p0/tsconfig.tests.json --noEmit
node node_modules/vitest/vitest.mjs run electron-p0/tests src/dashboard src/dock src/components/dashboard/DesktopWidgetLayout.test.tsx src/components/dashboard/WidgetLibraryDrawer.test.tsx src/newsletter --no-file-parallelism --maxWorkers=1 --no-cache
npm run electron:p0:build
git diff --check
```

기존 `electron:p0:test`는 shared component test 두 개와 src/newsletter 전체를 명시하지 않는다. 위 확장 집합을 사용하고 새 test 파일이 발견되면 누락 여부를 검사한다. RC2 `electron-p0/main/newsletter-ai-asset-storage.test.ts` 역시 경로 밖이므로 **별도 집중 실행 또는 전체 프로젝트 suite에 반드시 포함**한다. 테스트 중복 카운트를 합산해 전체 PASS 수를 부풀리지 않는다. 기존 platform skip은 이름으로 비교하고 추가 skip 금지. symlink 관리자 권한은 새 사용자 승인이 필요한 경우 별도 QA 터미널에서만 사용한다. 이번 감사에는 권한 상승 없음.

집중군은 다음 실제 파일/집합을 사용한다:
- `electron-p0/tests/account.test.ts`, `account-ui.test.tsx`, `tray-finder-lifecycle.test.tsx`
- `official-document-files-ui.test.tsx`, `record-helper-ui.test.tsx`, `file-drop-ui.test.tsx`
- `newsletter-authority.test.ts`, `newsletter-projects.test.ts`, `newsletter-export.test.ts`, RC2의 `newsletter-output-lock.test.tsx`, `newsletter-project-controls.test.tsx`, `newsletter-ai-*.test.ts`, `newsletter-chatgpt-adapter.test.ts` (glob 실행 전 실제 파일 목록 확정)
- `settings-bootstrap.test.tsx`, `settings-replacement.test.ts`, `widget-selection-layout.test.tsx`, `ux09-toolbox.test.tsx`, `desktop-utilities-routing.test.tsx`, `td2-workspace-ui.test.tsx`
- `src/dashboard/design07Layout.test.ts`, `widgetVisibilityPreservation.test.ts`, shared DesktopWidgetLayout/WidgetLibraryDrawer 및 RC2 src/newsletter 테스트

추가 통합용 검증 필요: 새 필수 Newsletter bridge를 사용하는 테스트 fixture의 shape, AI settings→Newsletter 복귀, logout과 local settings write 동시성, 새 Newsletter panel의 Soft Rose CSS 대비/keyboard, packaged newsletter-ai-protocol 존재. 현존 테스트의 단독 PASS만으로 이 교차 시나리오를 대체할 수 없다.

## 7. Windows GUI 수용 기준

고정 후보 SHA, 독립 QA profile, 합성 원고/학생/메모만 사용한다. 실제 운영 계정·학생·금융 자료는 쓰지 않는다. 외부 전송 mock과 허가된 auth 테스트를 구분한다. mock 인증으로 실제 production 로그인 PASS를 선언하지 않는다.

- content viewport 1440×900 / 1366×768 / 1280×720 / 980×700, View/Edit, 실제 bounds와 innerWidth/Height를 별도 기록.
- 로그인·timeout/logout·앱 restart, tray hide/show 3회; 로컬 배치/메모/학교 자료가 의도치 않게 삭제되지 않아야 함.
- 공문 dirty close/import/save native cancel 뒤 원고 유지; Record 취소·늦은 응답 폐기·AI settings 복귀.
- 5그룹 검색, 17개 개발 route / 16개 production visible route, Newsletter 직접 진입과 동일 원고 재진입.
- Newsletter project load/save/restore revision, pending asset review/출력 거부, AI consent cancel, connection 변경, output busy lock과 modal focus. 실제 업무 데이터 없이 mock 동작만.
- 위젯13개 OFF/ON, custom geometry와 memo 유지, 직접 drag/resize 저장 1회, 무조작 compaction 저장0회, restart 비교.
- Dock 가림/가로 overflow/한국어 잘림/48px switch/focus 확인. DOM 측정과 캡처가 일치해야 함.
- 실제 Windows125%/150%: 현재 배율·해상도·복원법 기록 후 새 승인. physical work area 한계로 정확 viewport가 불가능하면 대체 크기를 기록하고 해당 exact state는 NOT RUN. 기존 UX11 DPI PASS를 통합 후보 PASS로 이월하지 않음.
- 독립 로컬 packaged/unpacked smoke에서 app-icon, tray, newsletter protocol, worker 경로 확인. 설치/출시/배포는 별도 승인까지 금지.

## 8. 판정과 미검증

**감사 완료, CONDITIONAL.** 고정 SHA와 변경 계약을 확인했으며 통합 후보를 만드는 기술적 경로는 있다. 별도 승인 후 독립 후보에서만 진행할 수 있다. 이번에는 후보 생성도 실제 제품 병합도 하지 않았다.

NO-GO 조건: 원격 기준 변경 미검토, 원본 dirty/index/merge를 건드려야 하는 상황, 계정·권한/취소/데이터 보존 게이트 실패, 필수 protocol 누락, 새 skip으로 회귀 숨김, 합성 fixture로 실제 native/auth PASS 오인. 해당 상황이면 통합을 중단한다.

NOT RUN: 실제 merge 충돌 검사, 통합 TypeScript/테스트/빌드/패키징/GUI/로그인/native DPI, Native Attachment OPTION C. 기존 UX11 raw evidence는 E:에 있으며 이 감사 보고서 push에 포함하지 않았다. Git 동기화는 증거 전체의 cross-PC handoff READY를 의미하지 않는다.

보호: 감사 보고서 하나 외 제품/기존 branch/worktree/main/integration 변경 없음. 기존 dirty Cargo.toml 및 진행 merge를 포함해 44개 기존 경로의 HEAD/status/index/MERGE_HEAD hash를 before/after 비교하여 모두 동일함을 확인했다 (현재 원본 저장소에 등록된 43개 존재 worktree와 UX11 독립 source; 이미 없던 prunable worktree는 변경하지 않음). 앱/서버/QA 프로세스를 시작하거나 종료하지 않았다. 보안 검사는 보고서 전체의 패턴 검사와 직접 검토이며 전용 secret scanner 미설치로 완전성을 보장하지 않는다. 비밀값·개인정보·원본 QA profile/log는 게시하지 않는다.

## 9. 재현 가능한 감사 명령

```text
git ls-remote --heads origin <해당 refs>
git merge-base RC2 UX11
git rev-list --left-right --count RC2...UX11
git log --left-right --cherry-pick --oneline RC2...UX11
git diff --name-status B RC2
git diff --name-status B UX11
git diff --unified=0 B RC2 -- <overlap-path>
git diff --unified=0 B UX11 -- <overlap-path>
git diff --name-status --diff-filter=DR B <SIDE>
git diff --check B <SIDE>
```

B/RC2/UX11은 1절 전체 SHA를 사용한다. 양쪽 `diff --check`는 exit0. 소스 근거는 비교 SHA의 위 경로이며, 다음 부록은 전체 name-status inventory다.

### RC2: B 대비 140경로

```text
M	electron-p0/account-protocol.ts
M	electron-p0/builder.json
A	electron-p0/e2e/newsletter-review-assets.e2e.ts
M	electron-p0/e2e/newsletter.e2e.ts
M	electron-p0/main/account-service.ts
M	electron-p0/main/ai-network.ts
M	electron-p0/main/ai-service.ts
M	electron-p0/main/ai-vault.ts
M	electron-p0/main/main.mts
A	electron-p0/main/newsletter-ai-asset-storage.test.ts
A	electron-p0/main/newsletter-ai-asset-storage.ts
A	electron-p0/main/newsletter-ai-candidate-store.ts
A	electron-p0/main/newsletter-ai-capabilities.ts
A	electron-p0/main/newsletter-ai-composition.ts
A	electron-p0/main/newsletter-ai-connection-router.ts
A	electron-p0/main/newsletter-ai-consent.ts
A	electron-p0/main/newsletter-ai-image.ts
A	electron-p0/main/newsletter-ai-ipc.ts
A	electron-p0/main/newsletter-ai-mock.ts
A	electron-p0/main/newsletter-ai-text.ts
A	electron-p0/main/newsletter-chatgpt-adapter.ts
M	electron-p0/main/newsletter-project-ipc.ts
A	electron-p0/newsletter-ai-bridge.ts
A	electron-p0/newsletter-ai-protocol.ts
A	electron-p0/newsletter-skill-provenance.ts
M	electron-p0/preload/preload.cts
M	electron-p0/protocol.ts
M	electron-p0/renderer/P0App.tsx
M	electron-p0/renderer/adapters/NewsletterOutputControls.tsx
M	electron-p0/renderer/adapters/NewsletterProjectControls.tsx
M	electron-p0/tests/account.test.ts
M	electron-p0/tests/ai-ui.test.tsx
A	electron-p0/tests/newsletter-ai-capabilities.test.ts
A	electron-p0/tests/newsletter-ai-connection-router.test.ts
A	electron-p0/tests/newsletter-ai-consent-integration.test.ts
A	electron-p0/tests/newsletter-ai-consent.test.ts
A	electron-p0/tests/newsletter-ai-contract.test.ts
A	electron-p0/tests/newsletter-ai-image.test.ts
A	electron-p0/tests/newsletter-ai-ipc.test.ts
A	electron-p0/tests/newsletter-ai-mock.test.ts
A	electron-p0/tests/newsletter-ai-preload.test.ts
A	electron-p0/tests/newsletter-ai-qa-composition.test.ts
A	electron-p0/tests/newsletter-ai-text.test.ts
A	electron-p0/tests/newsletter-chatgpt-adapter.test.ts
A	electron-p0/tests/newsletter-output-lock.test.tsx
M	electron-p0/tests/newsletter-project-controls.test.tsx
A	src/newsletter/NewsletterAiProductionPanel.test.tsx
A	src/newsletter/NewsletterAiProductionPanel.tsx
M	src/newsletter/NewsletterStudio.test.tsx
M	src/newsletter/NewsletterStudio.tsx
A	src/newsletter/NewsletterTopicPlanner.test.tsx
A	src/newsletter/NewsletterTopicPlanner.tsx
A	src/newsletter/UserImageImportPanel.test.tsx
A	src/newsletter/UserImageImportPanel.tsx
A	src/newsletter/aiCandidateApplication.test.ts
A	src/newsletter/aiCandidateApplication.ts
A	src/newsletter/applyTopicPlan.ts
A	src/newsletter/monthlyTopicBank.test.ts
A	src/newsletter/monthlyTopicBank.ts
M	src/newsletter/newDocument.test.ts
A	src/newsletter/newsletter-ai-production.css
M	src/newsletter/newsletter-studio.css
M	src/newsletter/output/browserRasterizer.test.ts
M	src/newsletter/output/browserRasterizer.ts
M	src/newsletter/output/svgRenderer.ts
M	src/newsletter/rendering/NewsletterDesignEditor.test.tsx
M	src/newsletter/rendering/NewsletterDesignEditor.tsx
M	src/newsletter/rendering/NewsletterEditorialControls.test.tsx
M	src/newsletter/rendering/NewsletterEditorialControls.tsx
M	src/newsletter/rendering/NewsletterEditorialCopy.tsx
M	src/newsletter/rendering/OfficialElementCopy.tsx
M	src/newsletter/rendering/OfficialTemplateControls.tsx
A	src/newsletter/rendering/StudentArtLibrary.test.tsx
A	src/newsletter/rendering/StudentArtLibrary.tsx
M	src/newsletter/rendering/assetResolution.test.ts
M	src/newsletter/rendering/assetResolution.ts
A	src/newsletter/rendering/assets/students/01-winter-gut.png
A	src/newsletter/rendering/assets/students/02-cold-commute.png
A	src/newsletter/rendering/assets/students/03-antibiotics.png
A	src/newsletter/rendering/assets/students/04-caffeine.png
A	src/newsletter/rendering/assets/students/05-tobacco-refusal.png
A	src/newsletter/rendering/assets/students/06-hotpack.png
A	src/newsletter/rendering/assets/students/cover-students-composition-candidate.png
A	src/newsletter/rendering/assets/students/handwash-composition-candidate.png
A	src/newsletter/rendering/assets/students/ns3e-b-candidate-cover-students.png
A	src/newsletter/rendering/assets/students/ns3e-b-candidate-inner-boiling.png
A	src/newsletter/rendering/assets/students/ns3e-b-candidate-inner-cooking.png
A	src/newsletter/rendering/assets/students/ns3e-b-candidate-inner-handwash.png
A	src/newsletter/rendering/assets/students/ns3e-b-candidate-inner-reporting.png
A	src/newsletter/rendering/assets/students/ns3e-b-framed-cover-students.png
A	src/newsletter/rendering/assets/students/ns3e-b-framed-inner-boiling.png
A	src/newsletter/rendering/assets/students/ns3e-b-framed-inner-cooking.png
A	src/newsletter/rendering/assets/students/ns3e-b-framed-inner-handwash.png
A	src/newsletter/rendering/assets/students/ns3e-b-framed-inner-reporting.png
A	src/newsletter/rendering/assets/students/restore-cover-hero.png
A	src/newsletter/rendering/assets/students/restore-gut-handwash.png
M	src/newsletter/rendering/bundledMascot.ts
A	src/newsletter/rendering/cardHeaderLayout.test.ts
A	src/newsletter/rendering/cardHeaderLayout.ts
A	src/newsletter/rendering/coverTitleFit.test.ts
A	src/newsletter/rendering/coverTitleFit.ts
M	src/newsletter/rendering/designSchema.ts
M	src/newsletter/rendering/designState.ts
M	src/newsletter/rendering/editorialCompiler.ts
A	src/newsletter/rendering/ns02CardLayout.test.ts
A	src/newsletter/rendering/ns03SkillMasterLayout.test.ts
A	src/newsletter/rendering/ns09ActionArt.ts
M	src/newsletter/rendering/renderDocument.ts
M	src/newsletter/rendering/renderScene.test.ts
M	src/newsletter/rendering/renderScene.ts
A	src/newsletter/rendering/skillMasterA4.test.ts
A	src/newsletter/rendering/skillMasterA4.ts
A	src/newsletter/rendering/skillMasterAssetReusePlan.test.ts
A	src/newsletter/rendering/skillMasterAssetReusePlan.ts
A	src/newsletter/rendering/skillMasterCardDesign.test.ts
A	src/newsletter/rendering/skillMasterCardDesign.ts
M	src/newsletter/rendering/skillMasterCompiler.ts
M	src/newsletter/rendering/skillMasterControls.test.tsx
A	src/newsletter/rendering/skillMasterCoverScene.test.ts
A	src/newsletter/rendering/skillMasterCoverScene.ts
A	src/newsletter/rendering/skillMasterEducationArt.ts
A	src/newsletter/rendering/skillMasterLocalIllustrations.ts
M	src/newsletter/rendering/skillMasterPreset.test.ts
M	src/newsletter/rendering/skillMasterPreset.ts
M	src/newsletter/rendering/skillMasterScene.ts
A	src/newsletter/rendering/skillMasterSeries.test.ts
A	src/newsletter/rendering/studentArt.css
A	src/newsletter/rendering/studentArt.test.ts
A	src/newsletter/rendering/studentArt.ts
A	src/newsletter/rendering/studentArtCatalog.ts
A	src/newsletter/rendering/studentArtSources.ts
M	src/newsletter/rendering/useNewsletterAssets.ts
M	src/newsletter/schema.ts
A	src/newsletter/stagedAiProposal.test.ts
A	src/newsletter/stagedAiProposal.ts
A	src/newsletter/studioAssetReview.test.ts
M	src/newsletter/studioDocument.ts
A	src/newsletter/topic-planner.css
A	src/newsletter/userImageImport.test.ts
A	src/newsletter/userImageImport.ts
```

### UX-11: B 대비 139경로

```text
M	DESIGN.md
A	docs/BRAND01_BOGUNON_DESK_LOGO_HANDOFF.md
A	docs/UX08_1_WORKSPACE_NAVIGATION_IMPLEMENTATION.md
A	docs/UX09_WORKSPACE_CUSTOMIZATION_SPEC.md
A	docs/evidence/brand01/official-document-980x700.png
A	docs/evidence/brand01/settings-about-1440x900.png
A	docs/evidence/brand01/workspace-1440x900.png
A	docs/evidence/brand01/workspace-980x700.png
A	docs/evidence/design-07-soft-rose-bento/baseline-image-diff.json
A	docs/evidence/design-07-soft-rose-bento/before-after-image-diff.json
A	docs/evidence/design-07-soft-rose-bento/before-approved-soft-rose-1440x900.png
A	docs/evidence/design-07-soft-rose-bento/build-artifact-manifest.json
A	docs/evidence/design-07-soft-rose-bento/design07-1280x720-edit.png
A	docs/evidence/design-07-soft-rose-bento/design07-1280x720-view.png
A	docs/evidence/design-07-soft-rose-bento/design07-1366x768-edit.png
A	docs/evidence/design-07-soft-rose-bento/design07-1366x768-view.png
A	docs/evidence/design-07-soft-rose-bento/design07-1440x900-edit-hover-focus.png
A	docs/evidence/design-07-soft-rose-bento/design07-1440x900-edit.png
A	docs/evidence/design-07-soft-rose-bento/design07-1440x900-view.png
A	docs/evidence/design-07-soft-rose-bento/design07-980x700-edit.png
A	docs/evidence/design-07-soft-rose-bento/design07-980x700-view.png
A	docs/evidence/design-07-soft-rose-bento/evidence-manifest.json
A	docs/evidence/design-07-soft-rose-bento/evidence-manifest.sha256
A	docs/evidence/design-07-soft-rose-bento/gui-qa-report.json
A	docs/evidence/design-07-soft-rose-bento/independent-visual-review.json
A	docs/evidence/design-07-soft-rose-bento/launch-preflight-6fc90686-c68b-42d1-8fef-9e01cb6beca6.json
A	docs/evidence/design-07-soft-rose-bento/launch-preflight-86867d77-80ec-4268-9add-ef0a509ecd9a.json
A	docs/evidence/design-07-soft-rose-bento/launch-preflight-f266ca7b-5b3b-4689-aca7-e7a56399d20f.json
A	docs/evidence/design-07-soft-rose-bento/qa-summary.json
A	docs/evidence/design-07-soft-rose-bento/security-scan.json
A	docs/evidence/design-07-soft-rose-bento/source-candidate-manifest.json
A	docs/evidence/design-07-soft-rose-bento/startup-probe.json
A	docs/evidence/ux08-1-workspace-navigation/REVIEW_RECEIPT.md
A	docs/evidence/ux08-1-workspace-navigation/manifest.json
A	docs/evidence/ux08-1-workspace-navigation/screenshots/dashboard-dock-1440x900.png
A	docs/evidence/ux08-1-workspace-navigation/screenshots/dashboard-dock-900x680.png
A	docs/evidence/ux08-1-workspace-navigation/screenshots/dashboard-dock-980x700.png
A	docs/evidence/ux08-1-workspace-navigation/screenshots/official-document-1440x900.png
A	docs/evidence/ux08-1-workspace-navigation/screenshots/official-document-900x680.png
A	docs/evidence/ux08-1-workspace-navigation/screenshots/official-document-980x700.png
A	docs/evidence/ux08-1-workspace-navigation/screenshots/settings-1440x900.png
A	docs/evidence/ux08-1-workspace-navigation/screenshots/settings-900x680.png
A	docs/evidence/ux08-1-workspace-navigation/screenshots/settings-980x700.png
A	docs/evidence/ux08-1-workspace-navigation/screenshots/toolbox-1440x900.png
A	docs/evidence/ux08-1-workspace-navigation/screenshots/toolbox-900x680.png
A	docs/evidence/ux08-1-workspace-navigation/screenshots/toolbox-980x700.png
A	docs/evidence/ux09-workspace-customization/validation-manifest.json
A	docs/qa/UX-10-widget-selection-grid.md
A	docs/qa/UX-11-layout-preservation.md
A	docs/qa/UX-11-widget-selection-polish.md
A	docs/ux/UX-11-visual-polish-native-dpi.md
M	electron-p0/builder.json
A	electron-p0/e2e/brand01.e2e.ts
A	electron-p0/e2e/ux08-1-workspace-navigation.e2e.ts
M	electron-p0/main/main.mts
M	electron-p0/renderer/P0App.tsx
M	electron-p0/renderer/SurfaceSettings.tsx
M	electron-p0/renderer/ToolCard.tsx
M	electron-p0/renderer/adapters/GridLayout.tsx
A	electron-p0/renderer/design-07.css
M	electron-p0/renderer/index.html
M	electron-p0/renderer/main.tsx
A	electron-p0/renderer/settingsBootstrap.ts
M	electron-p0/renderer/soft-rose.css
M	electron-p0/renderer/td2-workspace.css
A	electron-p0/renderer/toolbox/ToolboxMenu.tsx
A	electron-p0/renderer/toolbox/toolDefinitions.ts
M	electron-p0/renderer/ui/WorkspaceShell.tsx
A	electron-p0/renderer/ux-09.css
A	electron-p0/renderer/ux-10.css
A	electron-p0/tests/brand-assets.test.ts
A	electron-p0/tests/design-07-style.test.ts
M	electron-p0/tests/desktop-utilities-routing.test.tsx
M	electron-p0/tests/file-drop-ui.test.tsx
M	electron-p0/tests/official-document-files-ui.test.tsx
A	electron-p0/tests/settings-bootstrap.test.tsx
M	electron-p0/tests/td2-workspace-ui.test.tsx
A	electron-p0/tests/ux09-toolbox.test.tsx
A	electron-p0/tests/widget-selection-layout.test.tsx
M	index.html
A	scripts/brand01-assets.py
M	scripts/electron-p0/build.mjs
A	scripts/qa/ux09-workspace-customization.mjs
A	scripts/qa/ux10-widget-selection-grid.mjs
A	scripts/qa/ux10-widget-selection-measure.mjs
A	scripts/qa/ux11-frontend-switch.mjs
A	scripts/qa/ux11-native-window.mjs
A	scripts/qa/ux11-widget-selection-grid.mjs
M	src-tauri/icons/128x128.png
M	src-tauri/icons/128x128@2x.png
M	src-tauri/icons/32x32.png
M	src-tauri/icons/Square107x107Logo.png
M	src-tauri/icons/Square142x142Logo.png
M	src-tauri/icons/Square150x150Logo.png
M	src-tauri/icons/Square284x284Logo.png
M	src-tauri/icons/Square30x30Logo.png
M	src-tauri/icons/Square310x310Logo.png
M	src-tauri/icons/Square44x44Logo.png
M	src-tauri/icons/Square71x71Logo.png
M	src-tauri/icons/Square89x89Logo.png
M	src-tauri/icons/StoreLogo.png
M	src-tauri/icons/icon.icns
M	src-tauri/icons/icon.ico
M	src-tauri/icons/icon.png
A	src/branding/BrandLogo.tsx
A	src/branding/assets/bogunon-desk-logo-original.png
A	src/branding/assets/bogunon-desk-symbol.png
A	src/branding/assets/bogunon-desk-wordmark.png
A	src/branding/assets/brand01-manifest.json
A	src/branding/assets/icons/bogunon-desk-symbol-128.png
A	src/branding/assets/icons/bogunon-desk-symbol-16.png
A	src/branding/assets/icons/bogunon-desk-symbol-24.png
A	src/branding/assets/icons/bogunon-desk-symbol-256.png
A	src/branding/assets/icons/bogunon-desk-symbol-32.png
A	src/branding/assets/icons/bogunon-desk-symbol-48.png
A	src/branding/assets/icons/bogunon-desk-symbol-64.png
A	src/branding/brand-logo.css
M	src/components/dashboard/DashboardCanvas.tsx
A	src/components/dashboard/DesktopWidgetLayout.test.tsx
M	src/components/dashboard/DesktopWidgetLayout.tsx
A	src/components/dashboard/WidgetLibraryDrawer.css
A	src/components/dashboard/WidgetLibraryDrawer.test.tsx
M	src/components/dashboard/WidgetLibraryDrawer.tsx
M	src/components/desktop/DesktopSettingsPanel.tsx
M	src/components/desktop/OnboardingDialog.tsx
M	src/components/desktop/SettingsCenterSections.tsx
A	src/components/workspace/WorkspaceHeader.tsx
A	src/components/workspace/WorkspaceStepBar.test.tsx
A	src/components/workspace/WorkspaceStepBar.tsx
A	src/components/workspace/workspace-step-bar.css
A	src/dashboard/design07Layout.test.ts
A	src/dashboard/design07Layout.ts
M	src/dashboard/layoutTransforms.ts
A	src/dashboard/widgetVisibilityPreservation.test.ts
M	src/dock/dockRegistry.ts
M	src/official-document/OfficialDocumentWorkspace.tsx
M	src/official-document/official-document.css
M	src/styles/components.css
M	src/styles/dashboard.css
```
