# ELECTRON-P0: Dashboard + Dock

> 단계별 과거 기록입니다. 최신 기능·검증 판정은 **「P2-E-5B 정산·에듀파인 출력」**을 먼저 확인하세요. 2026-11-01 인계는 P2-E-5A 당시 기록입니다. P0의 범위 제외 설명은 당시 단계의 설명입니다.

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

- Windows CI 첫 실행 `41287575554`: Rust 테스트/CLI 실행 단계 PASS. 기존 source preservation은 과거 P2D1 기준과 NewsletterStudio.test.tsx의 기존 차이로 중단됐습니다. 이번 승인 기준 b006cbb와 전체 src/src-tauri를 예외 없이 비교하도록 수정해 패키징 검사를 재실행합니다.

### P2E3B Windows 검증 체크포인트

- 코드 검증 SHA `391dc4c5a80599a9d0ad99871d22a60f1f51d79e`; [Windows CI 41287785103](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41287785103) 전체 job SUCCESS. Windows Rust 원본/보안 테스트·자원 제한 설치 후 CLI 직접 실행, Portable/NSIS 생성, win-unpacked resources의 CLI 실제 실행 및 기존 Dashboard/Newsletter GUI 회귀 단계가 PASS입니다. 설정·자원 제한 실패 exit 78을 정상 결과로 처리하지 않습니다.
- CI 경고 `ELECTRON_P1A_NOT_RUN`: 러너가 승격 상태이므로 일반 사용자 NSIS 설치·설치 앱 실행/재실행·제거 및 설치 경로의 CLI 실행은 **NOT RUN**입니다. Portable 자체 추출 런처와 실제 XLSX/XLS 파일 대화상자·실기기 파일 가져오기 QA도 별도로 남습니다. Job Object의 실제 메모리/CPU 초과 강제 종료 스트레스 검증은 미실행이며, 취소·wall timeout의 main 제어는 자동 테스트로 검증했습니다.
- 다운로드: 실행의 `ELECTRON-P2E3-Windows-391dc4c5a80599a9d0ad99871d22a60f1f51d79e` artifact(Portable/NSIS·해시·서명 및 QA 결과). Cloud의 artifact blob 다운로드는 HTTP 403으로 추가 원본 열람이 차단되어, 여기서는 GitHub job/step 결론과 check annotation으로 결과를 확인했습니다. 이전의 GUI PASS를 이번 실행에 전용하지 않았습니다.
- **최종 CONDITIONAL, 구현 완료 처리 보류.** Cloud GUI는 계속 BLOCKED/NOT RUN이며 Windows 실기기·일반 사용자 설치 및 제거 검증이 남습니다. 이후 문서 전용 커밋에는 `[skip ci]`를 사용해 동일 코드의 Windows 빌드를 반복하지 않습니다. Tauri/Rust 원본·운영 데이터 무변경, PR/병합/배포 없음.

## ELECTRON-P2E-4: 텍스트 PDF 가져오기

- 기준 `1aeb817c6214213b23659fe54b66c6bdf7ac532c`; 브랜치 `feature/electron-p2e4-purchase-pdf`. 기존 `purchase-excel-cli` 실행 파일·Job Object·프로세스 lifecycle·임시 파일 경계를 그대로 재사용하며 새 분석 프로세스 체계를 만들지 않았습니다. 기존 Cargo.lock 기준 `pdf-extract=0.12.1`/`lopdf=0.42.0`을 CLI에 추가했습니다. 원본 `src/`·`src-tauri/`는 변경하지 않습니다.
- 원본 PDF의 `PdfLayoutOutput`·glyph 좌표 정렬·단일 공백 보존/열 분리·페이지 꼬리말 제외·텍스트 표/품목 분석을 선별 복사했습니다. 원본 함수 33개와 PDF OutputDev 구현·자동 시트 선택·기존 합성 테스트 본문 비교가 PASS입니다. PDF 알고리즘과 기존 자동 시트 선택을 재작성하지 않았습니다. CLI host 경계에서 암호화 여부(is_encrypted/was_encrypted)를 사전 검사해 암호 해제 사본 선택을 안내하며 비밀번호 입력/복호화 기능은 추가하지 않습니다.
- main의 PDF 전용 선택 대화상자와 `pickPdf/cancelPdf/mapPdf`만 노출합니다. renderer의 경로·명령·실행 파일·원본 rows 지정은 받지 않습니다. 같은 세션 UI에서 `텍스트 PDF`를 선택하고 분석 → 필요시 열 매핑 → 명시적 추가/확인 후 교체를 수행합니다. 오류/미지원 결과는 원본 엔진의 고정 안내문을 표시하며 적용 버튼을 제공하지 않습니다. 스캔 PDF는 OCR 미지원, 암호화 PDF는 암호 해제 사본, 손상/과도한 페이지는 읽기/제한 안내를 제공합니다.
- 파일 15 MiB, PDF 50페이지, 추출 텍스트 2 MiB와 원본의 최대 530개 텍스트 행 처리 계약을 유지합니다. 기존 CLI의 512 MiB/CPU 30초·main wall 30초·입출력 크기 제한과 종료(close) 확인 후 임시 스냅샷 제거를 유지합니다. JS/매크로/외부 명령을 실행하는 PDF 뷰어나 Ghostscript/OCR을 도입하지 않았습니다. OS/앱 강제 종료 시 잔존 임시 파일·부모 강제 종료 검증 등 P2E3B의 잔여 한계는 그대로입니다.
- Cloud Rust **47 PASS**: 기존 PDF 사례 8개와 텍스트·한글 ToUnicode·숫자/합계·매핑·실제 bitmap-only 스캔·암호화·손상·페이지/텍스트 제한을 확인했습니다. CLI 직접 실행에서 원본 결과 fixture 비교와 XLSX/XLS/PDF 회귀를 확인했습니다. 관련 JavaScript/React **340 PASS**, TypeScript·프로덕션 빌드 PASS. UI 추가/교체 확인·오류 시 기존 품목/원본 파일 유지·임시 파일 정리·취소/오래된 결과·기존 CSV/Excel/수동/품의문/Dashboard/메모/Newsletter를 검증했습니다. 한글 PDF fixture는 합성 Type0/ToUnicode 데이터이며 외부 학교 문서를 사용하지 않습니다.
- `pdf-extract` 추가로 CLI 배포 바이너리가 변경되므로 기존 Windows CI에 이번 브랜치를 연결하고 같은 smoke 검사로 패키지의 PDF 분석까지 확인합니다. 현재 Windows Job Object/Portable/NSIS/패키지 GUI 결과는 새 CI 확인 전 NOT RUN입니다. Cloud GUI는 사용 가능한 DISPLAY가 없으면 BLOCKED/NOT RUN으로 유지하며 재시도하지 않습니다. 일반 사용자 설치·제거/실제 파일 대화상자 및 실기기 QA가 남으면 최종 CONDITIONAL입니다. 파일 출력·계정 동기화·운영 DB·MY FINANCE는 연결하지 않습니다.

### P2E4 Windows 검증 체크포인트

- 코드 SHA `9c4eff8da75030079c2e2de5321b13b57b93cce9`; [Windows CI 41289270318](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41289270318) SUCCESS. Rust 원본 비교·47개 테스트·Windows 자원 제한 설치 후 CLI 실행, XLSX/XLS/PDF 텍스트/한글/매핑 및 스캔/암호화/손상/페이지 제한 smoke, Portable·NSIS 생성, win-unpacked resources의 CLI 실행과 기존 앱 GUI 회귀 단계가 PASS입니다.
- 아티팩트 `ELECTRON-P2E4-Windows-9c4eff8da75030079c2e2de5321b13b57b93cce9`에 Portable/NSIS·해시·서명/QA 결과가 있습니다. 증거는 같은 실행의 UI-evidence 아티팩트에 보관됩니다. 이번 GUI 회귀는 이번 실행의 결과이며, 과거 P2E3 PASS를 대신 사용하지 않았습니다.
- CI 경고 `ELECTRON_P1A_NOT_RUN`: 승격 러너로 일반 사용자 NSIS 설치·설치 후 실행/재실행·제거는 NOT RUN입니다. Portable 자체 추출 런처·실제 PDF 파일 대화상자·Windows 실기기의 합성 PDF 가져오기와 기존 P2E3 자원 초과 스트레스/강제 종료 잔여 검증도 남습니다. Cloud GUI는 BLOCKED/NOT RUN입니다. **최종 CONDITIONAL**로 유지하며 실사용 준비 완료로 표시하지 않습니다.
- 이후 문서 전용 커밋은 `[skip ci]`로 같은 코드의 전체 Windows CI를 반복하지 않습니다. 원본 Tauri/Rust·운영 데이터·기준 브랜치 보존, PR/병합/배포 없음.

## ELECTRON-P2E-5A: 구매 품목 CSV/XLSX 출력

- 기준 `26f57a0b3e5f42f4ef8532f45acd8b746a6edcb6`; 브랜치 `feature/electron-p2e5a-purchase-export`. 원본 Rust `output_value/csv_output_value/column_label/validate_columns`와 `save_purchase_export`의 CSV/XLSX writer 루프를 재사용했습니다. Tauri 대화상자/직접 파일 쓰기만 CLI의 메모리 byte 반환으로 바꿉니다. 원본 `src/`/`src-tauri/`는 무변경입니다. 기존 CLI·Job Object·시간/입출력 제한을 재사용하며 별도 프로세스 체계를 만들지 않습니다. 원본 의존성 `csv=1.4.0`, `base64=0.22.1`, `rust_xlsxwriter=0.99.1`을 사용합니다.
- 출력 계약: 현재 선택 품목·열 순서 그대로, CSV UTF-8 BOM과 원본 필드 quoting/수식 trigger apostrophe 보호, XLSX 문자열 셀/수량 `0.##`/금액 `#,##0`/헤더 bold/열 너비 유지. XLSX `number` 열도 원본대로 문자열입니다. 원본 numeric/empty/text 계약과 생성 파일의 read-back 검증(calamine/csv)을 CLI 안에서 완료하고 main은 형식·크기·base64·행 수·열 순서·검증 결과를 다시 확인합니다. CLI는 출력 저장 경로를 받지 않습니다.
- 최소 IPC `purchase.exportItems({format,items,columns})`만 추가합니다. main에서 호출자 window/main-frame/URL, 정확한 필드·형식·열·선택/중복 ID·행/문자열/요청 크기를 검사합니다. 기존 TypeScript 계산/금액 확인 함수를 import 경로만 바꾼 main 전용 사본으로 재사용하고 동일성 검사를 합니다. renderer가 보낸 issues를 신뢰하지 않고 재계산하며 수량/단가 누락·비유한/안전 범위 초과·미확인 금액 불일치를 거절합니다. CSV의 원본 보호가 모호한 공백/줄바꿈 뒤 수식 trigger는 추가 거절합니다.
- 원본 writer와 TypeScript 계산 모듈의 동일성 검사를 자동화했습니다. main 전용 사본은 Vite가 renderer 출력 폴더를 비우더라도 main에서 안전하게 로드되도록 main 아래에 둡니다. 원본 renderer 계산 코드는 수정하지 않습니다. 최대로 500품목/9열, 요청 8 MiB, 생성·기존 대상 파일 32 MiB이며 안전 범위 내 원화 합계만 허용합니다.
- 흐름: 기존 표에서 선택·금액 확인 → main의 품목/수량/단가/합계 검토 → CLI 생성·검증 → main 저장 대화상자 → 기존 파일 명시적 덮어쓰기 확인 → 같은 폴더의 독점 임시 파일 작성/fsync → 대상 지문 재검사 → 원자적 게시/교체. renderer는 저장 경로를 지정하지 못합니다. 결과는 `saved`/`canceled`와 구조화 오류로 구분하며 파일 경로·업무 내용을 로그에 기록하지 않습니다. 검토 시점의 요청 사본을 사용하고 중복 저장을 차단합니다.
- 저장은 소식지의 staging/fingerprint/rename 패턴을 재사용합니다. 기존 대상은 SHA-256·파일 ID·metadata를 저장 직전 재검사하고 atomic rename으로 교체합니다. 새 대상은 hardlink의 atomic no-clobber로 뒤늦게 생긴 파일도 덮어쓰지 않습니다. symlink/위험 부모 경로·확장자 불일치는 거절하며 취소·권한 오류·교체 실패 시 기존 파일을 유지하고 stage를 정리합니다. hardlink 미지원 파일시스템에서는 새 파일 저장이 실패하며 안전하지 않은 fallback을 하지 않습니다. 외부 프로그램과의 배타 잠금/CAS는 아니므로 기존 대상의 마지막 재검사와 rename 사이의 경쟁을 완전히 차단하지는 않습니다. 외부 편집 중에는 별도 새 파일을 선택해야 합니다. 강제 종료/전원 차단 시 임시 파일·디렉터리 내구성 보장은 별도 검증 대상입니다.
- Cloud 검증: Rust **51 PASS**, 최종 관련 JavaScript/React **347 PASS**, TypeScript/프로덕션 빌드 PASS. 원본 UTC `품의_품목내역_YYYYMMDD` 기본 파일명도 유지합니다. 한글·빈 텍스트·숫자·반올림·열 순서·원본 XLSX 서식/문자열 formula·CSV 수식 보호·생성 파일 변조 거절·실제 CLI 생성·저장/취소/권한 오류 주입/외부 변경/late target/교체 실패/원본 보존·동작 상태 UI 및 PDF/Excel/CSV/수동 입력/품의문/Dashboard/메모/Newsletter 회귀를 확인했습니다. 원본 Rust 37개 함수·writer 루프 및 계산 모듈 일치 검사 PASS입니다.
- CLI 배포 내용이 달라지므로 기존 Windows CI에 이번 브랜치를 연결했습니다. 같은 패키지 CLI smoke에서 CSV/XLSX 생성·검증까지 실행합니다. 현재 Windows/실기기 및 Cloud GUI는 새 실행 결과 전 NOT RUN입니다. Cloud에는 DISPLAY가 없어 GUI를 재시도하지 않습니다. 정산·에듀파인 출력·계정 동기화·운영 데이터/MY FINANCE 접근은 계속 제외합니다. P2E5B는 원본 정산/에듀파인 계약을 선별 재사용하고 같은 생성·검증·native 선택·안전 저장 경계를 사용하되 검증 한계를 이어받습니다.

