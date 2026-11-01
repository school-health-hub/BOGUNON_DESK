# ELECTRON-P0: Dashboard + Dock

PoC 전용입니다. 운영 앱·로그인·학생 자료·금융 DB·업데이트 채널에 연결하지 않습니다. Windows 바탕화면 부착, 독립 Dock, 네이티브 셸 조작, 업무 기능 이전은 범위 밖입니다.

## 기준 및 보존

- 구현 브랜치: `feature/electron-p0-dashboard`
- 원격 main: `a7717f1e1b2234a568f8877adae8c42f8a4d262b`
- 기존 로컬 `work`: `5cec64358436c148710499b5aa9d2e78c34e0136` 그대로 보존.
- 아래 원격 브랜치는 기준만 기록하며 merge/cherry-pick/변경하지 않습니다.

| 브랜치 | 확인한 전체 SHA |
| --- | --- |
| feature/my-finance-phase1 | 392b3dc0089eaa30de94ea886e8dd38e470be1dc |
| feature/my-finance-phase2 | 1b6a1383d93c649d448097991ffa2f86a467bde0 |
| feature/my-finance-ui-2 | a1be5531c383aeb90dce110109bf45539df986a1 |
| feature/newsletter-studio | 7e7336b0bf1bd8adf75710e85290e4cdfc7a8813 |
| feature/inventory-management | 613837eabc37b8c4f9484ac3fec19607f84bc178 |
| feature/official-document-enhancement | 98a7770157a4a845c947f220652f95f4f3db9066 |
| feature/purchase-helper-enhancement | 7263ef568fed3eea6da5dd108d8bc046bf926d34 |
| feature/desktop-surface-c2d2-renderer-session | 1574e463f0c69a12507a726590971f334834bc44 |
| release/td2-finance2-candidate | 7b0e82f91178d535411f5ca0e6d05ea523d65a07 |

`src/`와 `src-tauri/`는 기준 main과 동일합니다. 기존 worktree는 변경하거나 추가하지 않습니다.

## 재사용 범위

기존 DesktopWidgetLayout, WidgetFrame, 13개 위젯, DashboardToolbar, WidgetLibraryDrawer, PresetSelector, AppearancePanel, AppDock, DockEditor, 배치/프리셋/geometry와 다섯 CSS를 그대로 사용합니다. 기존 DashboardCanvas는 업무·인증 Provider 전체를 연결하므로 PoC는 같은 표시 컴포넌트를 가벼운 P0 컨트롤러로 조합합니다. 새 디자인을 만들지 않습니다. 원본 Grid의 blanket `button` drag-cancel과 버튼형 이동 손잡이의 충돌은 PoC 전용 Grid 어댑터에서 손잡이만 취소 대상에서 제외합니다. 원본 컴포넌트 파일은 수정하지 않습니다.

전용 Vite 설정에서 workspace/meal/weather 데이터와 desktop action 경계만 빈 합성 어댑터로 교체합니다. 운영 데이터 모듈을 fake Tauri API로 흉내내지 않습니다. 빌드 시 Tauri/Supabase/auth/AI/금융/구매/공문/생기부 모듈 유입을 거절하고 `p0-renderer-boundary.json`에 재사용 모듈 목록을 기록합니다. 실제 로그인 버튼·금융 진입점은 없고 Dock 외부 동작은 범위 제외 안내만 표시합니다. 빠른 메모는 세션 메모이며 업무로 전송하지 않습니다.

## 격리와 보안

