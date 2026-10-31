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

기존 DesktopWidgetLayout, WidgetFrame, 13개 위젯, DashboardToolbar, WidgetLibraryDrawer, PresetSelector, AppearancePanel, AppDock, DockEditor, 배치/프리셋/geometry와 다섯 CSS를 그대로 사용합니다. 기존 DashboardCanvas는 업무·인증 Provider 전체를 연결하므로 PoC는 같은 표시 컴포넌트를 가벼운 P0 컨트롤러로 조합합니다. 새 디자인을 만들지 않습니다.

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