### P2E5A Windows 검증 체크포인트

- 코드 SHA `c355da4ddde9194f1f280dc622ad8cfb2a0d1257`; [Windows CI 41294421602](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41294421602) SUCCESS. 원본 writer/계산 동일성, Rust 51개 테스트, CLI CSV/XLSX 생성·read-back 검증 및 기존 PDF/Excel 가져오기 smoke, Portable·NSIS 생성, win-unpacked resources CLI 실행과 기존 GUI 회귀 단계 PASS입니다. 초기 `41293999402`는 기본 파일명을 원본 YYYYMMDD로 맞춘 최종 SHA 검증으로 대체되어 취소됐으며 PASS로 계산하지 않습니다.
- 결과물은 `ELECTRON-P2E5A-Windows-c355da4ddde9194f1f280dc622ad8cfb2a0d1257` 아티팩트에 있습니다. 새 창/범용 경로 API를 노출하거나 운영 배포하지 않았습니다. CI 경고 `ELECTRON_P1A_NOT_RUN`에 따라 일반 사용자 설치·설치 후 실행·제거는 승격 러너에서 NOT RUN입니다.
- Cloud GUI는 BLOCKED/NOT RUN이며 Windows 실제 저장/덮어쓰기 대화상자, MS Excel 실제 열기, NTFS 외 저장소·권한·외부 편집기 동시 저장·강제 종료 검증은 미실행입니다. 마지막 지문 검사와 rename 사이의 경쟁을 완전히 차단하는 배타 잠금은 제공하지 않습니다. **최종 CONDITIONAL**이며 실사용 준비 완료로 표시하지 않습니다.
- P2E5B는 정산·에듀파인의 원본 별도 열/금액/세무 표시 계약을 먼저 확인하고, 좁은 타입 IPC와 동일한 CLI 생성/파일 검증/main 저장 경계에 연결해야 합니다. 이 단계의 CSV/XLSX exportItems를 범용 경로/워크북 쓰기로 확대하지 않습니다. 원본 Tauri/Rust·운영 DB·MY FINANCE·기준 브랜치 보존, PR/병합/배포 없음. 문서 전용 커밋에는 `[skip ci]`를 사용해 동일 코드의 Windows 빌드를 반복하지 않습니다.

## 2026-11-01 Codex Cloud 종료·학교 PC 인계

### 보존 기준과 P2-E-5B 확인 상태

- 저장소: https://github.com/school-health-hub/BOGUNON_DESK
- 이어서 받을 브랜치: `feature/electron-p2e5a-purchase-export`. 이번 정리 시작 시 로컬·원격 HEAD는 모두 `5cdb601905986772b25bcd24b95f50a03fa016a1`입니다. 검증된 기능 코드 SHA는 `c355da4ddde9194f1f280dc622ad8cfb2a0d1257`이며, 그 뒤에는 문서 변경만 있습니다. 이번 종료 커밋도 문서만 추가합니다. 최종 문서 커밋의 정확한 SHA는 최종 인계 보고 및 `git rev-parse HEAD`로 확인합니다.
- **P2-E-5B는 미확인/미완료입니다.** 사용자도 별도 완료 브랜치/최종 SHA가 없음을 확인했으며 이번 인계 기준을 위 P2-E-5A 브랜치·SHA로 확정했습니다. 확인 시점의 로컬 브랜치·GitHub 브랜치 목록·현재 문서에는 Purchase P2-E-5B 완료 SHA/검증 기록이 없습니다. 현재 Electron의 정산·에듀파인 출력은 비활성화 상태입니다. 별도 세션의 미푸시 작업을 완료로 추정하거나 가져오지 않았습니다. P2-E-5A의 CONDITIONAL을 P2-E-5B 판정으로 대신 쓰지 않습니다. 별도 결과가 있다면 먼저 브랜치/SHA와 검증 증거를 확보해야 합니다.
- 정리 시작 시 tracked/untracked 변경 없음, 현재 저장소의 merge/rebase/cherry-pick/revert/sequencer 및 index/HEAD 잠금 표식 없음. 원격 SHA와 명시적 원격 추적 ref 기준 ahead/behind `0/0`입니다. 이 Cloud의 fetch 매핑에서는 `@{upstream}` 별칭 해석이 안 되어 `refs/remotes/origin/feature/electron-p2e5a-purchase-export`와 직접 비교했습니다. 기존 기능 브랜치와 다른 작업 트리는 변경하지 않습니다.
- `src-tauri/`는 Electron P0 기준 `0b2f49503c7bcc2bedeb9988bd5cef6b11982829` 대비 차이가 없습니다. Purchase Rust 원본도 보존됩니다. 전체 `src/`가 과거 main과 동일하다는 뜻은 아닙니다. Newsletter는 승인된 원본 모듈·자산을 선별 반영한 변경이 있습니다. 운영 DB·MY FINANCE 파일은 열거나 복사하지 않았습니다.

### 구현 현황 — 구현과 실사용 판정 구분

| 단계 | 현재 브랜치에 포함된 기능 | 남은 판정/범위 |
| --- | --- | --- |
| P0 | 기존 React Dashboard·위젯 배치/편집·내장 Dock·설정 저장/재실행 복원 | 바탕화면 부착·독립 투명 Dock 없음 |
| P1-A | x64 Portable·사용자별 NSIS, 운영 앱과 다른 ID/설치·데이터 경로, 업데이트 없음 | 일반 사용자 설치·실행·제거 실기기 QA 남음 |
| P1-B/C | 트레이·최소화/복원·창 크기/위치 저장, 모니터 영역 보정, 기본 X 완전 종료·선택적 트레이 숨김, 인계 정리 | 실제 트레이·다중 모니터·혼합 DPI 확인 남음 |
| P2-A | 좁은 타입 IPC·호출자/입력 검증·구조화 오류, 합성 샘플 | 범용 invoke/파일 경로 API 없음 |
| P2-B | 기존 빠른 메모 UI와 Electron 전용 저장·복원 | 운영 메모 자동 이관 없음 |
| P2-C Calendar | 기존 일정 구조 조사 | **DEFER**: 인증된 Workspace/운영 저장소와 일정·할 일·학교 업무가 연결됨. 별도 로컬 일정으로 복제하면 중복·상태 불일치 위험. Electron 일정 표시는 빈 어댑터이며 독립 일정 앱을 구현하지 않음 |
| P2-D-1~3 Newsletter | 기존 편집·미리보기, JSON 열기/저장·이미지 재연결, 승인된 PNG/PDF, 내부 프로젝트/revision·미리보기·확인 복구·충돌 차단 | `exportApproval: pending` 자산 출력은 계속 차단. 학교 PC 원고 복구/이미지/파일 대화상자 통합 QA 남음 |
| P2-E-1 | 수동 품목 CRUD·검토·선택 합계·품의문·복사 | 품목/품의문은 세션 전용, 앱 종료 시 소멸 |
| P2-E-2 | CSV UTF-8/BOM·EUC-KR, 헤더/열 매핑, 추가/확인 교체, 취소·오래된 결과 차단 | 손상/수식/한도 초과 거절 등 Rust 원본과의 안전 제한 차이는 위 기록 참조 |
| P2-E-3A/B | 원본 Rust XLSX/XLS CLI·ZIP/BIFF 방어·기존 자동 시트 선택·열 매핑, Job Object | 사용자 시트 선택 없음, 자원 초과/강제 종료 추가 QA 남음 |
| P2-E-4 | 원본 텍스트 PDF 표 추출·한글·매핑·추가/확인 교체 | 스캔 OCR 없음, 암호화 PDF 거절·안내, 실기기 QA 남음 |
| P2-E-5A | 선택 구매 품목 CSV/XLSX 생성·파일 검증·main 저장 선택·덮어쓰기 확인·변경 감지·staging/원자적 교체 | **CONDITIONAL**. 외부 프로그램과의 완전한 배타 잠금은 아님 |
| P2-E-5B | **미확인/미완료** — 사용자 확인 기준 별도 완료 브랜치/SHA 없음 | 정산·에듀파인 이전 완료로 표시하지 않음 |

### 기존 검증 증거와 차단 사항

- 최신 확인 코드의 기존 결과: Rust **51 PASS**, 관련 JavaScript/React **347 PASS**, TypeScript·프로덕션 빌드 PASS. [Windows CI 41294421602](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41294421602) SUCCESS: Portable/NSIS 생성, 패키지 CLI의 가져오기/CSV·XLSX 출력 및 파일 검증, 기존 앱 GUI 회귀. **이번 정리는 이 기록을 재사용하며 테스트·빌드·QA를 재실행하지 않습니다.**
- Newsletter P2-D-3 당시의 GUI는 BLOCKED/NOT RUN, 이후 위 Windows CI에서는 기존 Newsletter GUI 회귀가 통과했습니다. 이를 학교 PC의 모든 복구·이미지·파일 대화상자 검증 완료로 확대하지 않습니다. 수달 자산의 pending 정책과 WIP 디자인의 미승인 상태는 유지합니다.
- Cloud GUI는 실행 환경 부재로 BLOCKED/NOT RUN. Windows CI는 승격 러너였으므로 경고 `ELECTRON_P1A_NOT_RUN`에 해당하는 일반 사용자 설치·설치 후 실행/재실행·제거는 NOT RUN입니다. 코드/패키지 CI 성공만으로 실사용 준비 완료라고 선언하지 않습니다.
- Purchase 기존 대상의 최종 지문 재검사와 rename 사이의 경쟁, 강제 종료 시 잔존 임시 파일/내구성, Job Object 메모리/CPU 한도 초과 스트레스는 남습니다. 새 파일 hardlink 미지원 파일시스템은 안전하지 않은 fallback 없이 저장 실패합니다. 외부 편집 중인 파일을 덮어쓰지 말고 별도 새 파일을 사용합니다.
- 공문·재고·운영 일정·계정 동기화·MY FINANCE의 Electron 이전은 완료 범위가 아닙니다. P2-E-5B 증거 미확인이 다음 기능 단계 판정의 차단 사항입니다.

### 학교 PC에서 소스 받기 — 기존 폴더를 재사용하지 않기

아래는 **학교 PC에서 나중에 실행할 PowerShell 안내**입니다. 기존 학교 PC 저장소에서 checkout/pull/reset하거나 기존 변경을 지우지 않습니다. Git이 설치되어 있어야 하며 인증이 필요하면 GitHub의 정상 로그인 절차를 사용합니다.

```powershell
$qaSource = Join-Path $env:USERPROFILE 'source\BOGUNON_DESK_Electron_20261101'
if (Test-Path $qaSource) { throw '이미 존재하는 폴더입니다. 새 폴더 이름을 정하세요.' }
git clone --single-branch --branch feature/electron-p2e5a-purchase-export https://github.com/school-health-hub/BOGUNON_DESK.git $qaSource
Set-Location $qaSource
git fetch origin
git branch --show-current
git rev-parse HEAD
git rev-parse origin/feature/electron-p2e5a-purchase-export
git rev-list --left-right --count HEAD...origin/feature/electron-p2e5a-purchase-export
git status --short --branch
git diff --name-only c355da4ddde9194f1f280dc622ad8cfb2a0d1257 HEAD
```

브랜치 일치, 로컬/원격 SHA 동일, ahead/behind `0 0`, 변경 파일 없음이 기준입니다. 마지막 diff는 현재 인계 시점에서는 `docs/ELECTRON_P0.md`만 나오는 것이 정상입니다. 이후 다른 코드가 추가됐다면 이 인계 결과를 그대로 적용하지 말고 새 변경 내용을 먼저 확인합니다. 이 안내는 의존성 설치·빌드·앱 실행을 자동으로 수행하지 않습니다.

**소스 폴더 분리만으로 앱 설치/프로필이 분리되지는 않습니다.** Electron PoC는 `%LOCALAPPDATA%\Programs\BOGUNON DESK ELECTRON P0`, `%APPDATA%\BOGUNON-DESK-ELECTRON-P0`를 사용합니다. 기존 Electron P0가 있으면 자동 재설치/초기화/삭제하지 말고 먼저 별도 QA 계획을 세웁니다. Portable과 NSIS는 같은 PoC 프로필을 공유하므로 동시 별도 실행하지 않습니다. Tauri 운영 앱·계정·DB·로그인 경로는 연결하지 않습니다.