- App ID: `kr.sungandi.schoolhealthdesk.electronp0`
- 제품명: `BOGUNON DESK ELECTRON P0`
- userData: Electron `appData` 아래 **BOGUNON-DESK-ELECTRON-P0**. Windows에서는 일반적으로 `%APPDATA%\BOGUNON-DESK-ELECTRON-P0`.
- 설정: 위 경로 아래 `poc-settings/layout.json`만 읽고 씁니다. Chromium 데이터도 이 PoC 루트의 `chromium` 아래입니다.
- 실제 Tauri ID·금융 DB·DPAPI 키·계정 설정을 검색/가져오기/복사하지 않습니다.
- 패키지는 portable EXE입니다. 운영 설치 경로를 사용하거나 설치/제거하지 않습니다. 자동 업데이트·autostart·트레이·딥링크 등록 없음.
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`. preload는 sandbox/context isolation을 확인한 경우에만 브리지를 노출합니다. 보안 해제 플래그는 앱에서 거절합니다.
- preload API는 `info()`, `readSettings()`, `writeSettings(settings)` 세 개뿐입니다. 범용 invoke/send, 경로 인자, shell, 파일 대화상자 API 없음.
- IPC는 정확한 창·메인 프레임·로컬 URL을 검증합니다. 설정은 layout/dock 구조만 허용하고 추가 필드·중복·잘못된 좌표를 거절합니다. 쓰기는 직렬화·flush·원자적 rename으로 처리합니다. 읽기 실패 시 원본을 보존하며 자동 초기화하지 않습니다.
- 외부 네트워크·다운로드·새 창·navigation·webview·권한 요청을 차단합니다. 개발 모드만 `127.0.0.1:5174`의 전용 Vite origin을 허용합니다.
- E2E는 PoC 루트의 `test-runs/<UUID>`만 사용합니다. 사용자 지정 임의 경로는 받지 않습니다.

## 개발·빌드

Node 24, 잠금 파일 사용. 운영 계정/환경 변수는 필요 없습니다.

```sh
npm ci
node node_modules/electron/install.js --no
npm run electron:p0:build
npm run electron:p0:start
```

HMR: `npm run electron:p0:dev` (전용 포트 5174). 패키지: `npm run electron:p0:package:win` (Windows x64 portable), `npm run electron:p0:package:linux` (Linux unpacked). 패키지는 `release-electron-p0/`에 생성됩니다. 개발 소스와 PoC 메타데이터에 dirty 여부를 기록하므로 정식 검증은 커밋된 동일 SHA의 CI 결과로 확인합니다.

프록시 기반 Cloud의 공식 Electron 다운로드에는 Node 24의 `NODE_USE_ENV_PROXY=1`이 필요할 수 있습니다. npm cache는 쓰기 가능한 작업 경로로 지정할 수 있습니다. TLS/체크섬 검증은 끄지 않습니다. sandbox를 실행할 수 없는 호스트에서는 `--no-sandbox`로 우회하지 말고 GUI 검증을 NOT RUN으로 보고합니다.

## 검증

```sh
npm run electron:p0:test
npm run electron:p0:build
npm test -- --maxWorkers=4
npm run build
npm run electron:p0:test:e2e
```

E2E는 실제 Electron 프로세스를 사용하며 **chromiumSandbox: true**를 명시합니다. 기존 Dashboard/Dock, 제한된 브리지, 내부 이동, drag/resize/hide, 스타일 변경, 잘못된 IPC 입력 보존, 종료·재실행 후 설정 복원 및 새 창 차단을 검사합니다. Electron 실행이나 UI 조건을 검증하지 못한 항목은 PASS로 표시하지 않습니다.

Windows CI는 전용 브랜치 push와 수동 실행만 지원합니다. 원본 소스 보존 → TypeScript → 전체 JS 회귀 → 기존 프런트엔드 빌드 → Windows portable 패키징 → **win-unpacked의 실제 패키지 앱** E2E → EXE SHA-256/서명 상태 기록을 수행합니다. 실패하면 EXE 업로드 단계는 실행되지 않습니다. 실제 PC에서 portable EXE를 더블클릭하는 검사, 설치 정책, 실제 모니터·접근성·시각 승인·성능은 별도 NOT RUN 항목입니다.

Actions artifact는 `ELECTRON-P0-Windows-<SHA>`이며 운영 배포나 기존 MY FINANCE TESTABLE 인증이 아닙니다. 서명 상태·SHA·검증 SHA는 `P0-BUILD-RESULT.json`과 `SHA256SUMS.txt`로 확인합니다. PR 생성·main 병합·운영 배포는 별도 사용자 승인 전 금지합니다.

## ELECTRON-P1A: 사용자별 설치

기준 `0b2f49503c7bcc2bedeb9988bd5cef6b11982829`, 전용 브랜치 `feature/electron-p1a-windows-installer`. P0 회귀 결과는 Actions `41236999963`을 재사용하며 변경 없는 전체 JS/업무 테스트를 반복하지 않습니다. 기존 portable npm 명령은 유지합니다. 두 형식 빌드는 기존 build 후 `electron-builder --config electron-p0/builder.json --win portable nsis --x64 --publish never`입니다.

NSIS는 사용자별 assisted 설치이며 elevation과 설치 경로 변경을 허용하지 않습니다. 기본 설치 경로는 `%LOCALAPPDATA%\Programs\BOGUNON DESK ELECTRON P0`, 시작 메뉴/제거 목록 이름은 `BOGUNON DESK ELECTRON P0`입니다. Portable과 설치 버전은 동일 PoC ID와 설정을 공유하므로 동시에 별도 인스턴스로 실행하지 않습니다. 운영 Tauri ID/경로/레지스트리에는 접근하지 않습니다. 커스텀 NSIS 스크립트나 데이터 삭제 명령은 없습니다. 제거 시 `%APPDATA%\BOGUNON-DESK-ELECTRON-P0`를 보존합니다.

P1A CI는 빌드/두 패키지 생성/기존 실제 패키지 GUI E2E를 실행합니다. 러너 토큰의 Administrator 활성 여부와 Windows 버전을 기록합니다. **승격된 러너에서는 설치/설치 앱 GUI/제거를 NOT RUN, 최종 CONDITIONAL로 기록**하며 토큰 변경·권한 우회를 하지 않습니다. 일반 사용자 러너에서는 기존 PoC 설치/프로필이 없을 때만 설치하고, 기존 E2E를 설치 앱에 재사용하여 합성 test-runs 설정의 재실행 복원을 검증한 뒤 제거 및 파일 보존을 검사합니다. 결과는 `P1A-QA-RESULT.json`에 남으며 CI green만으로 설치 검증 PASS를 뜻하지 않습니다. 실패는 BLOCKED입니다.

산출물은 Portable EXE와 별도 `BOGUNON-DESK-ELECTRON-P0-Setup-0.0.1-x64.exe`, 파일별 SHA-256/서명 상태 및 QA 결과입니다. 미서명 파일은 Windows 경고가 발생할 수 있습니다. 운영 배포·업데이트가 아닙니다.

실제 Windows PC 수동 QA (합성 데이터만):
1. 일반 사용자로 Setup 실행: 승격 요청 없이 전용 경로/시작 메뉴/제거 목록 확인.
2. Tauri 운영 앱과 Electron을 함께 실행: 종료/설정/단일 인스턴스 충돌 여부 확인. 기존 DB는 열거나 복사하지 않음.
3. 위젯/Dock 변경 후 정상 종료·재실행: 저장 복원 확인.
4. Windows 앱 목록에서 Electron P0만 제거: 실행 파일 제거와 PoC 설정 보존 확인.
5. 운영 앱 정상 상태 확인 후 Electron 재설치: 이전 PoC 설정 복원 확인.

## ELECTRON-P1B: 창과 트레이

기준 P1A `796ed5159b6ecea8113f4a3851d3a7fc4c44f6d7`, 브랜치 `feature/electron-p1b-desktop-experience`. React/Dock/Tauri 및 preload IPC는 변경하지 않습니다. 기존 원자적 저장 클래스를 재사용하여 동일 PoC `poc-settings/desktop.json`에 창의 일반 위치/크기, 최대화 상태, 닫기 동작만 저장합니다. layout.json과 독립적입니다. 저장 파일 손상 시 안전한 기본값으로 시작합니다. 저장 실패나 트레이 생성 실패 시 닫기는 완전 종료로 되돌아갑니다.

기본 X는 저장을 마친 뒤 완전 종료입니다. 네이티브 `창` 메뉴의 `닫을 때 트레이로 숨기기`를 사용자가 선택한 경우에만 숨깁니다. 트레이 메뉴는 창 열기·최소화·닫기 설정·완전 종료를 제공하며 더블클릭/두 번째 실행도 창을 복원합니다. 완전 종료 메뉴와 OS 종료 요청은 트레이 선택과 관계없이 종료합니다. 창 이동/크기 이벤트는 debounce하고 종료 시 최종 상태를 저장합니다.

모니터 추가/제거/해상도/배율 변경 시 Electron의 DIP workArea 기준으로 가장 많이 겹치는 모니터에 창을 맞춥니다. 해당 모니터가 없어지면 사용 가능한 모니터 영역으로 이동하며 창 크기도 작업 영역 이내로 줄입니다. 최대화 복원도 지원합니다. Windows 실제 다중 모니터 핫플러그/혼합 DPI/작업표시줄 트레이 표시·실제 마우스 조작은 수동 QA입니다.

검증은 기존 P0 GUI에 창 위치/크기 재실행, 네이티브 메뉴 선택·숨김·복원·기본 X 종료를 추가하고, Windows에서는 최소화/복원을 추가합니다. Cloud Xorg에는 Windows 셸/창 관리자가 없으므로 Windows 최소화·실제 트레이 표시를 PASS로 표시하지 않습니다. 단위 테스트로 보조 모니터 제거/음수 좌표/작은 작업영역(배율 변화 포함)을 시뮬레이션합니다. 새 프레임워크나 전체 업무 회귀 실행은 필요하지 않습니다. P1A 사용자별 NSIS/portable·제거 시 데이터 보존 설정은 유지하며, 승격된 CI의 설치 검증 NOT RUN 제한도 그대로입니다.

## ELECTRON-P2D-3: Electron 프로젝트 revision

- 기준: `e9980aa5c8ff6870302de6111b24eff366937fc9`; 브랜치 `feature/electron-p2d3-newsletter-revisions`.
- Windows 저장 위치: `%APPDATA%\BOGUNON-DESK-ELECTRON-P0\work-data\newsletter-projects\<projectId>.json`. 프로젝트별 파일에 원고·디자인 JSON과 SHA-256 연결 revision을 보관합니다. 최대 100 revision/64 MiB이며 이미지 원본은 포함하지 않습니다. Dashboard 설정·빠른 메모·외부 JSON 파일·Tauri 저장소와 분리합니다.
- JSON 열기는 내부 프로젝트 연결을 해제합니다. 같은 ID가 이미 저장되어 있으면 새 프로젝트 저장으로 덮어쓰지 않고 충돌을 반환합니다. 내부 저장은 현재 head의 revision/hash가 일치해야 하며 작업은 직렬화합니다. 저장 직전 파일을 다시 검사하고 기존 원자적 파일 교체를 재사용합니다.
- 과거 revision은 읽기 전용으로 미리 봅니다. 미리보기 token과 현재 head가 일치할 때만 main의 명시적 확인 후 새 revision으로 복구합니다. 과거 revision은 보존하며 복구 출처를 기록합니다. 미리보기·취소는 파일을 변경하지 않습니다.
- 저장 이력에 기록된 출력 제한은 복구 후보에도 유지합니다. 복구나 내부 저장으로 `pending` 자산의 출력 승인을 부여하지 않습니다. 기존 수달 정책과 출력 검증은 유지합니다. 불러오기·복구 후 필요한 이미지 원본은 SHA-256으로 재연결합니다.
- 손상된 revision/hash chain, 잘못된 경로, symlink, 오래된 head/token은 차단합니다. 손상 파일을 자동 초기화하거나 자동 복구하지 않습니다. 실패 시 기존 파일을 보존합니다.
- 이번 단계 검증: TypeScript/PoC 빌드 PASS, 관련 자동 테스트 195개 PASS(저장·재열기·revision·복구·충돌·저장 실패·손상·출력 제한·컴포넌트 동작).
- **이번 GUI QA: BLOCKED / NOT RUN.** 실행 도구 요청이 반복 중단되었고 최종 점검에서 GUI 프로세스가 없었습니다. 이전 P2D2 GUI PASS는 이번 변경사항의 GUI 검증으로 대체하지 않습니다. Windows 패키징·실기기 QA도 이번 단계에서 재실행하지 않았습니다. 실제 편집기·이미지 재연결·재실행 복구·기존 출력 GUI 회귀는 미검증입니다.

## Newsletter Studio Electron 1차 이전 종료·통합 인계

**최종 판정: CONDITIONAL.** 기능 개발은 여기서 종료합니다. 구현 종료 브랜치는 `feature/electron-p2d3-newsletter-revisions`, 기능 코드 기준 SHA는 `96efa349306fa4c34f84893d1fb613ea0677e9f2`입니다. 이후 문서 전용 커밋은 기능 검증 기준 SHA를 변경하지 않습니다.

| 단계 | 구현 범위 | 구현 체크포인트 |
| --- | --- | --- |
| P2-D-1 | 기존 편집기·Scene/SVG·디자인·자산 재사용, JSON 열기/명시적 저장, 이미지 SHA-256 재연결 | `ac31d15cfd49820925776f2b1fd0a0a46200bab4` |
| P2-D-2 | 원본 PNG/PDF 엔진을 main 소유 격리 창에서 검증·생성, 출력별 main 확인과 위치 선택, 안전한 파일/새 카드 묶음 폴더 저장 | `e9980aa5c8ff6870302de6111b24eff366937fc9` |
| P2-D-3 | Electron 내부 프로젝트 저장/불러오기, revision 조회·읽기 전용 미리보기·확인 복구, 충돌·손상·저장 실패 보호 | `96efa349306fa4c34f84893d1fb613ea0677e9f2` |

### 저장·승인 경계

- 내부 원고는 위 P2D-3의 PoC 전용 `work-data/newsletter-projects/<projectId>.json`에 저장합니다. 외부 JSON 저장과 내부 프로젝트 저장은 별도입니다. 이미지 원본은 포함하지 않으며 불러오기·복구 후 재연결할 수 있습니다.
- Tauri 원고 저장소·출력 원장·운영 DB·계정·MY FINANCE에는 접근하거나 자동 이관하지 않습니다. 기존 Dashboard·Dock·빠른 메모·트레이·창 복원·Portable/NSIS 구성을 보존합니다.
- 수달의 `exportApproval: pending`을 유지합니다. 원고 저장·JSON 저장·revision 복구는 출력 승인을 부여하지 않습니다. 출력은 별도의 검증과 main 확인을 거치며 범용 파일 경로/쓰기 IPC는 노출하지 않습니다. WIP 디자인을 최종 승인 디자인으로 간주하지 않습니다.

### 검증 상태와 남은 실기기 확인

- 코드 기준 SHA의 TypeScript/PoC 빌드와 관련 자동 테스트 **195 PASS**. 이번 문서 정리에서는 테스트를 재실행하지 않았습니다.
- **P2-D-3 GUI: BLOCKED / NOT RUN.** 실행 요청이 반복 중단되어 실제 GUI 검증이 시작되지 않았습니다. 이전 [P2-D-2 Windows 패키징·GUI PASS](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41271842095)를 이번 변경의 GUI PASS로 대체하지 않습니다.
- 미검증: 실제 편집기에서 내부 저장·앱 재실행·revision 미리보기/복구, 복구 취소·충돌 안내, 이미지 미보유/재연결, 기존 JSON·PNG/PDF·Dashboard·메모의 통합 GUI 회귀.
- Windows 실기기 미검증: 일반 사용자 설치/제거 및 운영 앱 격리, 파일/폴더 선택·덮어쓰기/취소·권한 오류, 복구 확인창, 설치 앱 재실행·데이터 보존, 트레이·다중 모니터/배율. 이번 인계에서는 GUI 재시도·추가 설치·권한 확대·환경 재구성을 하지 않습니다.

### 향후 원본 디자인 변경분 반영

1. 원본 `feature/newsletter-studio`의 현재 재사용 기준은 `7e7336b0bf1bd8adf75710e85290e4cdfc7a8813`입니다. 다음 통합 작업에서 원격 최신 SHA를 확인해 별도로 고정하고, 새 통합 브랜치에서 이 기준과 비교합니다. 원본 브랜치·worktree는 수정하지 않습니다.
2. `src/newsletter/rendering/**`, CSS, 템플릿·글꼴·수달 등 자산의 실제 변경분을 선별 반영합니다. 원본 브랜치 전체 병합이나 렌더러 재작성은 하지 않습니다. 자산 SHA·분류·사용 범위·출력 승인 상태와 JSON/디자인 schema 호환성을 함께 확인합니다.
3. Electron용 `NewsletterStudio.tsx` 호스트 연결·테스트, preload/IPC, 내부 저장소·복구 보호, 격리 출력 창과 출력 어댑터는 별도 변경이므로 원본 파일로 덮어쓰지 않습니다. Tauri repository/출력 저장 경로를 다시 연결하지 않습니다.
4. Vite의 Windows 경로 정규화와 메모 Context 단일 모듈 검사를 유지합니다. `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, 호출자·입력 검증과 다운로드 차단도 유지합니다.
5. 다음 통합 검증은 합성 데이터로 변경 영향 범위만 수행하고, P2-D-3 GUI 미검증을 먼저 명시한 상태에서 계획합니다. 손상 원고 자동 초기화·복구, 승인 상태 자동 승격, 실제 데이터 자동 이관을 추가하지 않습니다. main 병합·PR·운영 배포는 별도 승인 전 진행하지 않습니다.

## ELECTRON-P2E-1: Purchase Helper 수동 업무

- Electron 기준 `c5df12c640b90192eb945bac2b7a1c16133f5949`, 원본 Purchase 기준 `fec6deb78502b6101a7efd328ab4b0bb57fe77be`, 작업 브랜치 `feature/electron-p2e1-purchase-manual`. 원본 브랜치를 병합하지 않고 `electron-p0/renderer/purchase/`에 필요한 모듈만 격리 복사했습니다. 기존 `src/`·`src-tauri/`는 변경하지 않습니다.
- 원본 `types`, `purchaseDomain`, `purchaseClipboard`, `purchaseDraft`, `purchaseBulkEdit`, `purchaseItemEditing`, `purchaseReview`, `usePurchaseItemEditing`는 byte 단위 동일합니다. EditableInput/ItemNameDialog/BulkEditDialog도 원본 그대로입니다. HelperPanel은 파일 분석·출력·native lifecycle을 제거했고 DraftEditor는 복사 연결만 교체했습니다. CSS는 원본 Purchase 선택자와 해당 media 조건을 값 변경 없이 선별했습니다. 이후 원본 변경은 이 고정 SHA와 비교해 필요한 모듈만 반영합니다.
- 진입: Dock의 품의 도우미 또는 업무 도구 → `품의 도우미 · 세션 전용`. 수동 품목 CRUD·검토·선택 합계·일괄 편집과 품의문 생성/편집/미리보기/텍스트·HTML 복사를 제공합니다. 원본 계산·반올림·입력 검증을 재사용합니다.
- 품목·품의문·템플릿·출력 열은 React 메모리 상태로만 유지합니다. 패널을 닫았다 열면 세션 상태를 유지하고 앱을 종료하면 소멸합니다. Dashboard/메모/소식지 설정 파일과 혼합하지 않으며 계정 설정·Tauri 데이터·운영 DB·MY FINANCE를 읽거나 자동 이관하지 않습니다.
- CSV/XLSX/XLS/PDF 가져오기, 파일 분석·열 매핑, CSV/XLSX·정산·에듀파인 출력은 비활성화하고 안내합니다. 계정 동기화는 연결하지 않습니다. 임시 분석 결과와 성공 응답은 제공하지 않습니다.
- 최소 IPC는 `electronWork.purchase.copy({text,html})` 하나입니다. main에서 기존 main-frame/window/URL 검증, 정확한 필드·길이 제한·빈 텍스트·NUL·attribute 없는 HTML 태그 allowlist를 검사하고 Electron 45 ClipboardItem으로 텍스트/HTML을 함께 씁니다. 읽기·임의 경로·범용 invoke는 노출하지 않습니다. native 실패는 구조화 오류로 반환하며 입력 내용은 로그에 기록하지 않습니다.
- 이번 GUI QA는 **BLOCKED / NOT RUN**: 사용 가능한 DISPLAY 및 실행 중인 Xorg/Xvfb가 없습니다. 과거 GUI 결과를 이번 변경의 PASS로 사용하지 않으며 GUI 승인 반복·환경 재구성은 하지 않았습니다. 실제 Windows의 화면 배치·클립보드 붙여넣기·종료 후 세션 소멸 확인은 남아 있습니다. 패키징 구성·의존성이 변경되지 않아 Windows 패키징/기존 GUI CI는 재실행하지 않습니다.
- 다음 범위: 사용자가 선택한 파일만 읽는 형식별 IPC 및 기존 분석 엔진 연결을 먼저 조사합니다. CSV부터 단계적으로 검증하고 XLSX/XLS/PDF 분석·미리보기·열 매핑과 안전한 출력 저장을 분리합니다. 이번 세션 기능을 영구 저장·계정 동기화로 자동 확장하지 않습니다.

- 검증 결과: Electron main/preload/renderer/테스트 TypeScript 및 프로덕션 빌드 PASS, 관련 자동 테스트 **67 files / 307 PASS**(Purchase 원본 회귀·세션 UI·클립보드 경계, Dashboard/Dock·메모·Newsletter 회귀). 테스트 TypeScript의 기존 JSX 옵션 누락을 보완했습니다. **최종 CONDITIONAL**: Cloud GUI와 Windows 실기기 검증은 NOT RUN입니다.

## ELECTRON-P2E-2: CSV 선택·분석·열 매핑

- 기준 `8ffe4f15979ae833df30eabc9108d1572eedeb8b`, 브랜치 `feature/electron-p2e2-purchase-csv`. 새 의존성·패키징 설정 변경 없이 main의 `purchase-csv.ts`/`purchase-import.ts`, 기존 Purchase 세션의 `PurchaseImportControls`를 연결했습니다. 기존 계산 모듈·CSS·Tauri/Rust는 변경하지 않습니다.
- IPC는 `purchase.pickCsv()`·`cancelCsv()`·`mapCsv({generation,candidateId,headerRow,mapping})`만 추가했습니다. pick은 인자를 받지 않고 main의 CSV 전용 native 대화상자에서 선택한 파일 한 개만 읽습니다. main-frame/window/URL을 호출 전과 비동기 선택·읽기 후 재검사합니다. renderer는 경로/원본 rows를 제출할 수 없으며 결과에는 basename만 반환합니다. 매핑은 main이 보관한 현재 candidate에만 적용합니다.
- 파일은 읽기 전용입니다. 확장자·일반 파일·symlink 거절·파일 크기/동일성·읽는 동안 변경을 검사하고, bounded read를 사용합니다. 제한은 15 MiB, CSV record 530행(머리글 포함), 품목 500개, 256열, 셀 65,536자입니다. 분석은 세션 메모리에서만 수행하고 원본 파일·운영 저장소를 변경하지 않습니다.
- UTF-8/BOM 및 WHATWG EUC-KR(CP949) strict decode, quoted comma/escaped quote/embedded newline/CRLF·가변 열 수를 지원합니다. 기존 Rust의 AnalysisResult/MappingCandidate/Item 계약, 헤더 별칭·첫 30행 점수화·generic header 순위·숫자 정규화·반복 머리글/합계/금액만 있는 꼬리행 제외·issue 규칙을 반영했습니다. candidate ID는 불투명 UUID입니다.
- **호환 범위의 안전 제한:** 원본 Rust의 손상 인코딩 대체 문자·느슨한 따옴표 복구는 따르지 않고 거절합니다. 수식 시작 셀(단순 음수 숫자는 제외), 바이너리 제어문자, 비유한/계산 금액 범위 초과도 거절합니다. Rust 소스의 기존 사례를 옮긴 계약 테스트는 PASS이지만, 이 환경에는 `rustc`가 없어 Rust 엔진과의 직접 실행 대조는 **NOT RUN**입니다. 모든 CSV에 대한 동일성을 주장하지 않습니다.
- 분석 후 사용자가 추가/교체를 선택하고 `CSV 품목 적용`을 눌러야 반영합니다. 기본은 기존 품목에 추가하고 세션 ID를 새로 발급합니다. 교체는 기존 품목이 있으면 별도 확인하며 취소 시 기존 품목·초안을 유지합니다. 분석 실패/0품목/취소/닫기/오래된 generation/분석 중·분석 후 품목 변경은 기존 항목을 변경하지 않습니다. 교체 성공 때만 기존 품의문 초안을 비웁니다. 중복 동시 선택과 이미 사용한 매핑 candidate도 거절합니다.
- TypeScript(main/preload/renderer/tests)·Electron 프로덕션 빌드 PASS. 관련 자동 테스트 **70 files / 323 PASS**: UTF-8/BOM·EUC-KR·CSV 문법·limits·수식/손상 거절·권한/경로/매핑 검증·취소/오래된 결과·UI 추가/확인 교체/수동 보존·기존 Purchase 계산/품의문 및 Dashboard/Dock/메모/Newsletter 회귀.
- **Cloud GUI BLOCKED / NOT RUN:** DISPLAY와 실행 중인 Xorg/Xvfb가 없으며 반복 승인 요청·GUI 재시도·환경 재구성은 하지 않았습니다. Windows 실제 파일 대화상자·한글 파일 선택·화면 배치·OS 파일 읽기는 미검증입니다. Windows 패키징은 설정 무변경으로 재실행하지 않았습니다. 최종 **CONDITIONAL**.
- XLSX/XLS/PDF 가져오기와 모든 파일 출력·정산·에듀파인·계정 동기화는 계속 비활성화합니다. 다음 단계는 이 파일 선택 경계를 재사용해 기존 spreadsheet/PDF 엔진의 제한·계약을 각각 연결하고, 출력 저장은 별도 사용자 선택·안전 저장 단계로 진행합니다.

## ELECTRON-P2E-3B: 독립 Rust Excel CLI

- 기준 `b006cbbc5593daa28220be75f21a7f3c2040ac67`; 브랜치 `feature/electron-p2e3-purchase-excel`. `tools/purchase-excel-cli`에 원본 Rust의 헤더/숫자/매핑, XLSX ZIP/셀 제한, XLS CFB/BIFF 검사, 자동 시트 선택을 선별 복사했습니다. 원본 `src/`와 `src-tauri/`는 수정하지 않습니다. `verify-excel-source.mjs`가 원본 함수 28개·bounds·시트 선택·원본 합성 테스트 본문의 일치를 확인합니다. 변경은 CSV/PDF/Tauri host dispatch 제외와 CLI envelope뿐입니다. 별도 Cargo.lock은 원본 lock에서 필요한 의존성을 유지·축소했습니다.
- CLI는 버전 1 JSON 요청 한 건(analyze 또는 map)을 stdin에서 받고 stdout으로만 결과를 반환합니다. Tauri/SQLCipher/PDF/출력 엔진은 링크하지 않습니다. calamine은 수식/매크로를 실행하지 않으며 기존 숫자·빈 셀·캐시 값 및 자동 시트 선택 계약을 유지합니다. 사용자 시트 선택은 추가하지 않았습니다. 현재 세션에는 저장된 가져오기 템플릿이 없으므로 analyze의 templates는 빈 배열입니다.
- Windows는 파일/요청을 읽기 전에 Job Object에 자신을 넣고 512 MiB process memory, CPU 30초, active process 1, kill-on-close를 설정·조회합니다. 실패하면 exit 78로 분석을 거절합니다. main은 별도로 wall timeout 30초, stdin/stdout 64 MiB, stderr 4 KiB 제한을 적용합니다. Linux CLI는 RLIMIT_AS/CPU를 먼저 설정합니다. macOS는 제한 미구현이므로 fail closed입니다. 제한 때문에 거절되는 큰 파일은 원본 엔진의 구조상 허용 범위보다 좁을 수 있습니다.
- main의 고정 실행 경로와 `shell:false`만 사용합니다. renderer는 경로/명령/실행 파일/원본 rows를 전달하지 못합니다. 선택된 XLSX/XLS만 기존 bounded read로 읽어 PoC `work-data/purchase-import-tmp/request-*/input.xlsx|xls`에 임시 스냅샷을 만듭니다. CLI 종료(close) 확인 후에만 스냅샷을 제거하며 정상 앱 종료도 취소·정리를 기다립니다. OS/앱 강제 종료 시 잔존 파일의 자동 정리는 이번 구현에 포함하지 않습니다. 프로세스 환경은 최소화하고 stderr·원고/품목·경로는 로그로 내보내지 않습니다. CLI는 OS 전체 파일 접근을 차단하는 샌드박스는 아닙니다.
- 기존 CSV 화면에서 가져오기 형식을 XLSX/XLS로 선택합니다. 같은 품목 표·매핑·추가/확인 교체 UI를 재사용합니다. 형식 변경/닫기/취소는 요청을 무효화하고 CLI를 종료하며, 분석 중·분석 후 품목 변경도 적용을 거절합니다. 실패 시 기존 품목·초안은 유지합니다. PDF·파일 출력·계정 동기화는 계속 비활성화합니다.
- 개발 준비: Rust stable, Node 24 및 기존 npm 의존성을 사용합니다. `cargo test --locked --manifest-path tools/purchase-excel-cli/Cargo.toml`(합성 CLI fixture 생성) → `node scripts/electron-p0/build-excel.mjs` → `node scripts/electron-p0/check-excel-cli.mjs` → `npm run electron:p0:build` → 관련 Vitest를 실행합니다. Windows CLI smoke에는 빌드한 exe 경로를 명시합니다. Windows release는 x64 MSVC static CRT로 빌드하여 추가 VC 런타임 설치 의존을 줄입니다.
- Portable/NSIS는 `extraResources/purchase-excel-cli`에 CLI를 포함합니다. CLI 빌드 누락은 beforePack에서 거절합니다. 기존 Windows CI에 Rust 원본 비교·37개 테스트·직접 CLI 실행을 추가하고, 패키지 및 일반 사용자 NSIS 설치 경로의 CLI를 실제 실행하도록 연결했습니다. 설치 불가능한 승격 러너는 기존 정책대로 NOT RUN입니다. 운영 앱 ID·업데이트 채널·저장 경로는 변경하지 않습니다.
- Cloud 확인: Rust 테스트 **37 PASS**, CLI 직접 XLSX/XLS·다중 시트 자동 선택·매핑·원본 결과 fixture 비교·잘못된 요청 종료 PASS. TypeScript/프로덕션 빌드 및 관련 Vitest **331 PASS**. 취소/시간 초과 후 close 대기, 출력/입력 크기 제한, 실제 CLI 임시 파일 정리 및 CSV/수동 입력/품의문/Dashboard/메모/Newsletter 회귀를 확인했습니다. Windows-target Job Object 코드 cross-check PASS(런타임 검증과 다름).
- Cloud GUI는 DISPLAY 부재로 **BLOCKED / NOT RUN**이며 재시도하지 않습니다. Windows Job Object 런타임·Portable/NSIS 생성/실행·실기기 검증은 CI 결과가 확인되기 전 **NOT RUN**입니다. 이 상태의 최종 판정은 **CONDITIONAL**, 구현 완료/실사용 준비 완료로 표시하지 않습니다.
