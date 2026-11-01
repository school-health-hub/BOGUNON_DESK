# ELECTRON-P0: Dashboard + Dock

> 단계별 과거 기록입니다. 현재 기능·검증 판정과 학교 PC 인계는 **「2026-11-01 Codex Cloud 종료·학교 PC 인계」**를 먼저 확인하세요. P0의 범위 제외 설명은 당시 단계의 설명입니다.

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