### Windows 실기기 체크리스트 — 합성 데이터만

1. 일반 사용자 권한·기존 운영/PoC 설치 여부를 확인하고, 운영 앱을 종료/제거/업데이트하지 않은 상태에서 PoC 설치 격리 조건을 먼저 점검합니다. 조건이 불명확하면 설치 보류합니다.
2. 검증 코드 SHA와 맞는 Portable/NSIS·해시·서명/QA 결과를 위 CI 아티팩트에서 확인합니다. 보존 기간 만료 시 이번 종료 작업에서 빌드하지 말고 다음 승인된 작업에서 재생성합니다. 보안 경고를 우회하거나 Windows 보호 기능을 끄지 않습니다.
3. Dashboard/Dock/위젯 저장·재실행, 메모 저장·복원, 기본 X 종료/선택적 트레이 숨김, 실제 모니터 추가·제거/배율을 확인합니다.
4. 합성 CSV/XLSX/XLS/텍스트 PDF 가져오기·매핑·추가/교체 확인·취소/오류·기존 품목 보존을 확인합니다. OCR/암호화 PDF는 거절 안내가 정상입니다.
5. 합성 구매 품목 CSV/XLSX 저장·실제 Excel 열기·열 순서/숫자/한글, 저장/덮어쓰기 취소·권한 오류·외부 변경·NTFS 외 대상 처리를 확인합니다. 실제 운영 파일을 덮어쓰지 않습니다. 정산/에듀파인 버튼은 현재 비활성화가 정상입니다.
6. Newsletter 합성 원고의 JSON/이미지 재연결·내부 revision/확인 복구·충돌/손상 안내·승인된 출력 성공/pending 자산 차단을 확인합니다. 운영 원고·출력 원장에 접근하지 않습니다.
7. 승인된 QA 계획에서 PoC만 정상 종료·제거/재설치 후 PoC 설정 보존과 운영 앱 설치/데이터 무변경을 확인합니다. 운영 앱·기존 금융 DB는 열기/복사/삭제하지 않습니다.

### 다음 시작 순서와 종료 범위

1. 이 문서와 최종 인계 보고의 브랜치/SHA·원격 clean 상태부터 확인합니다. 별도 P2-E-5B가 있다면 그 SHA/검증 증거를 먼저 확보하고 현재 코드와 비교합니다. 다른 세션/브랜치를 자동 merge하거나 덮어쓰지 않습니다.
2. 학교 PC에서는 위 합성 데이터 실기기 QA가 우선입니다. 일반 사용자 설치·native 파일 대화상자·실제 Excel/Newsletter 복구·운영 앱 격리 결과를 기록합니다.
3. P2-E-5B 결과가 없다면 향후 별도 승인된 단계에서 정산·에듀파인 원본 계약 이전을 진행합니다. 기존 안전 저장의 동시 쓰기·강제 종료 한계도 먼저 평가합니다. Calendar는 운영 데이터/인증 전략이 확정되기 전 DEFER를 유지합니다.
4. 이번 종료 작업은 이 문서만 commit/push하며 `[skip ci]`로 문서 변경에 따른 CI 재실행을 막습니다. 신규 기능·테스트/빌드/Windows QA·GUI 재시도·PR·main 병합·배포·다른 세션/작업 트리 변경은 하지 않습니다.


## P2-E-5B 정산·에듀파인 출력

- 기준 `7b24104cf0e5c0d17fbbf54402cd52ecb407e672`, 전용 브랜치 `feature/electron-p2e5b-purchase-settlement`. 위 인계의 5B 미완료·버튼 비활성화 설명은 **이전 시점 기록**입니다. 이번 단계는 정산 편집·계산·미리보기와 정산/에듀파인 XLSX 저장을 연결합니다. 품목·정산은 세션 전용이며 자동 영구 저장·계정 동기화는 추가하지 않습니다.
- 원본 `fec6deb78502b6101a7efd328ab4b0bb57fe77be`의 정산 계산·표시 요약·편집기·미리보기 UI와 Rust 정산 writer를 선별 재사용했습니다. 에듀파인 writer는 기준 Tauri helper 그대로입니다. 원본 브랜치 전체 병합 및 `src/`·`src-tauri/` 수정 없이 호스트 입출력만 연결합니다. 별도 의존성/프로세스 체계는 추가하지 않습니다.
- 정산 XLSX는 원본 구매결과 11열·숫자 셀·6개 요약 행·서식, 에듀파인은 `내용/규격/수량/예상단가` 고정 4열입니다. 원본 문자열 셀 쓰기로 수식을 실행하지 않습니다. 별도 VAT로 화면 합계와 기존 출력 합계가 다른 경우 원본 정책대로 출력·복사를 차단합니다. 세액 열을 임의 추가하거나 합계를 바꾸지 않습니다.
- preload에는 네 개의 기능별 preview/export API만 추가합니다. main은 window/mainFrame/URL·입력 키·품목 ID·수량/금액·정산 상태를 검사하고 원본 계산으로 행·요약을 재계산합니다. renderer가 보낸 파생 합계·경로는 허용하지 않습니다. 오래된 미리보기는 폐기하며 사용자가 확인한 최신 자료만 출력합니다.
- 기존 고정 CLI·Job Object·시간/I/O 제한을 재사용합니다. CLI는 저장 경로를 받지 않고 XLSX를 메모리에서 생성해 calamine으로 셀·형식을 재검사합니다. main 검토 확인 → native 저장 위치 → 기존 파일 명시적 덮어쓰기 확인 → fingerprint 재검사·임시 파일·원자 교체를 재사용합니다. 취소·검사/저장 실패 시 정상 파일을 보존합니다. 마지막 검사와 rename 사이 외부 경쟁의 기존 한계는 남으므로 편집 중 파일 대신 새 파일 저장을 권장합니다. 지원되지 않는 안전 저장 방식으로 우회하지 않습니다.
- 로컬 검증: Purchase 19파일 **101 PASS**, Rust **54 PASS**, 원본 helper 38함수/정산 계산·미리보기·writer 동일성 PASS, 실제 CLI CSV/XLSX/PDF 회귀 및 정산·에듀파인 preview/생성·read-back smoke PASS. Electron TypeScript(main/preload/renderer/tests) 및 production build PASS. 테스트에는 합성 데이터만 사용했습니다.
- Windows CLI·Portable/NSIS 검증은 아래 CI 결과로 갱신합니다. Cloud GUI는 **BLOCKED / NOT RUN**(GUI 환경 없음, 재시도하지 않음). 이전 단계 GUI PASS를 재사용하지 않습니다. 실제 Windows 일반 사용자 설치·제거·파일 대화상자·Excel 열기·한글·셀 서식·덮어쓰기 취소/권한 오류/외부 수정은 **NOT RUN**입니다.
- 학교 PC 다음 작업: 이 전용 브랜치를 기존 Tauri와 다른 폴더로 받고 최종 보고 SHA와 원격을 비교합니다. 합성 품목으로 실제 Excel에서 11/4열 및 정산 배송비·할인·VAT 차단을 확인합니다. 운영 DB·MY FINANCE·Tauri 원고/사용자 데이터 접근과 자동 이관, 운영 설치/업데이트, PR/main 병합/배포는 하지 않습니다. 위 이전 인계의 파일 저장 동시 쓰기·강제 종료 및 일반 사용자 QA 잔여 항목도 유지합니다.

### P2-E-5B Windows CI 및 최종 인계

- 구현 검증 SHA: `a73010ecad7b061892e97e5367f876ad26ec0c3a`.
- [Windows CI 41363996473](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41363996473) **SUCCESS**: 원본 소스 보존, Windows Rust 계약/CLI 빌드·smoke, Electron/Newsletter 관련 자동 테스트·TypeScript·프로덕션 빌드, Portable/NSIS 생성, 패키지 내 CLI 정산/에듀파인 preview·XLSX 생성/read-back, 기존 Dashboard/Newsletter 패키지 GUI 회귀 단계 통과. 기존 GUI 회귀 성공을 새 Purchase native 대화상자 GUI 검증으로 간주하지 않습니다.
- Actions 아티팩트 `ELECTRON-P2E5B-Windows-a73010ecad7b061892e97e5367f876ad26ec0c3a`에 Portable/NSIS·SHA256SUMS·서명 상태·QA 결과, `ELECTRON-P2E5B-UI-evidence-41363996473`에 GUI 증거가 있습니다(7일 보존). 운영 배포가 아닙니다.
- 러너의 elevated 토큰이 확인되어 일반 사용자 설치/설치 앱 재실행/제거·설정 보존은 **NOT RUN**입니다. 토큰 우회·권한 완화는 하지 않았습니다. 실제 학교 PC의 운영 앱/데이터 무변경 검증을 수행했다고 주장하지 않습니다. 이번 작업의 `src/`·`src-tauri/` diff는 비어 있고 운영 데이터에는 접근하지 않았습니다.
- **최종 CONDITIONAL**: 기능 구현·자동 검증·Windows 패키징은 통과했으나 Cloud Purchase GUI는 BLOCKED/NOT RUN, 실제 Windows 일반 사용자 설치·제거와 native 저장/취소/덮어쓰기·Excel 열기/셀 서식은 NOT RUN입니다. 다음 단계는 합성 데이터만 사용하는 별도 폴더/PoC 프로필에서 이 잔여 QA를 수행하는 것입니다. 이번 결과 문서 커밋은 기능 변경 없이 `[skip ci]`로 보존하며 정확한 최종 SHA는 최종 보고 및 `git rev-parse HEAD`로 확인합니다.

## 공문작업실 파일 처리 이전(2026-11-02)

기준 `8f0044cd00bdcfe219a2d9ff0decaf4b4b2bede4`의 별도 브랜치 `codex/electron-official-document-files-integration`에서 PDF/HWPX/ODT 텍스트 반입 및 승인 템플릿 ODT 새 파일 저장을 연결했습니다. 정식 실행계획·재사용 provenance·검증·미검증 항목은 [공문 파일 처리 실행계획](qa/OFFICIAL_DOCUMENT_ELECTRON_FILES_PLAN.md)을 확인하세요. 원본 덮어쓰기·원본 서식/표 구조 보존·OCR·reference/AI 신규 기능은 지원하지 않습니다. 기존 Tauri 소스/운영 데이터와 `codex/electron-official-document-files`의 WIP 체크포인트는 보존합니다. Cloud Linux 구현이며 Windows 실제 PC 검증을 완료했다고 표시하지 않습니다. dev 실행은 `npm run electron:p0:dev`가 전용 CLI를 빌드하고, 기존 Windows 패키징 명령도 이 CLI를 포함하도록 연결합니다. Cargo/Node 도구가 필요하며 전역 설치는 자동으로 하지 않습니다.

공문 파일 처리 집중 검증은 Linux 63개/Rust 18개(수동 artifact 1 ignored)·타입/빌드 PASS, [Windows 집중 CI 41401980509](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41401980509) SUCCESS입니다. 실제 Windows native dialog/ODT 프로그램 열기·설치 패키지 실행과 Clippy는 NOT RUN이므로 **CONDITIONAL**입니다. 기능 검증 SHA는 `b0d3545dedcf336b3e6529db391c878379e096ff`; 마감 커밋은 검증 기록과 미실행 선택적 패키징 준비 1줄만 반영합니다. 최신 branch/SHA는 최종 보고 및 원격 비교로 확인합니다.

## INV-EL-01 — Electron Local QA 연결 준비 (2026-11-02)

**판정: BLOCKED (실제 Adapter 연결).** 이번 체크포인트는 개발 전용 진입점과 제한된 Auth 상태 점검만 구현한다. 로그인/학교 선택/재고 조회/상세/입고/사용/폐기/정정/재조회/로그아웃/학교 전환은 미구현이며 성공으로 표시하지 않는다. Production 및 패키지 설치본에서는 사용할 수 없다.

### 기준 및 선별 결과

- Cloud A `codex/cloud-a-inventory-preview` / `0c4472b6bf21ec5c6ed31773222f5c93abae5da0`에서 독립 worktree, 브랜치 `feature/electron-inventory-local-qa`를 생성했다.
- Cloud B 제품 `codex/inventory-im2b1-cloud-b` / `ef0ba64cae5c0a6ccbba05a8821a80730dcfc087`를 읽기 전용으로 조사했다. `connection/contracts.ts`, `localQa.ts`, `index.ts`, `responses.ts`, `validation.ts`를 검토했으나 **제품 파일은 아직 복사하지 않았다**. 연결이 막힌 상태에서 사용되지 않는 인증 코드나 중복 Adapter를 추가하지 않는다.
- DB CI `ci/inventory-postgres-integration-qa` / `95e4f10415a971790d476dd58ac42a12b1ffb80c`, run `41467324396`의 READY는 사용자 인계 증거이며 Electron E2E PASS가 아니다. CI/제품 브랜치 전체 merge/cherry-pick은 하지 않았다.
- Newsletter Guard 통합 브랜치는 별도 보존되며 이번 Preview 기반 브랜치에 포함되지 않는다.

### 차단 근거와 Cloud B 인터페이스 요청

