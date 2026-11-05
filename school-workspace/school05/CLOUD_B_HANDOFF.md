# SCHOOL05 Cloud B 통합 후보 인계

판정은 CONDITIONAL이다. 제품의 기존 Dock → 업무 도구 → 우리 보건실 진입점, Main 목적별 IPC, sandbox Preload, 공통 학교/업무/일정/인수인계 UI를 연결했다. 운영 기능은 기본 비활성이며 실제 로그인 성공·Windows GUI·Hosted Supabase PASS를 주장하지 않는다.

## 1 검증 Source SHA

정확한 최종 Source SHA, 원격 HEAD, clean/divergence는 인계 ZIP 루트 GIT_RECEIPT.json에 있다. Git에 포함된 소스와 ZIP overlay의 경로/바이트를 비교한다. commit을 만들기 전 테스트한 소스와 commit 소스의 SHA-256 목록은 evidence/source-validation.json으로 연결한다. 이전 SCHOOL04는 8de4dfd8f13f3aeae8173edd7f28c9e8caa8fd8c이며 이전 모든 단계를 포함한다.

## 2 통합 기준과 작업 중 갱신

작업 시작 당시 원격 통합 SHA는 86f4fceed7b7a8774affc0c9db556f592eaa29ba였다. SCHOOL04는 그 위 단일 커밋이다. 작업 도중 통합이 8f9a1f0aa88502b1c45b2d575abdab5300234bbb로 변경됐다. 해당 ACCOUNT01 기능은 수정·병합·재작성하지 않았다. 이 후보의 기능 검증 기준은 시작 기준이며 최신 통합에서 검증한 결과로 확대하지 않는다.

새 ACCOUNT01 커밋은 22파일의 별도 Main 소유 계정·학교 연결이다. Workspace 인증은 새 AccountService에 자동 연결하지 않는다. 계정의 로그인 성공이나 로컬 학교 프로필이 Workspace 멤버십 승인을 의미하지 않는다.

## 3 fast forward

86f4fce에서는 이 후보가 후손이지만, 현재 8f9a1f0 통합과는 분기되어 fast-forward 불가다. Git 원격 feature와의 ahead/behind 0/0과 통합 브랜치와의 divergence를 혼동하지 않는다. Cloud C는 통합을 병합하지 않았다. Cloud B는 권한 있는 별도 통합 후보에서 변경을 검토하고 전체 Windows 검증을 마친 뒤 통합 정책을 적용한다.

## 4 기존 제품 영향 파일

Main main.mts: BrowserWindow 생성 후 Workspace 전용 등록과 종료 정리만 추가. workspace-product.ts는 Gate와 목적별 채널이다.

Preload preload.cts: 독립 electronWorkspace API를 추가하며 electronP0/electronWork는 유지한다. 범용 invoke/RPC/SQL/HTTP는 제공하지 않는다.

P0App.tsx: 업무 도구 카드, 선택적 overlay, 오류 경계와 기존 셸 inert 처리. Dashboard/Dock 데이터·레이아웃·개인 store는 유지한다. WorkspaceBoundary/WorkspaceProductHost는 신규다. soft-rose.css는 overlay 스타일만 추가한다.

builder.json: workspace-protocol.js를 파일 allowlist에 추가한다. vite.config.ts: 서버/시험/SQL의 Renderer 유입을 거부한다. 기존 build 스크립트나 workflow를 변경하지 않았다.

기존 SCHOOL02/03/04 session/database에는 선택적 vault/SQL/origin 주입만 추가했다. 기본 동작은 유지한다. 기존 SQL migration/RLS/역할/개인정보 의미는 변경하지 않았다. SCHOOL04 UI에는 Web 홈 순서와 관리/설정 진입 버튼을 호환 추가했다.

## 5 실제 Windows 시험

Node/npm, Docker Desktop Linux engine, 원본 lockfile 의존성, 실제 Windows safeStorage가 선행조건이다. 저장소의 독립 clone에서 실행한다. 기존 EXE나 사용자 profile을 사용하지 않는다.

```powershell
npm ci
npm run electron:p0:build
node school-workspace/school05/tools/scan-product.mjs
pwsh -File school-workspace/school05/tools/start-windows-qa.ps1
```

start-windows-qa는 로컬 Docker named pipe와 Linux 엔진을 검사하며 임시 경로 아래 고유 QA profile과 port 없는 합성 PostgreSQL을 만든다. 기존 이름의 컨테이너는 덮어쓰지 않는다. QA provider는 build/school05-qa/provider.mjs로 제품 app 디렉터리 밖에 만든다. Main이 QA gate를 승인해야 로드된다. 스크립트 자체도 WINDOWS REAL NOT RUN이므로 실제 Windows에서 검증해야 한다.

Windows 확인 항목:

- QA flag 없이 제품이 로그인 없이 실행되고 우리 보건실은 연결 준비 중인지.
- app.isPackaged 또는 NODE_ENV=production에서 QA flag를 넣어도 provider가 로드되지 않는지.
- 980×700 및 900×680에서 Dock/업무 도구/공동 화면/닫기와 포커스 이동.
- 실제 sandbox/contextIsolation/nodeIntegration=false, 자식 frame/비허용 sender 거부.
- 실제 Windows safeStorage로 QA 세션 암호화, 실패 시 평문 없음, 분리된 QA profile 경로.
- 교사/지원강사/관리자/승인대기별 메뉴·DB 권한, 작업 배정·진행·완료, 일정 생성·변경·취소, 대상 읽음·완료·수정 후 재확인.
- 계정·학교 전환, 느린 응답, 로그아웃·세션 만료·정지 뒤 공동 상태 정리.
- DB 컨테이너 중단 중에도 개인 업무·일정·메모를 저장할 수 있는지.
- Account01 계정 연결·NEIS profile·Finance·Inventory·공문·Purchase·Finder 및 기존 CLI/OCR/QA profile 회귀.

## 6 Chromium으로만 확인한 항목

실제 빌드 P0 Renderer를 MOCK Preload로 열어 개인 실행→Dock 업무 도구→기본 비활성 Workspace→기존 Dock 복귀를 확인했다. 980×700/900×680 캡처가 있다. 이는 실제 Electron GUI가 아니다.

Web 보조 화면은 390/320px와 desktop 크기에서 실제 loopback HTTPS BFF와 PostgreSQL에 연결했다. Auth는 합성 provider이고 BFF 메모리 세션 store는 시험 전용이다. Main/Preload 경계는 별도 실제 소스 VM/모의 IPC + 실제 로컬 DB 테스트로 검증했다.

## 7 Hosted 미검증

운영 Supabase xxownwxxajzrviuvvfiu에는 연결·RPC 실행·DB/Auth/RLS/GRANT/Realtime 변경을 하지 않았다. provider/redirect, 서명 JWT, 운영 refresh·회수, managed auth.sessions 최소 GRANT, PostgREST wrapper/private 호출, 기존 경고 함수의 내부 인가·신규 도달성은 NOT VERIFIED다. 기존 경고19개를 수정·재사용하지 않는다.

## 8 Feature Gate

제품 기본은 disabled이며 Main이 판단한다. QA 허용은 unpackaged + 별도 QA profile + 유효 run ID + SCHOOL_WORKSPACE_MODE=synthetic + NODE_ENV≠production을 모두 요구한다. Renderer flag나 임의 role로 승인을 만들 수 없다. production 출력에는 QA provider·합성 토큰·가상 계정 fixture·로컬 DB 실행 코드가 없고 packaging allowlist에서도 QA 모듈을 제외한다. 실제 운영 활성화 경로는 구현하지 않는다.

Main은 QA에서도 기존 WindowsSessionVault/FileSessionBlob에 실제 safeStorage port를 주입한다. 합성 세션은 QA-only 하위 경로에서만 저장하고 QA 종료 시 정리한다. 실제 운영 세션 저장소·Web 영구 store/호스팅은 이번에 확정하지 않았다.

## 9 중첩 변경과 조정 방법

현재 ACCOUNT01과 경로가 겹치는 파일은 builder.json, main/main.mts, preload/preload.cts, renderer/P0App.tsx 4개다. 기존 feature 비교 기준에 따라 겹치는 경로를 evidence/integration-compare.json에서 재확인한다. 실제 내용 충돌 여부를 merge로 시험하지 않았다.

- main: 새 Account01 서비스·세션·callback 등록을 보존하고 Workspace 등록을 독립 추가한다. renderer network 정책을 열지 않는다.
- preload: 새 account API를 보존하고 electronWorkspace를 별도 추가한다. 기존 API를 교체하지 않는다.
- builder: 양쪽 프로토콜/SDK 파일 allowlist를 합쳐 누락을 방지한다. QA provider는 넣지 않는다.
- P0App: 기존 Account01 UI/profile 연결을 보존하고 업무 도구 카드/선택적 overlay만 반영한다.

ACCOUNT01의 새 build-account 단계 및 패키징 검증을 후보의 과거 build.mjs로 덮어쓰지 않는다. 검토 없이 현재 통합에 ZIP을 overlay하지 않는다. 필요한 WorkspaceAuth와 Account01의 향후 연결은 운영 정책 승인이 선행되어야 한다.

## 10 통합 전 선행조건

권한 있는 Cloud B 통합 후보에서 ACCOUNT01 중첩 변경을 조정하고 전체 Windows 빌드/GUI QA·패키징·기존 기능 회귀를 재실행해야 한다. 현재 Git HEAD와 통합 HEAD를 다시 조회한다. 원격 상태가 변하면 기존 결과를 새 SHA의 PASS로 재사용하지 않는다.

루트 npm run build는 깨끗한 시작 기준에서도 같은 기존 타입 오류13개이며 신규 오류0이다. strict Workspace/Main/Renderer 검사와 Electron build는 별도 통과했다. lint/typecheck npm script는 없다. 전체 electron:p0:test 준비는 이 Cloud 환경의 cargo 부재로 실행하지 못했으며 선택 회귀로 전체 native suite PASS를 대신하지 않는다.