`connection/localQa.ts`의 `environment()`는 DEV/비PROD 및 브라우저 loopback origin 포트 **56300**을 검사한다. 현재 Electron 개발 origin은 **5174**, 패키지는 `file:`이다. 생성자와 각 요청에서 환경 검사를 수행하며 네트워크는 private `#http()`의 전역 `fetch()`에 고정되어 있다. `createLocalQaConnection(config)`에는 승인된 host transport 주입 지점이 없다. 따라서 현 계약 그대로 Main/Preload transport에 연결할 수 없다. origin 위장, import.meta 환경 치환, 전역 fetch 교체, CORS 무력화, Adapter 복제/보안 guard 삭제는 하지 않는다.

Cloud B 요청: 기존 브라우저 factory의 guard를 유지하면서 **별도 Electron 개발 전용 factory 또는 host transport 주입 계약**을 제공해 달라. 이 문서는 변경 요청이며 Cloud B 소유 파일을 수정할 권한으로 해석하지 않는다.

- factory는 browser factory와 구분하고 DEV/비PROD 및 host의 검증된 실행 capability를 요구해야 한다. renderer가 주장하는 boolean만 신뢰하지 않는다.
- endpoint는 host가 고정한 loopback `127.0.0.1:56321`만 허용한다. endpoint/URL/header/token을 renderer가 고르는 범용 proxy를 만들지 않는다.
- main-owned memory-only Auth/Adapter 및 명시적인 typed 업무 IPC를 권장한다. 공개 DTO의 UUID, bigint/decimal 문자열, `AuthState`, `InventoryError`, `outcomeUnknown`, `PreparedMutation` 계약은 유지한다. 기존 numeric JSON/Preview 모델과 직접 캐스팅하지 않는다.
- 후속 IPC는 login/logout/selectSchool/listItems/itemDetail/prepare/execute/dispose 등 구체적인 동작별로 입력·응답을 검증한다. exact caller/frame/URL, RLS 학교 권한, 제한된 RPC 이름을 검사한다. 요청 최대 64KiB·응답 최대 2MiB·15초 timeout을 초기 상한으로 제안하며 실제 DTO/페이지 크기로 확인한다. header/토큰은 main 메모리만, service_role 및 운영 URL 금지, redirect/retry 금지다.
- mutation은 host가 만든 UUID와 불변 payload를 보존하고 pending 중복 실행을 차단한다. 결과 불명확 시 자동 재시도하지 않는다. 성공 응답 후 권위 데이터를 재조회하고, 재조회 실패를 빈 목록/저장 실패와 혼동하지 않는다. 학교·계정·모드 변경 시 Adapter dispose/abort 및 epoch 갱신으로 이전 캐시/응답을 폐기한다.
- 현재 Preview UI는 `previewMutation` 합성 계약이므로 실제 연결 시 별도 UUID DTO presenter가 필요하다. 순수 카드/표 디자인은 재사용하되 합성 adapter를 실제 쓰기에 연결하지 않는다. 입력·대화상자 수집 계약을 먼저 비교한다.

### 이번 구현의 보안 경계

기존 로컬 JSON 메뉴와 Preview 디렉터리/저장소/IPC/백업은 변경하지 않았다. 개발 빌드에서 세 번째 메뉴 `물품관리 — 로컬 QA`를 제공하며 실제 연결 BLOCKED 안내만 표시한다. 자격정보 입력·실제 재고·합성 Preview 목록은 표시하지 않는다. 다른 모드의 데이터를 읽거나 전송하지 않는다.

Main의 `p2:inventory-local-qa:status`는 **인자 없는 단일 상태 API**다. exact sender/window/frame/URL 검사 후 `!app.isPackaged`, 정확한 dev URL `http://127.0.0.1:5174/`, `INVENTORY_LOCAL_QA=1`을 모두 요구한다. 유일한 요청은 `GET http://127.0.0.1:56321/auth/v1/health`, body/인증 header 없음, 응답 16KiB, 전체 3초, redirect 미추적, 중복 점검 차단이다. 응답 body·상세 예외·URL·로그인 정보는 renderer에 반환하지 않는다. 기존 renderer network allowlist/CORS는 유지한다. 200 응답도 Auth 게이트웨이 응답 여부만 의미하며 DB/Auth/RPC/학교 권한 READY가 아니다. `inventoryConnection:'blocked'`, `persisted:false`를 반환한다.

개발자 환경에서 기존 `npm run electron:p0:dev`를 실행할 때 `INVENTORY_LOCAL_QA=1`을 해당 프로세스에만 설정할 수 있다. 이번 Cloud 세션에서는 실행/설치/로컬 스택 연결을 하지 않았다. 상태 점검도 사용자가 버튼을 누를 때만 수행한다. 화면을 떠날 때 늦은 응답을 무시하고 이전 포커스를 복원한다. 980×700 포함 좁은 화면에는 스크롤 가능한 별도 패널을 사용하지만 실제 GUI 레이아웃은 NOT RUN이다.

### 검증 및 후속 순서

- 신규 경계/UI 집중 테스트 **16 PASS**. Production/비활성화 차단, 잘못된 호출자/endpoint 인자 거부, timeout/size/redirect/중복 점검, 비저장 상태, UI에서 네트워크·기존 저장 IPC 미호출을 검증했다.
- Inventory 및 관련 policy/sample/memo IPC 집중 회귀 **12개 파일 / 70 PASS (위 16건 포함)**. 기존 JSON 저장·백업, Preview 무네트워크/분리 검증을 포함한다.
- `npm run electron:p0:build` **PASS**: Main/Preload, renderer, 테스트 TypeScript 및 Electron 프로덕션 Vite 빌드. 프로덕션 renderer JS에 Local QA 메뉴/화면 문구가 없음을 확인했다. 기존 chunk size 경고는 남아 있다.
- `npm run lint`, `npm run typecheck`는 package.json에 없다. 새 도구/프레임워크를 설치하지 않았다. diff 검사 및 기존 Electron TypeScript 빌드를 사용했으며 lint PASS로 표시하지 않는다.
- 요청된 `npm run build`는 root `tsc`에서 **FAIL (26 diagnostics)**. 기준 Preview의 읽기 전용 `tsc --noEmit` 결과와 경로 정규화 후 26개 진단이 모두 동일하다. 기존 Window.electronWork 선언 및 공문 session 타입 문제이며 범위 밖 수정은 하지 않는다. Electron 빌드 PASS와 구분한다.
- 실제 Local PostgreSQL/Auth/RPC E2E **NOT RUN**, 실제 로그인/학교 전환/수량 변경/중복 mutation 방어 **BLOCKED**, 실제 Windows Electron GUI **NOT RUN**. DB CI READY를 이 결과로 전용하지 않는다.
- 후속: Cloud B가 transport 계약을 제공하면 고정 SHA의 필요한 파일만 선별하고 typed 업무 IPC/UUID presenter/대화상자 연결을 구현한다. 기존 DB QA CI의 local fixture stack에서 main service를 동일한 loopback 제한으로 실행하여 로그인→학교 권한→목록/상세→RPC→재조회→로그아웃/학교 전환과 중복 UUID/불명확 결과를 검사한다. 합성 계정/키는 CI에서만 생성하고 artifact/log에 남기지 않는다. 이후 별도 Windows GUI에서 모드 분리·980×700·대화상자 스크롤/포커스를 확인한다.

로컬 체크포인트만 허용하며 **원격 push/PR/merge/배포는 하지 않는다**. 이 단계는 운영 또는 실제 Inventory 연결 완료가 아니다.

## INV-EL-03 — Main/Preload 업무 IPC 및 Local QA 화면 (2026-11-03)

**CONDITIONAL — 구현·자동 검증 완료 / 실제 DB E2E·Windows GUI NOT RUN.** INV-EL-01의 실제 Adapter 연결 BLOCKED는 이 코드에서 해소했지만, 실행 환경·실제 Auth/RLS/RPC 검증 완료를 의미하지 않는다. 기존 DB CI READY를 이번 Electron 연결 PASS로 전용하지 않는다.

### 고정 기준 및 소유권

- Cloud A base: `feature/electron-inventory-local-qa` / `4b37d7885050f174fddeeb4af2441c9efccd1108`.
- Cloud B source: `codex/inventory-electron-transport` / `416599bb78e6dbe9e8261beca8a54b6b02828a9e`.
- DB QA reference: `ci/inventory-postgres-integration-qa` / `95e4f10415a971790d476dd58ac42a12b1ffb80c`, Actions `41467324396` (이전 코드의 인계 증거).
- 독립 worktree `/workspace/BOGUNON_DESK-inventory-el03`, branch `feature/electron-inventory-el03`. Newsletter, 기존 통합/Inventory/CI/main 작업본은 수정하지 않는다. 로컬 checkpoint commit까지만 승인됐으며 원격 push/PR/merge/deploy는 하지 않는다.
- [Cloud B 계약](https://github.com/school-health-hub/BOGUNON_DESK/blob/416599bb78e6dbe9e8261beca8a54b6b02828a9e/docs/inventory-management/INV-EL-02-transport-contract.md)의 `src/inventory-management/connection/{electron,localQa,contracts,responses,validation,transport}.ts` **6개만** `electron-p0/main/inventory-connection/`으로 바이트 그대로 선별했다. Main tsconfig의 rootDir/output 구조를 지키고 Renderer/Preview import를 피하기 위한 Main 전용 위치다. Browser factory/원본 Cloud B 소유 경로/SQL/RPC/RLS/migration은 변경하지 않았다. 이후 B 변경도 고정 SHA와 6개 의존성 계약을 함께 검토한다.

### 실행과 보안

실제 Main이 읽는 `app.isPackaged`, 정확한 dev URL `http://127.0.0.1:5174/`, `INVENTORY_LOCAL_QA=1`을 매 호출에서 확인하고 `NODE_ENV=production`도 차단한다. Main의 `INVENTORY_LOCAL_QA_PUBLIC_KEY`에는 해당 로컬 스택의 publishable/anon 키만 주입한다. 예제 키/계정/비밀번호를 설정 파일에 저장하지 않으며 운영 키·service_role은 금지한다. 키가 없거나 잘못되면 실패한다. 기존 개발 명령 `npm run electron:p0:dev`를 사용하되 이번 Cloud 작업에서는 실제 앱/DB 스택을 실행하지 않았다.

- `inventory-qa-transport.ts`: Main-only `createElectronInventoryConnection`에 transport v1을 주입한다. 고정 `127.0.0.1:56321`에만 Node HTTP로 요청하며 DNS/외부 URL/환경 proxy를 통한 외부 라우팅·redirect·자동 retry를 허용하지 않는다. shared validator의 method/table/RPC/query/body/key 제한을 재검사한다.
- request 64KiB, Auth response 32KiB, REST/RPC response 2MiB, 전체 15초. Content-Length를 신뢰하지 않고 스트리밍 byte를 집계한다. 초과/timeout/abort/응답 중단 시 request를 destroy하고 listener/timer를 정리한다. raw body/key/JWT/비밀번호를 로그나 UI 오류로 반환하지 않는다. 외부 설정 URL·renderer header 지정 기능은 없다.
- `inventory-qa-service.ts`: window별 Adapter/handle 소유, exact sender/frame/URL 전후 검사, exact arity/schema/UUID·문자열 수량 검사, 결과 IPC 크기 제한, 고정 한국어 오류. auth/school 전환·만료·dispose/창 close/navigation/render-process-gone에서 컨텍스트를 무효화한다. 무효화 revision은 단조 증가하고 read 응답은 이전 컨텍스트면 거절한다. 캐시/토큰은 Main 메모리 전용이다.
- Main에서 logical request UUID를 생성하고 immutable PreparedMutation을 opaque handle에 저장한다. 같은 payload 준비는 같은 handle/UUID를 반환하고 중복 실행을 차단한다. Renderer는 requestUuid/다른 payload를 execute에 덧붙일 수 없다. 정상 결과 재확인도 같은 UUID를 쓴다. 결과 불명확 시 새 준비 요청을 차단하고 같은 handle로 명시적 재확인만 허용한다. unknown 후 discard는 handle만 해제하며 불명확 tombstone을 해당 컨텍스트에 유지한다. 학교/계정/모드 전환 시 요청/인증 컨텍스트는 폐기되므로 재작업 전 서버 권위 데이터를 확인해야 한다.
- `registerItem`의 결과가 불명확하면 같은 세션에서 재등록을 차단한다. INSERT에는 서버 멱등 UUID 계약이 없으므로 자동 replay를 추가하지 않는다.

### IPC / 화면 계약

기존 `p2:inventory-local-qa:status`와 `inventoryLocalQa.status()`는 **3초/16KiB·고정 health GET 전용 계약 그대로**다. `inventoryConnection:'blocked'`는 기존 health 응답 계약이며 업무 연결 상태로 사용하지 않는다. health 200/실패 어느 쪽도 DB/로그인/저장 성공이 아니다. 명시적인 상태 점검 후 별도 업무 화면을 열며 health 접근이 제한됐어도 실제 로그인 요청 결과로 판단한다.

새 Preload API는 `window.electronWork.inventoryLocalQa?.business` 아래에 다음 메서드만 제공한다. 채널은 각각 `p2:inventory-local-qa:<method>`이고 generic invoke/send/URL/header/token API는 없다.

- `login({email,password})`, `logout()`, `authState()`, `dispose()`
- `selectSchool({contextRevision,schoolId})`
- `listItems({contextRevision})`, `itemDetail({contextRevision,itemId})`, `movements({contextRevision,itemId?})`
- `purchaseBatches({contextRevision})`, `purchaseProgress({contextRevision,batchId})`
- `registerItem({contextRevision,item:NewItem})`
- `prepare({contextRevision,operation,input})` → `{handleId,requestUuid}`
- `execute({contextRevision,handleId})` → 검증된 `{persisted:true,data,refreshRequired:true}`
- `discard({contextRevision,handleId})` → null (서버 rollback/cancel 아님)

`inventory-qa-protocol.ts`의 별도 `InventoryQaResult<T>`는 성공 시 `{contextRevision,value}`, 실패 시 `{contextRevision,code,serverCode?,outcomeUnknown,retryable:false,message}`를 반환한다. 공용 기존 IpcResult enum을 Adapter 오류로 확장하지 않았다. 결과 불명확/인증 만료/권한 거부/연결 실패/충돌을 구분하고 상세 서버 오류는 숨긴다.

화면은 기존 Local QA 패널과 화이트/네이비/민트를 유지한다. 합성 `example.invalid` 로그인 → 명시적 학교 UUID/멤버십 확인 → 서버 목록/상세/로트/유효기간·문자열 재고 → 품목 등록 또는 입고/사용/폐기/정정 검토 → prepare → 별도 실행 → 서버 결과 재조회 → logout을 제공한다. 목록/상세는 실제 DTO 전용으로 기존 numeric JSON 또는 synthetic-* ID를 캐스팅하지 않는다. 서버 변경 성공과 후속 재조회 실패를 구분한다. 계정/학교 전환 전 데이터와 입력 폼을 비우고 늦은 응답은 무시한다. 모드를 떠나면 Main dispose와 포커스 복원을 수행한다. 인증 상태는 Main 메모리 IPC만 주기적으로 확인하며 refresh token endpoint는 없다. 실제 화면 980×700/키보드/포커스는 Windows QA 대상이다.

기존 로컬 JSON 저장·백업·`inventory.load/save`, Preview 소스/무네트워크 정책, Purchase/공문/Newsletter 및 Tauri는 변경하지 않았다. Production renderer에는 Local QA 메뉴/업무 화면 코드가 제거되고 Main에서도 패키지/Production 호출을 거부한다.

### 자동 검증 및 미검증

- `npx vitest run electron-p0/tests/inventory electron-p0/tests/policy.test.ts electron-p0/tests/sample-ipc.test.ts electron-p0/tests/memo-ipc.test.ts`: **17개 파일 / 102 PASS**. 기존 JSON/Preview 경계, 실제 Adapter+합성 wire를 통한 로그인/학교/품목/4종 RPC/재조회/logout, bigint 문자열, UUID replay/unknown/discard/소유권/무효화, HTTP 고정 목적지/크기/timeout/abort/redirect, 실제 preload 코드의 VM 실행 계약, native Node ESM factory DEV 성공/PROD 차단을 포함한다. 실제 Electron GUI/실제 DB를 Mock 테스트로 대체해 PASS라고 하지 않는다.
- `npm run electron:p0:build`: **PASS**, Main/Preload·renderer·테스트 TypeScript 및 Electron production build. 기존 chunk-size 경고는 유지한다. Production renderer JS에서 Local QA 메뉴/로그인/품목 폼 문구가 제거된 것을 검사했다.
- `npm run build`: **FAIL — root TypeScript 26개 진단**. 이전 Preview 기준 진단과 경로 정규화 후 모두 동일하다. 기존 Window.electronWork 선언/공문 session 타입 범위를 확장해 수정하지 않는다. Electron 전용 빌드 PASS와 구분한다.
- `lint`, `typecheck` npm script는 존재하지 않는다. 신규 lint/QA framework를 도입하지 않았다. 기존 Electron TypeScript 및 diff/범위/secret 패턴 감사를 사용하며 lint PASS로 표시하지 않는다.
- 실제 Local PostgreSQL/Auth/RLS/RPC E2E **NOT RUN**, 실제 Electron Main/Preload 프로세스 간 실행 **NOT RUN**, Windows GUI/파일 설치 QA **NOT RUN**. 운영 Supabase/실제 학교 자료는 사용하지 않았다.

### 후속 DB CI / Windows 인계

별도 승인 후 CI 기준 `95e4f10...`의 stack/reset/migration/합성 Auth fixture와 기존 SQL 기대값을 보존한 독립 CI에서 검증한다. 기존 Browser 경로와 B의 `INVENTORY_QA_TRANSPORT=electron-host` 경로를 먼저 분리 실행하고, 다음으로 이 Main service를 native ESM으로 emit하여 실제 고정 loopback transport/typed method/contextRevision으로 동일 흐름을 검증한다. Native service 실행은 실제 Electron IPC PASS가 아니므로, 별도 Electron host에서 실제 Preload→Main 채널/forged caller·Production 차단·모드 종료도 검증한다. 합성 키/JWT/비밀번호/raw HTTP body를 artifact/log에 올리지 않는다. 이번 작업은 CI 브랜치를 수정하거나 Actions를 실행하지 않는다.

Windows에서는 고정 checkpoint에서 DEV opt-in/로컬 공개 키만 프로세스에 주입하고 JSON/Preview/Local QA 모드 분리, 로그인/만료/logout, 학교 전환/권한 거부, 등록·입고·사용·폐기·정정 및 동일 UUID 재확인, unknown 후 재전송 차단, 앱/모드 종료 후 세션 정리, 980×700 스크롤/포커스/긴 UUID 표시를 확인한다. 운영 앱/데이터는 그대로 둔다. Newsletter의 Windows 출력·디자인 QA는 독립 작업이며 선행조건으로 묶지 않는다.
## Newsletter B안 편집 구조 선별 이식 — 미커밋 검토본 (2026-11-03)

기준은 `integration/newsletter-json-guard` / `e78ee6c8035a5130fb1a5014b88e435a69a82565`, 참고 소스는 `feature/newsletter-studio` / `d7f9a01b1222c068002b3bb0aa00bfaba4ce5e2a`다. 별도 worktree/브랜치 `feature/newsletter-b-editor-port`에서 필요한 스키마·편집·Scene/SVG·자산 참조 코드와 집중 테스트만 선별했다. 원본 NewsletterStudio, Main/Preload IPC, JSON/프로젝트 저장 어댑터, 다른 작업실 및 Inventory, Tauri/Rust는 변경하지 않는다. 승인 전 commit/push/PR/merge/deploy는 하지 않는다.

- 기존 B안 JSON의 officialTemplate, 표시/마스크, foregroundMask, referenceLayout, visualFinish, feather를 현재 문서와 혼합 V1/V2 revision에서 보존한다. `compatibility.ts`와 `studioDocument.ts`는 바이트 단위로 유지하며 새 미지원 필드/enum은 계속 거부한다. 스키마 허용과 compiler/React/SVG 이식을 함께 수행했다.
- 기존 JSON에 이미 있는 요소만 편집한다. 위치/크기/겹침 순서, 글자 크기/색, 원고에 연결된 한글 문구, 마무리 문구, 이미지 교체/맞춤/표시/마스크 토글을 제공한다. 문구는 기존 원고 편집 계약을 사용하며 숫자/강조 등 파생 binding은 임의의 literal로 바꾸지 않는다. 여러 줄 원고는 기존 원고 편집 textarea를 사용한다. 한국어 원고는 명시적인 사용자 반영 전에는 변경하지 않는다. 공통 원고 binding을 참조하는 다른 표시에도 해당 사용자 수정이 반영될 수 있으나 다른 카드의 레이아웃/요소를 자동 수정하지 않는다.
- B안 구성 생성 모듈·자동 적용 버튼, 월/학교 유형 신규 작성 UI는 추가하지 않았다. 기존 프리셋을 재설계하지 않으며, 기존 템플릿 편집 중에는 프리셋 전환 UI로 구조가 소실되지 않도록 기존 요소 편집만 노출한다.
- 이미지 교체 시 ID/SHA가 달라진 마스크를 제거하는 원본 규칙을 재사용하고 이전 revision은 유지한다. 화면의 이미지 후보도 기존 승인·사용 범위 필터를 지킨다. 레지스트리, 공식 수달쌤 원본 PNG/ID/SHA 및 pending 상태는 변경하지 않는다. 숨긴 수달쌤을 공식 요소에서만 참조해도 출력 승인 검사를 통과할 수 없다.
- React 미리보기와 출력 SVG는 같은 Scene hash 및 polygon/feather geometry를 사용한다. PNG/PDF는 기존 Electron 승인 검증·파일 대화상자·원자적 저장 경로를 사용한다. 원본 최신 renderDocument의 전체 교체 대신 B안 compiler 연결만 반영하여 기존 Electron 한글 A4 제목/부제 줄바꿈 보정을 보존했다.
- 합성 JSON fixture는 이전 호환성 gate에서 고정 최신 소스로 생성한 자료이며 사용자 원본·이미지 bytes·학교/학생 자료가 아니다. 별도의 승인 합성 이미지 테스트는 저장소에 이미 있는 1px 테스트 PNG를 사용하며 실제 pending 자료를 approved로 승격하지 않는다.

집중 검증은 기존 V1/V2/Guard/Revision/출력/파일 실패 보호와 선별 원본 렌더링 테스트, B안 JSON/혼합 history/내부 저장소 재생성/명시적 복구/충돌/취소, 요소 UI 편집 및 React/SVG 일치를 포함한다. B안 출력 engine 테스트의 rasterizer와 engine PDF 포트는 대역이다. 별도로 실제 pdf-lib PNG decode 및 7페이지 PDF 생성/재열기를 검증하지만, 실제 Canvas 고해상도 PNG와 Windows GUI 시각 검증을 대체하지 않는다. 구체적인 최종 실행 건수와 빌드 결과는 작업 완료 보고에서 확인한다.

Windows 후속 QA: 고정 체크포인트에서 V1/V2/B안 열기·요소/문구/마스크 편집·이미지 재연결·JSON 저장/재열기·앱 재실행·Revision 복구, native dialog 취소/덮어쓰기/오류, 실제 한글 Canvas PNG/PDF와 미리보기의 일치, A4 1장/카드 7장, pending 출력 차단을 확인한다. 원본 프레임을 보존하므로 긴 제목·두 자리 월·문구 길이에 따른 기존 조판 overflow는 자동 디자인 변경 없이 출력 차단 사유로 남긴다. B안 디자인은 **REVISE / PENDING**이며 구조 지원을 디자인/출력 승인으로 해석하지 않는다. 이전 프로젝트 저장 상태 문구 잔류는 이번 범위에서 수정하지 않았다. 정책 차단된 자동 저장 직접 계측은 재시도하지 않았고 NOT VERIFIED를 유지한다. 실제 Windows/Canvas GUI 검증 전 최종 판정은 **CONDITIONAL**이다.

최종 자동 검증: `npx vitest run src/newsletter electron-p0/tests/newsletter electron-p0/tests/policy.test.ts electron-p0/tests/sample-ipc.test.ts electron-p0/tests/memo-ipc.test.ts` — **51개 파일 / 253 PASS** (B안 전용 13건 포함). `npm run electron:p0:build` — Main/Preload·renderer·테스트 TypeScript 및 프로덕션 빌드 PASS. `git diff --check` PASS. 실제 GUI/Canvas/Windows는 NOT RUN, 자동 저장 직접 계측은 NOT VERIFIED 유지.

변경 파일 전수 목록(41개):

```text
docs/ELECTRON_P0.md
electron-p0/tests/fixtures/newsletter-b-synthetic.json
electron-p0/tests/newsletter-b-fixture.ts
electron-p0/tests/newsletter-b-integration.test.ts
electron-p0/tests/newsletter-b-ui.test.tsx
electron-p0/tests/newsletter-compatibility.test.ts
src/newsletter/output/svgRenderer.ts
src/newsletter/rendering/NewsletterDesignEditor.tsx
src/newsletter/rendering/NewsletterEditorialControls.tsx
src/newsletter/rendering/NewsletterPreview.tsx
src/newsletter/rendering/OfficialElementCopy.tsx
src/newsletter/rendering/OfficialTemplateControls.tsx
src/newsletter/rendering/assetResolution.ts
src/newsletter/rendering/designSchema.ts
src/newsletter/rendering/designState.ts
src/newsletter/rendering/editorialCompiler.ts
src/newsletter/rendering/editorialScene.ts
src/newsletter/rendering/editorialState.ts
src/newsletter/rendering/editorialVisualFinish.test.ts
src/newsletter/rendering/editorialVisualFinish.ts
src/newsletter/rendering/illustratedCardPreset.ts
src/newsletter/rendering/imageFeather.ts
src/newsletter/rendering/imagePolygon.test.ts
src/newsletter/rendering/imagePolygon.ts
src/newsletter/rendering/mascotQuality.ts
src/newsletter/rendering/officialAssetProfiles.ts
src/newsletter/rendering/officialTemplate.test.ts
src/newsletter/rendering/officialTemplate.ts
src/newsletter/rendering/officialTemplateCompiler.ts
src/newsletter/rendering/officialTemplateRecipes.ts
src/newsletter/rendering/officialTemplateSchema.ts
src/newsletter/rendering/officialTemplateValidation.test.ts
src/newsletter/rendering/referenceLayout.test.ts
src/newsletter/rendering/referenceLayout.ts
src/newsletter/rendering/referenceLayoutCompiler.ts
src/newsletter/rendering/referenceLayoutScene.ts
src/newsletter/rendering/renderDocument.ts
src/newsletter/rendering/renderScene.ts
src/newsletter/rendering/skillMasterPreset.ts
src/newsletter/rendering/visualFinishCompiler.ts
src/newsletter/rendering/visualFinishScene.ts
```

## INT-EL-01 — Newsletter B안 + Inventory EL-03 선별 통합 (2026-11-03)

**CONDITIONAL — 동일 Electron 소스의 통합·자동 검증 완료 / native CLI·실제 Windows QA 잔여.** 기존 독립 QA와 INV-EL-04 CI 성공을 새 통합본의 실제 DB/GUI PASS로 전용하지 않는다. 원격 push/PR/merge/deploy는 승인되지 않았다.

### 기준과 통합 방법

- 기반: `feature/electron-inventory-el03` / `9915eff1ea5a016977b017ab9bedf9f1f9070e1f`.
- 순차 적용: Guard 단일 변경 `e78ee6c8035a5130fb1a5014b88e435a69a82565`, B안 단일 변경 `f29a30ce148952b415451cd2a8cf1e9fb57e1d9d`.
- CI 참고만: `fc609c02358fe44a7bd6d9d7518cd82f99fe8a1f` / Actions `41483149925` Linux 실제 DB + Windows 계약 job 성공. CI 6개 파일은 통합하지 않았다.
- 전용 branch/worktree: `integration/electron-int-el01`, `/workspace/BOGUNON_DESK-int-el01`. 네 원격 SHA와 기존 clean 상태를 먼저 확인했다. 기존 기능 브랜치/작업본은 변경하지 않았다.
- 전체 브랜치 병합/소스 전체 교체 없이 두 commit의 patch만 no-commit 방식으로 적용했다. Guard에서는 protocol 첫 부분, B안에서는 문서 append가 충돌했다. Inventory type-only import와 Newsletter 오류 상수 및 양쪽 문서 기록을 모두 보존했다. Main은 자동 적용 후 내용 검토로 확인했다. 중간 cherry-pick/sequencer는 정리하고 하나의 최종 로컬 checkpoint로 보존한다.

### 공유 경계 및 보호

`main.mts`는 기반의 Inventory 서비스/업무·health 채널/window close/navigation/process 종료 처리에 **Newsletter JSON 저장 전 validate 연결 한 줄만** 추가했다. `protocol.ts`는 Inventory API type-only import/bridge에 Newsletter 오류 상수 한 줄만 추가했다. Preload/Inventory 공개 API/서비스/transport/6개 B vendor 파일은 기반과 동일하다. shared type을 runtime import로 바꾸지 않았다.

B안/Guard 파일은 Newsletter source와 바이트 단위로 비교했다. 예외는 위 공유 파일·문서 및 `NewsletterProjectControls.tsx`의 명시적인 `NewsletterProjectsBridge` 타입 주석뿐이다. 이 주석은 root 빌드에서 guard가 추가한 문서 접근의 unknown 파생 오류를 막는 최소 수정이며 실행 동작/IPC/저장 어댑터를 바꾸지 않는다.

- V1/V2/B안 JSON·혼합 revision 복구·요소 편집·React/Scene/SVG·A4 1장/카드 7장·미지원 필드/enum 거부·pending 출력 차단은 통합 소스에서 회귀 검증했다.
- Asset registry/수달쌤 PNG·SHA(`fd90b63e8d78ee53eb796c130315ac71d4c5a2a8b4af92e8e03cefdccc3ce302`)/승인 계약은 그대로다. 디자인은 **REVISE / PENDING**. 신규 이미지·원고 자동 수정·B안 자동 적용 버튼은 없다.
- Inventory JSON/Preview/개발 opt-in Local QA를 유지한다. Main 소유 인증/학교/UUID prepare/execute/replay/재조회/unknown/권한/만료/종료·Production 차단 테스트와 실제 preload VM 계약을 재사용했다. 운영 Supabase/학교 데이터를 사용하지 않는다.
- Dashboard/Dock·메모·Purchase·Finder·공문 소스/CLI 및 package/lockfile/tsconfig/builder를 변경하지 않았다. 공문 home-v1/PDF/HWPX/ODT/안전 저장 코드는 기존 그대로다.
- production renderer boundary manifest에 Main service/transport/connection 구현이 없고, production JS에 Local QA 메뉴·로그인·품목 폼 문구가 제거됨을 확인했다.

### 실행한 자동 검증

- Newsletter 전체 집중 + Inventory + 공유 IPC + desktop/settings + Purchase session/domain + Finder model/library + 공문 UI/generator + Dashboard/Dock 저장/geometry/Dock UI: **77개 파일 / 439 PASS**, `--maxWorkers=2` 사용.
- 별도 공문 안전 writer/caller/cancel 및 Purchase 전문 출력 validation/obsolete preview: **5 PASS / native 2개는 필터로 NOT RUN**. 통합 합계 **444 PASS**.
- 첫 실행은 빌드와 병렬 수행 중 B안 파일 저장 테스트 1개가 기존 5초 제한을 넘었고, 위 두 native 테스트가 실행 파일 부재로 실패했다. 코드/검증 조건/timeout을 완화하지 않았다. worker 수를 제한한 집중 실행에서 B안 저장 테스트는 원래 제한으로 통과했다. native 테스트는 실제 엔진이 시작되지 못했으므로 미검증이며 PASS에 합산하지 않는다.
- 공문 native 파일 import/export/reimport 및 정산/에듀파인 실제 CLI 출력 **2건 NOT RUN**: 새 worktree에 CLI 바이너리가 없고 Cargo도 없다. 다른 worktree 바이너리를 복사하거나 도구 설치·원본 테스트 삭제/비활성화·Rust 재검증 확장을 하지 않았다. 기존 독립 QA 증거는 유지하지만 통합본 실제 실행 증거로 대체하지 않는다.
- `npm run electron:p0:build`: **PASS**, Main/Preload·renderer·테스트 TypeScript 및 Electron production build. 기존 chunk-size 경고는 유지한다.
- `npm run build`: **FAIL, 남은 root 진단 15건**. 기반 26건과 최초 통합 29건을 비교했다. 최초 추가 3건은 bridge 미타입화로 인해 Guard의 r.document/p.document 접근에서 파생됐다. 기존 bridge 타입을 명시하여 새 오류를 해소하고 기존 파생 11건도 함께 없어졌다. 최종은 기존 Window.electronWork 선언 관련 13건 + 공문 session 계약 2건이다. 파일/오류 코드/메시지를 비교한 새 진단 서명은 0이며 tsconfig/대상 파일을 줄여서 통과시키지 않았다. root 전체 PASS라고 표시하지 않는다.
- 변경 전수 범위/secret·PII 패턴 및 staged/working diff 공백 검사 PASS. 실제 DB·GitHub Actions·Windows GUI/Canvas/native dialog/설치 QA는 이번 통합본에서 **NOT RUN**.

### 다음 검증

INV-EL-04는 product SHA `9915eff...` 고정 및 정확한 QA ref guard가 있어 이 통합본을 그대로 실행 대상으로 사용할 수 없다. 별도 승인 후 최종 통합 checkpoint SHA를 새 QA 기준으로 고정하되 기존 격리·timeout·실제 DB 필수 case/production guard를 완화하지 않는다. Windows에서는 메뉴/Dock/트레이/재실행, Newsletter 이미지 재연결·실제 한글 Canvas PNG/PDF·파일 취소/덮어쓰기·revision, Inventory 실제 Electron IPC/세 모드/계정·학교 전환, 공문 native 파일 경로 중심으로 검증한다. 이전 저장 상태 문구 잔류와 B안 디자인 검토, root 타입 오류는 잔여 사항으로 유지한다.

INT-EL-01 변경 파일 전수(52개):

```text
docs/ELECTRON_P0.md
electron-p0/main/main.mts
electron-p0/main/newsletter-export.ts
electron-p0/main/newsletter-json.ts
electron-p0/main/newsletter-project-ipc.ts
electron-p0/protocol.ts
electron-p0/renderer/adapters/NewsletterProjectControls.tsx
electron-p0/tests/fixtures/newsletter-b-synthetic.json
electron-p0/tests/newsletter-b-fixture.ts
electron-p0/tests/newsletter-b-integration.test.ts
electron-p0/tests/newsletter-b-ui.test.tsx
electron-p0/tests/newsletter-compatibility-fixtures.ts
electron-p0/tests/newsletter-compatibility-ui.test.tsx
electron-p0/tests/newsletter-compatibility.test.ts
electron-p0/tests/newsletter-json.test.ts
src/newsletter/compatibility.ts
src/newsletter/output/svgRenderer.ts
src/newsletter/rendering/NewsletterDesignEditor.tsx
src/newsletter/rendering/NewsletterEditorialControls.tsx
src/newsletter/rendering/NewsletterPreview.tsx
src/newsletter/rendering/OfficialElementCopy.tsx
src/newsletter/rendering/OfficialTemplateControls.tsx
src/newsletter/rendering/assetResolution.ts
src/newsletter/rendering/designSchema.ts
src/newsletter/rendering/designState.ts
src/newsletter/rendering/editorialCompiler.ts
src/newsletter/rendering/editorialScene.ts
src/newsletter/rendering/editorialState.ts
src/newsletter/rendering/editorialVisualFinish.test.ts
src/newsletter/rendering/editorialVisualFinish.ts
src/newsletter/rendering/illustratedCardPreset.ts
src/newsletter/rendering/imageFeather.ts
src/newsletter/rendering/imagePolygon.test.ts
src/newsletter/rendering/imagePolygon.ts
src/newsletter/rendering/mascotQuality.ts
src/newsletter/rendering/officialAssetProfiles.ts
src/newsletter/rendering/officialTemplate.test.ts
src/newsletter/rendering/officialTemplate.ts
src/newsletter/rendering/officialTemplateCompiler.ts
src/newsletter/rendering/officialTemplateRecipes.ts
src/newsletter/rendering/officialTemplateSchema.ts
src/newsletter/rendering/officialTemplateValidation.test.ts
src/newsletter/rendering/referenceLayout.test.ts
src/newsletter/rendering/referenceLayout.ts
src/newsletter/rendering/referenceLayoutCompiler.ts
src/newsletter/rendering/referenceLayoutScene.ts
src/newsletter/rendering/renderDocument.ts
src/newsletter/rendering/renderScene.ts
src/newsletter/rendering/skillMasterPreset.ts
src/newsletter/rendering/visualFinishCompiler.ts
src/newsletter/rendering/visualFinishScene.ts
src/newsletter/studioDocument.ts
```

## DESIGN-06 — selective Soft Rose integration candidate

Integration base: `integration/electron-int-el01@bd22237aade2d5576d5c3c1b8b991ad914357398`. Approved product reference: `e919dc4b552879e6c49dbd3d8887d8d45c3cdd74`. Candidate branch: `integration/electron-soft-rose-candidate`. Existing integration/main/Cloud B branches are not updated.

Applied by explicit per-commit path patches, not branch merge or whole-tree overwrite:
1. `6a17ea7`: Portable root Inventory protocol inclusion, generated Official CLI output ignore, prepack runtime graph gate. `1720be7`: native Windows ASAR lookup and actual electron-builder file matcher in the formal regression test.
2. `52b0802`: INT-EL-04 tool cards/accessibility, disabled Newsletter output indication and small-window presentation.
3. `b54bbe4` + `036ff1e`: Electron-only Soft Rose theme, Surface/Dock/tool/settings/modal UI, actual material pseudo-layer correction and compact clock/summary styles.
4. `e919dc4`: bounded Windows rename/EPERM replacement retry with permanent-failure preservation tests. Validation/IPC/JSON shape unchanged.

Excluded: `2a49b94` QA workflow and `scripts/electron-p0/int-el03b-artifact.mjs`, all subsequent SHA-pinned workflows, diagnostic bootstrap/e2e tests, failure fixtures and artifacts. Formal runtime-package/int-el04-ui/soft-rose-surface/settings-replacement regressions are retained. No dependencies/frameworks added. Product-path comparison against approved e919dc4 is identical; handoff text is curated instead of importing obsolete QA history.

Preservation: all13 widget identities, coordinates/minima/visibility/resize, settings and Dock versions, original work modules, Newsletter Guard/approval policy, Inventory JSON/Preview/Local QA and Main Transport/security remain intact. `src`, `src-tauri`, main entry, Preload and Protocol are unchanged against integration base. Only main/settings.ts's verified replacement behavior changes in Main.

Validation must run on the new committed candidate SHA, not inherited source QA: Electron TypeScript/build, focused UI/storage/EPERM/security regressions and runtime ASAR graph. Reuse registered Windows visual workflow from separate QA tooling pinned to this candidate; do not add SHA-specific QA files to the product candidate. Previous Windows source checks/design user approval are provenance only. Native DPI, physical multi-monitor, native file dialogs/install/uninstall remain NOT RUN for integration.

## Electron 로컬 물품관리 실사용 기능

- 기준: `feature/electron-official-document-flow@e23ccffc419bfcd4a4c42f4b714ca0d326a9cf0b` (원격 보존 완료). 개발 브랜치: `feature/electron-inventory-practical`. Finder/Purchase 저장, Newsletter 새 작성, 로컬 업무, 공문 흐름을 조상 커밋으로 모두 포함한다.
- 물품 등록·수정, 이름 검색/부족·만료 필터, 로트·유효기간, 입고·사용·폐기 및 변경 이력을 기존 로컬 화면에 연결했다. 만료·격리 재고는 사용할 수 없고 폐기는 가능하다. 차감은 선택 로트 또는 유효기간 순서로 처리한다. 기록이 있는 물품은 기본 단위 변경/삭제를 차단해 이력을 보존한다.
- 새 저장소는 빈 상태로 시작하며 합성 재고를 자동 생성·저장하지 않는다. 기존 JSON은 자동 정리/이전하지 않는다. 이름·단위·권장 재고 등 v1 문서 구조와 파일명(`inventory.json`, `inventory.backup.json`)을 유지한다.
- Main 고정 경로: Electron `userData/work-data/inventory`. 기존 `inventory.load/save`를 재사용하며 선택적 `expectedUpdatedAt` 인자를 추가했다. 큐·원자적 교체·이전 정상 파일 백업, 저장 충돌 거부, 안전 정수/날짜/합계 검증, 이력 수정 방지를 적용한다. 실패 시 화면의 기존 재고와 입력을 보존한다. 백업으로 읽은 경우는 원본·백업 보호를 위해 읽기 전용이다. 자동 복구/덮어쓰기는 하지 않는다.
- 부족 또는 임의 구매 후보를 선택하고 전달용 규격·수량을 검토한 뒤 명시적으로 확인한다. 기존 Purchase 세션 품목 뒤에 한 번만 추가하며 단가는 비워 둔다. 기존 품의·정산 입력을 초기화하지 않는다. 구매 전달은 재고를 변경하거나 서버에 저장하지 않는다. 규격은 전달용 세션 값이며 JSON 필드를 추가하지 않았다.
- 로컬 JSON / 합성 Preview / 개발 Local QA는 분리한다. Cloud B 연결 모듈·SQL/RPC/RLS, 서버·운영 DB, Finance, Tauri 및 Soft Rose Surface 디자인은 변경하지 않는다.
- Cloud 검증: 관련 Vitest 21개 파일 **151 PASS**, 기존 Main/Preload ASAR 런타임 검사 **3 PASS**, Electron Main/Preload·Renderer·테스트 TypeScript 및 production build **PASS**. 기존 스크립트에 lint 명령은 없다. Windows GUI·실제 IPC·재실행·파일 권한/잠금은 **NOT RUN**이다. 자동 검증은 합성 자료와 격리 임시 디렉터리로 수행했다. Windows Actions/신규 QA workflow는 실행·추가하지 않았다.
- 후속 집중 확인: 물품 등록→입고→사용/만료 폐기→앱 재실행 후 이력·재고 복원, 저장 실패/백업 보호, Purchase 기존 품목에 추가, 작은 창의 목록·상세·구매 검토 접근. 기존 기능 전체 Windows QA는 반복하지 않는다.

변경 경로: `src/inventory-management/{InventoryWorkspace.tsx,model.ts,inventory.css}`, `electron-p0/main/{inventory-store.ts,main.mts}`, `electron-p0/{protocol.ts,preload/preload.cts}`, `electron-p0/renderer/{P0App.tsx,inventory-preview/InventoryHost.tsx,purchase/PurchaseSession.tsx,purchase/inventoryPurchase.ts}`, 관련 `electron-p0/tests/inventory-{model,store,workspace,preview-isolation,purchase,local-boundary}.test.{ts,tsx}`, 이 인계 문서. 새 기능 브랜치는 로컬 체크포인트로 보존하며 원격 push는 이번에 수행하지 않는다.

## Electron 기존 AI API 연결 선별 이전

- 개발 브랜치: `feature/electron-ai-connections`, 기준 `feature/electron-inventory-practical@c6a31e0101268866e452820273b777c1811ebbe9`. 기준 브랜치는 원격 동일 SHA, divergence 0/0으로 보존했다. Finder/Purchase 저장, Newsletter 새 작성, 일정, 공문 및 로컬 Inventory를 모두 조상 커밋으로 포함한다. 이 AI 변경은 로컬 체크포인트이며 새 브랜치는 아직 push하지 않는다.
- 원본: `src/ai/{types,config,aiConnectionService}.ts`, `src-tauri/src/{ai,ai_generation}.rs` (기준 `26fcb929efcdcc5176812372ecf179430a901b15`); 공문 `privacyGuard.ts`, `officialDocumentAiService.ts`, `promptBuilder.ts`. API 제공자/요청·응답·오류 계약과 기존 개인정보/64KiB Gate를 재사용한다. Main 개인정보 검사는 원본을 바이트 단위 선별 복사했으며 동등성 테스트로 확인했다. Tauri 원본은 변경하지 않았다.
- ChatGPT 원본: `src/chatgpt/**`, `src-tauri/src/chatgpt/**`, 로그인 기반 `8c9ce9c50c2dce0476fc1095ce4353a91e24f0f8`, 요금제 기반 `f641b81a68f6e1958bd57f44c0048039babbf08d`. 원격 `feature/sign-in-with-chatgpt-foundation@cd0786284f9cf71f9c3f4962626a828402183068`, `feature/chatgpt-plan-inference@ae35a92832e74a56eeb1dfc683ea51a0618d3ba3`, `feature/chatgpt-plan-consumer-integration@b22caad4e2a447e26198cbd7dfae0eef5070fc53`를 fetch/read-only 검토했다. 소비자 브랜치와 현재 기준의 AI/ChatGPT 엔진 차이는 없다. 전체 브랜치를 병합하지 않았다.
- ChatGPT의 `dynamic_agent_client` 등록과 `chatgpt.tokens.use.direct` 권한은 기반 코드·합성 테스트만 확인됐고, 공식 지원/등록 승인 및 실제 로그인·요금제 호출 성공 근거를 확보하지 못했다. Electron에서는 **미지원**으로 명시하며 로그인 버튼, 토큰 우회, 다른 앱의 client ID, API Key로의 조용한 대체를 추가하지 않는다. 이 판정은 ChatGPT 자체의 기능 지원 여부에 대한 단정이 아니다.
- Electron API: 설정 → AI 연결, 또는 각 작업실 AI 작성 보조 → 공통 연결 설정. Key를 본인이 클립보드에 복사하고 명시적으로 연결을 요청한 경우에만 native 확인 후 Main이 읽는다. 성공 시 동일한 클립보드 값만 제거한다. Key 입력/조회 IPC나 Key를 포함하는 상태 DTO는 없다. OpenAI API/Gemini API는 구독과 별도로 청구될 수 있다.
- 암호화 보관은 Windows `safeStorage`가 사용 가능한 경우에만 opt-in한다. 고정 Electron 경로 `userData/work-data/ai/api-credential.bin`에 암호문을 원자적으로 저장한다. 일반 설정 JSON·로그·원고·백업에 Key를 넣지 않으며 암호화 불가 환경에서는 메모리 세션만 지원한다. 저장 연결도 자동 복호화/외부 검증하지 않고 ‘불러와 확인’ 요청 때 처리한다. 연결 해제는 세션/요청을 폐기하고 이 Electron 인증 파일만 삭제한다. Tauri 인증 저장소는 읽거나 이전/삭제하지 않는다. Windows 클립보드 기록 기능은 이 앱의 관리 범위가 아니다.
- 모델은 Key로 조회한 계정 목록에서만 선택한다. 원본의 고정 모델 이름은 실제 제공 여부가 미확인이라 자동 신뢰하지 않는다. OpenAI는 `/v1/models`의 텍스트 후보, Gemini는 `generateContent` 지원 모델만 표시한다. 목록 조회 성공과 유료 텍스트 생성 성공을 구분한다. OpenAI Responses의 `model/input`, Gemini의 `contents/parts/text` 계약을 유지한다. OpenAI reasoning 모델과의 호환성을 위해 강제 `temperature`를 생략하며 Gemini 0.2는 유지한다. 실제 계정별 모델 권한은 호출 시 추가 확인한다.
- 네트워크는 Main의 별도 비영구 Electron session에 한정한다. `api.openai.com/v1/{models,responses}`, `generativelanguage.googleapis.com/v1beta/models` 및 조회된 모델의 `:generateContent`만 사용한다. Renderer CSP/다운로드/네트워크 차단은 그대로다. redirect 거부, GET/POST 고정, 20초 timeout, 1MiB 스트리밍 응답 제한, 3페이지/500모델 제한, 입력 60,000자/64KiB와 출력 60,000자 제한, 자동 재시도 금지, sender/frame/URL/arity/schema 검사를 적용한다. 창 종료/navigation/renderer 종료 시 취소·세션 폐기한다. 키·원고·제공자 오류 원문은 로그/오류 DTO에 출력하지 않는다.
- 공문/소식지/Finder의 공통 작성 보조는 **명시적 검토용 가져오기 → 편집 → 개인정보 검사 → 동의 → Main native 전송 확인 → 응답 검토/복사** 흐름이다. 마운트/상태 조회/작업실 전환만으로 원고를 전송하지 않는다. AI 응답은 자동 적용/저장하지 않으며 사용자가 필요한 부분만 기존 편집기로 복사한다. 원고·Revision·Asset ID/SHA·pending 승인, 라이브러리/백업, Mock 검색 계약을 유지한다. AI 이미지/AI 주제 자동 생성/실제 YouTube 검색은 추가하지 않았다.
- 검증: 합성 응답/격리 저장소의 관련 Vitest **132 PASS (22파일)**, 기존 ASAR/Main·Preload 런타임 검사 **3 PASS**, Electron Main/Preload/Renderer/테스트 TypeScript 및 production build **PASS**. 실제 API Key·유료 호출·계정별 모델/한도·Windows DPAPI/클립보드/native 확인창/GUI·앱 재실행 복호화는 **NOT RUN**. Cloud에는 제공자 인증정보가 없고 네트워크 정책에도 API 호스트가 허용되지 않아 외부 인증을 시도하거나 우회하지 않았다. Windows Actions/새 QA workflow는 추가·실행하지 않았다.
- 판정: **CONDITIONAL — API 연결 코드/자동 검증 완료, 외부 실사용 및 Windows 보안 저장 확인 대기; ChatGPT 계정·요금제 경로 미지원**. 후속 검증은 사용자 본인 API 계정으로 모델 조회/선택, 합성 텍스트 1회 호출, native 취소/연결 해제, Windows 보관/재실행 복호화를 관련 파일 기능 QA와 묶어 수행한다.

## MY FINANCE Electron 선별 이전

- 기준 `feature/electron-ai-connections@b0816da4daaba3f4e290fdda9ceba734ae5ddd3f`는 원격 보존·SHA 일치·divergence 0/0을 확인했다. 새 로컬 브랜치 `feature/electron-my-finance`는 AI 및 이전 Finder/Purchase/Newsletter/업무/공문/Inventory 체크포인트를 모두 조상으로 포함한다. ChatGPT 기반 코드는 미지원 상태로 그대로 보존한다. 새 금융 브랜치는 로컬 checkpoint이며 아직 push하지 않는다.
- 원본은 `feature/my-finance-phase2@1b6a1383d93c649d448097991ffa2f86a467bde0`이다. 현재 기준과 이 원본의 `src/my-finance/**`, `src-tauri/src/my_finance*.rs`, Cargo.toml/lock은 동일함을 읽기 전용 비교했다. 기존 Windows Tauri QA는 참고 근거이며 새 Electron QA로 승계하지 않는다.
- 기존 FinanceScreen/IncomeForm/Phase2Workspace/FinanceTransfer/확인 UI, domain/presentation 계산을 수정 없이 재사용한다. 업무 도구 → MY FINANCE 진입, 수입 등록/수정/삭제·필터/집계, 기존 세금 참조/투자/자산/부채 기능, 암호화 백업 선택·검사·확정 흐름을 Electron adapter로 연결했다. 새로운 세무 계산·금융 API·CSV/평문 내보내기·동기화는 추가하지 않았다. Soft Rose는 Electron wrapper의 색상/포커스만 적용하고 기존 Surface·위젯·설정은 유지한다.
- 기존 Tauri repository는 빌드에 넣지 않고 Electron Vite에서 finance/repository adapter로만 연결한다. 허용한 기존 금융 UI/순수 도메인 파일만 번들에 포함하며 Tauri/Supabase/원본 repository 유입 차단을 유지한다. 타입 계약은 원본 선언에서 type-only 추출하고 동등성을 검사했다. 기존 Tauri 제품 코드는 변경하지 않는다.
- `tools/my-finance-cli`는 원본 snapshot/SQLCipher store/backup/codec/transfer 5개와 관련 테스트 4개를 고정 SHA에서 선별 복사한다. 제품 엔진은 바이트 동일하며 테스트 1개의 합성 fixture 상대 경로만 한 단계 조정했다. `source-hashes.json` 및 provenance 테스트로 확인한다. DPAPI `open_at` 본문도 원본을 유지한다. 직접 의존성과 모든 전이 패키지 버전을 원본 Cargo.lock에 맞췄고 기존 release 옵션을 유지한다.
- **암호화 계약 유지:** SQLCipher만 허용하고 cipher/key 검증 후 사용한다. 32바이트 DB 키는 Windows 사용자 DPAPI `Scope::User`로 `key.dpapi`에 보호한다. 기존 DB가 있는데 키가 없거나 손상되면 재생성·교체하지 않는다. API Key용 Electron safeStorage로 금융 키를 바꾸지 않는다. 일반 SQLite·JSON·브라우저 저장·새 암호화 방식으로의 fallback은 없다.
- Electron 전용 경로는 `userData/work-data/my-finance/{finance.db,key.dpapi}`이다. 기존 Tauri 금융 경로를 검색/읽기/이전/수정하지 않는다. 저장소 초기화는 사용자가 MY FINANCE에 진입해 명시적으로 목록을 요청한 때만 수행한다. Windows/엔진이 없으면 차단 안내를 표시하고 합성 성공/빈 정상 저장소로 대체하지 않는다.
- 원본 snapshot schema **2**, DB version **1**, dataset/revision/history CAS를 그대로 사용한다. Phase 1의 phase2 없는 백업도 원본 기본값 계약으로 읽으며, 새 데이터셋 이식은 원본의 비사용 빈 저장소 규칙과 명시적 확인을 따른다. 원본 암호화 백업 **BGFNBK01 / Argon2id(64MiB,3회,1lane) / AES-256-GCM**도 유지한다. 읽기/복원 실패가 나면 원본 파일과 정상 DB를 보존하며 SQLCipher 안의 복원 안전 스냅샷·트랜잭션 규칙을 재사용한다.
- 파일은 Main dialog에서 선택한 `.bgfnbk`만 전달한다. Renderer는 경로/DB 키/SQL/명령을 지정할 수 없다. 업무 프로필 내부 백업 경로·기존 파일 덮어쓰기·symlink·초과 파일을 거절한다. 암호문만 원본의 임시파일+fsync+noclobber 방식으로 저장한다. 복원은 기존 5분/단일 사용 token·정확한 pre-image·이력 검사와 native 최종 확인을 모두 통과해야 한다. 취소 시 원본을 바꾸지 않으며 결과 불명확 시 자동 재시도하지 않고 새로고침을 요구한다.
- Main/Preload는 업무별 typed IPC와 sender/frame/URL/인자 수/schema/크기 검사를 적용한다. 실행 파일과 저장소 root는 Main 고정 경로이며 shell을 쓰지 않는다. 값/비밀번호는 argv·환경·로그에 넣지 않고 제한된 stdin/stdout으로 전달한다. Windows worker는 Job Object의 512MiB·단일 프로세스 제한 설정/검사를 통과해야 시작한다. 각 요청 120초, 기동 10초, 프레임 70MiB 제한이며 비밀번호/직렬화 버퍼는 Rust에서 zeroizing 처리한다. 모드 종료/창 종료 시 해당 worker만 정상 EOF 종료하고, 무응답 시 소유 worker만 종료한다. 실제 Windows 프로세스 정리는 아직 미검증이다.
- 기존 `electron:p0:dev` 및 Windows Portable/NSIS 패키징 명령에 finance CLI 빌드를 연결했다. builder의 실제 Windows extraResources 규칙으로 Purchase·공문·Finance **3개** 엔진 포함 설정을 확인하고, Finance 바이너리가 없으면 Windows 패키징을 차단한다. Linux는 DPAPI runtime을 만들거나 대체 저장하지 않는다. 원본 dev/build 도구를 재사용하며 새 workflow/Actions는 추가·실행하지 않았다.
- **자동 검증:** 기존 Rust SQLCipher/암호화 백업/복구/실패 보호 + 새 CLI 경계 **48 PASS** (원본 dependency lock, Linux 합성 데이터). Electron/원본 금융 UI·계산·기존 AI/Surface/IPC 회귀 **107 PASS (20파일)**. Electron Main/Preload/Renderer/테스트 TypeScript, production build **PASS**. 기존 ASAR runtime 검사 **3 PASS**. Rust 초기 CLI 검사의 unit-variant unknown-field 허용 문제는 struct variant로 최소 수정했고 최종 전체 48건이 모두 통과했다. 민감정보/범위/diff 검사를 수행한다.
- **NOT RUN:** Windows DPAPI 테스트 2건, Windows CLI 컴파일/Portable·NSIS 실행, 실제 Electron 금융 IPC·파일 대화상자·프로세스 종료, Windows 종료/재실행 복원·다른 PC의 명시적 백업 이식. 실제 금융 자료/인증정보는 사용하지 않았다. Linux의 SQLCipher 테스트 PASS를 Windows DPAPI/Electron 통합 PASS로 표시하지 않는다. 기존 GUI의 prerelease/실제 금융정보 입력 금지 안내도 유지한다.
- 판정 **CONDITIONAL — 기존 엔진·화면의 Electron 연결 및 Cloud 자동 검증 완료 / Windows 금융 보안·실행 QA 대기**. 후속은 새 Source SHA로 기존 Windows 패키징 경로에서 세 엔진 포함·기동을 확인하고 합성 수입 CRUD→재실행→암호화 백업/오류 비밀번호/복원 확인→정상 종료를 묶어 수행한다. 이 검증 전 실제 금융자료 투입을 권장하지 않는다. main 병합·배포·기존 브랜치/작업 트리 정리는 수행하지 않는다.

## 학교 행정 업무 도우미 — 신규 Electron 로컬 기능

- 기준 `feature/electron-my-finance@5c1cfde1d1e4ec7a24e396897b76bbf4dbeacb28`를 해당 브랜치에 일반 push했고 원격 SHA 일치·divergence 0/0을 확인했다. 새 브랜치 `feature/electron-school-admin`에서 구현하며 기존 AI/Finance/Inventory/공문/Purchase/Newsletter/업무 구현을 모두 조상으로 포함한다. 새 브랜치는 로컬 checkpoint이며 아직 push하지 않는다.
- 진입: 업무 도구 → 학교 행정 업무 도우미. Soft Rose 전체 Surface·Dock·위젯 배치/저장 계약을 유지하고 전용 로컬 작업 화면만 추가한다. PC 중심의 세로 스크롤, 작은 창에서 2열/1열 조정 및 표 내부 가로/세로 스크롤을 적용했다. 실제 Windows 크기·DPI 시각 검증은 아직 하지 않았다.
- **공식 시스템 실행:** 업무포털/나이스/K-에듀파인 주소를 기관 안내와 대조해 직접 등록한다. HTTPS 및 `.go.kr`/`.edu.kr`/`.eduptl.kr`/`.k-eduplus.kr` 계열 기본 주소만 허용하고 userinfo·query·fragment·임의 포트는 거부한다. 형식/허용 도메인 검사는 기관의 공식성이나 사이트 가동을 검증한 것이 아니다. Main은 저장된 시스템 ID로만 주소를 찾아 native 확인 후 기본 브라우저에 전달한다. 성공 상태는 ‘브라우저 실행 요청 완료’이며 접속/인증 성공으로 표시하지 않는다. 실행 거절은 시스템명과 기본 브라우저 확인 안내로 구분한다. 로그인·인증서·비밀번호 저장/쿠키 읽기/자동 입력/인증 우회는 없다. 초기 주소는 비어 있어 임의의 운영 사이트에 자동 접속하지 않는다.
- **복무 초안:** 연가/조퇴/출장/시간외근무, 시작·종료 날짜/시간/사유 입력 → 시스템별 설정 양식으로 생성 → 직접 검토/수정 → 확인 후 복사 또는 로컬 저장 → 재열기/수정/삭제를 연결했다. 0분·역순 기간/잘못된 날짜/시간, 인증정보 표기, 미지원 양식 항목은 거부한다. 양식은 `{{유형}} {{시작일}} {{종료일}} {{시작시간}} {{종료시간}} {{사유}}` 문자열 치환만 하며 코드로 실행하지 않는다. 입력 항목을 수정해도 편집 본문을 자동 교체하지 않는다. 실제 기관별 복무 규정·입력 양식·승인 여부는 보장하지 않으며 실제 신청/상신은 사용자가 직접 한다.
- **저장 경계:** `userData/work-data/school-admin/{admin.json,admin.backup.json}`에 주소/양식/초안만 저장한다. 공용 SettingsStore의 임시파일/fsync/원자적 교체/Windows EPERM 제한 재시도와 백업·revision CAS 패턴을 재사용한다. 실패 시 기존 파일과 편집 입력을 유지하며 충돌은 재읽기를 요구한다. 손상 primary의 백업은 원본 보호를 위해 읽기 전용으로 열고 자동 덮어쓰지 않는다. 이 저장소는 Finance의 암호화 저장소와 다르며 암호화 JSON이라고 주장하지 않는다. 민감한 학교 자료·인증정보를 입력하지 않는다.
- **Excel 검토:** Main 파일 선택으로 CSV/XLSX만 읽는다. CSV는 기존 UTF-8/BOM/EUC-KR decoder·CSV parser를 사용하고 XLSX는 기존 Purchase Rust CLI의 ZIP/셀 제한·spreadsheet reader를 그대로 재사용한다. XLSX는 첫 비어 있지 않은 시트의 문자열/숫자 캐시를 사용하고 수식·매크로를 실행하거나 재계산하지 않는다. Purchase 품목 추론을 거치지 않아 일반 행/열을 품목·합계로 오인해 삭제하지 않는다. header 1~30행 선택, 최대 16개 출력 열 이름/원본 열/텍스트·숫자·날짜/필수 여부 매핑, 행 검증·미리보기·선택을 제공한다. 숫자는 정확한 쉼표 그룹과 소수를 검증하고 날짜는 YYYY-MM-DD만 허용한다. Excel 날짜 일련번호를 임의 추정하지 않는다.
- 파일 15MiB, 입력 530행/256열/표 4MiB, 셀 64KiB, 검토 500행/16열/2MiB, 선택 결과 500,000bytes 제한을 둔다. 누락 필수값·잘못된 숫자/날짜·수식 형태·인증정보·탭/줄바꿈 행을 표시하고 오류 행은 선택/출력하지 않는다. 원본 파일은 쓰지 않는다. 원본 표는 메모리 세션에만 두고 작업실 닫기 시 폐기하며 JSON 초안과 섞지 않는다. 새 파일 분석 실패/취소 시 이전 검토를 유지한다.
- **복사/출력:** Main은 자신이 보유한 review ID와 선택 인덱스로만 검토 결과를 재확인한다. 사용자 검토 후 기존 Rust CSV writer·수식 escape를 재사용해 BOM CSV와 TSV 복사본을 생성한다. 이 파일은 검토용 문자열이며 실제 나이스/에듀파인 업로드 양식 준수를 보장하지 않는다. 저장 위치는 Main dialog에서 선택하고 기존 writeSelectedExport의 fingerprint·명시적 덮어쓰기 확인·임시파일·원자적 교체·실패 보존을 재사용한다. profile 내부/임의 경로는 거부한다. 실제 디스크 저장 후에만 성공을 표시한다. 실제 시스템 DB/RPC/자동 제출은 전혀 연결하지 않는다.
- **공유 경계:** `ExcelService`의 스냅샷/취소/프로세스 종료/정리를 공통 helper로 추출하고 기존 analyze/map/export 계약은 유지했다. Purchase CLI에는 별도 `adminTable`/`adminReview` 두 작업만 추가했으며 기존 파싱·계산·정산·에듀파인 출력 알고리즘을 변경하지 않았다. 새 의존성·별도 실행 엔진·QA workflow는 없다. `admin-protocol.js`를 ASAR 포함 목록에 명시했고 기존 runtime graph 검사로 확인했다. 모든 IPC는 동일 window/frame/URL·인자 수·schema를 검사하며 Renderer에 raw URL 실행/경로/명령/브라우저 자동화 API를 노출하지 않는다.
- **검증:** 합성 CSV/XLSX 실제 읽기, 선택 행 실제 CSV 생성/원본 불변, 초안 디스크 저장/재열기, 실패/백업/충돌/취소/덮어쓰기 보호, UI/typed IPC/기존 Purchase·공문·AI·Finance·Inventory·Surface 집중 회귀 **68 PASS (18파일)**. 기존 Purchase Rust 엔진 + 신규 표 검토 **59 PASS**. Electron Main/Preload/Renderer/테스트 TypeScript 및 production build **PASS**, ASAR runtime **3 PASS**, diff/범위/민감정보 검사 수행. 테스트의 공식 주소는 합성 도메인이며 browser opener는 mock이다. 실제 브라우저를 열거나 운영 계정/실제 교직원 자료를 사용하지 않았다.
- **NOT RUN:** Windows 기본 브라우저 실행/실제 사이트 접속, native 파일 대화상자·클립보드, Portable/NSIS, 실제 작은 창/DPI. Windows Actions는 실행하지 않았다. 실제 시스템 로그인·자동 제출은 미검증 기능이 아니라 이번 구현의 제외 범위다. 판정 **CONDITIONAL — 로컬 실기능/자동 검증 완료, Windows 외부 실행·파일 UI 확인 대기**. 후속 파일 기능 QA 때 합성 자료로 묶어서 확인한다.
