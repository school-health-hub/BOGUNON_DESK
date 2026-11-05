# BOGUNON DESK SCHOOL05 구현 및 Cloud B 인계 결과

최종 판정: **CONDITIONAL**. 기존 Electron 제품 셸에 우리 보건실을 연결하고 실제 Main/Preload 계약과 로컬 PostgreSQL, Web BFF/공통 UI를 통합했다. production은 기본 비활성이며 운영 로그인·Hosted·실제 Windows 검증 결과가 아니다. Cloud B 검토 후보로 인계한다.

## 기준과 브랜치

작업 시작 통합 SHA는 86f4fceed7b7a8774affc0c9db556f592eaa29ba, SCHOOL04는 그 후손 8de4dfd8f13f3aeae8173edd7f28c9e8caa8fd8c이다. 전용 독립 clone/feature/school-05-product-integration에서 작업했다. SCHOOL04의 Manifest552항목을 검증했고 이전 A/B/C/02/03 소스가 이미 포함됨을 확인해 중복 적용하지 않았다. 기존 작업 트리와 브랜치는 보존했다.

작업 중 통합이 Account01 커밋 8f9a1f0aa88502b1c45b2d575abdab5300234bbb로 갱신됐다. 이 변경은 본 후보에 병합하지 않았다. 현재 통합과 fast-forward 불가이며 4개 중첩 경로(builder/Main/Preload/P0App)는 Cloud B가 조정해야 한다. 최신 통합에서 시험한 결과로 이 후보의 PASS를 확대하지 않는다. 비교 증거는 integration-compare.json이다.

## 구현 범위

- Dock 업무 도구 → 우리 보건실 카드 → 선택적 제품 overlay. 기존 Dashboard/Dock은 유지하며 개인 기능은 인증 없이 실행된다.
- Main은 목적별 고정 채널과 Gate·수명주기를 소유한다. Preload는 독립 electronWorkspace API만 추가하며 기존 electronP0/electronWork를 교체하지 않는다.
- 기존 School02 검색/가입/승인/구성원/역할/기간/관리자 이관, School03 업무, School04 일정/인수인계를 같은 제품 화면에서 재사용한다. 관리자 구성원 관리와 학교/계정 설정 진입을 연결했다.
- Web 홈은 미확인 전달→내 담당 업무→다가오는 일정→학교/계정 설정이다. 관리 기능은 학교 관리 화면으로 분리한다.
- 기존 DTO/RPC·서버 RLS를 재사용하며 SQL·RLS·권한 상한·개인정보 정책을 변경하지 않았다. 개인 파일 탐색/수집/자동 업로드, 로컬 Inventory 전환, offline queue/cache, Realtime을 추가하지 않았다.

## 인증 권한 Feature Gate

production/packaged는 disabled다. QA는 unpackaged + 검증된 격리 profile + 유효 run ID + 명시 synthetic mode + NODE_ENV≠production을 모두 요구한다. UI flag로 Gate나 서버 인가를 우회하지 못한다. 연결 전에는 “공동 기능 연결 준비 중”을 표시하고 로그인 성공을 만들지 않는다.

QA provider는 제품 디렉터리 밖 build/school05-qa/provider.mjs에 별도 빌드한다. Main이 실제 기존 인증 어댑터와 WindowsSessionVault/FileSessionBlob에 safeStorage를 주입한다. QA-only 경로에서만 암호화 저장하고 종료/로그아웃/계정 전환 시 정리한다. Windows 실제 암호화는 NOT RUN이며 시험은 명시 MOCK vault로 구분했다. 실제 운영 callback/provider는 활성화하지 않았다.

Renderer는 토큰을 받지 않고 범용 RPC/SQL/HTTP 메서드가 없다. sender/frame/origin 검사와 세대 검사를 유지한다. Web BFF의 Cookie/Origin/CSRF/세션 검증은 기존 클래스에 연결했다. 메모리 store와 합성 Auth는 QA-only이며 영구 store/호스팅은 미확정이다. 계정 전환의 늦은 응답은 화면뿐 아니라 이전 CSRF nonce도 되살리지 못한다.

## DB RPC와 화면 검증

새 Main 목적별 API→AuthAdapter→학교 컨텍스트→실제 PostgreSQL RPC 경로로 업무 생성과 일정 생성/수정/취소, 본인 대상 인수인계 읽음/처리 완료를 시험했다. pending/지원강사/다른 학교 권한, 계정/로그아웃 정리를 확인했다. 기존02/03/04 회귀65건도 동일 SQL 스키마에 대해 실행했다.

실제 빌드 P0 Renderer의 개인 실행→기존 메뉴→비활성 Workspace→동일 Dock 복귀를 Chromium+MOCK Preload로 확인했다. 980×700/900×680 및 Web390/320px을 검증했다. Web은 실제 loopback BFF와 로컬 DB, Auth만 MOCK이다. 실제 Electron Windows GUI로 표기하지 않는다.

## 테스트 결과

| 분류 | PASS | FAIL | 범위 |
| --- | ---: | ---: | --- |
| 신규 LOCAL DB + 실제 Main 목적별 API | 2 | 0 | Auth/vault/IPC 전달 MOCK |
| 신규 Gate/실제 Preload VM/수명주기 MOCK | 8 | 0 | packaged/production/비격리 차단 포함 |
| 신규 제품 React 상태/오류 경계 MOCK | 3 | 0 | 개인 복귀·미연결·오류 차단 |
| 신규 Web 지연 응답 MOCK | 1 | 0 | 이전 CSRF/데이터 폐기 |
| CHROMIUM | 19항목 | 0 | 실제 P0 Renderer·Web BFF/LOCAL DB; Preload/Auth MOCK |
| SCHOOL04 회귀 | 22 | 0 | 동일 로컬 스키마 |
| SCHOOL03 회귀 | 21 | 0 | 동일 로컬 스키마 |
| SCHOOL02 회귀 | 22 | 0 | 동일 로컬 스키마 |
| 인증 어댑터 회귀 | 59 | 0 | MOCK |
| 기존 기능 선택 회귀 | 109 | 0 | Dashboard/Dock/개인 일정/IPC/QA profile 등 |
| WINDOWS REAL | NOT RUN | — | GUI·safeStorage·PS 실행 |
| HOSTED | NOT RUN | — | 운영 연결·변경 없음 |

14개 신규 Vitest와19개 Chromium 항목은 중복 계층이므로 신규 고유 시나리오33개로 합산하지 않는다. 반복/재검증도 새 고유 테스트로 세지 않는다. 관련 기존 회귀와 선택 검증을 전체 제품/native suite PASS로 확대하지 않는다.

## 타입 빌드와 자율 수정

별도 Workspace strict, Electron Main/Preload/Renderer 빌드, Web build, 외부 QA provider build와 production boundary scan이 통과했다. 제품 JS에 합성 토큰/가상 계정 fixture/로컬 DB 실행 코드가 없으며 새 workspace-protocol.js가 packaging allowlist에 있다.

루트 npm run build는 깨끗한 시작 통합 기준에서도 같은 타입 오류13개이며 현재와 문자열이 모두 일치한다. 신규 오류0이다. 루트 lint/typecheck npm script는 없어 NOT RUN이고 별도 strict 검사로 구분한다. 전체 Electron test preparation은 이 환경에 cargo가 없어 실패했으며 전체 native suite는 NOT RUN이다. 기존 CLI/패키징 코드를 바꾸거나 실패를 PASS로 표시하지 않았다.

자율 수정은 CSS 타입 선언 누락, 새 protocol 패키징 누락, 중복 메뉴 이름의 브라우저 selector, 이전 CSRF nonce 응답, 비동기 로딩 대기, 중복 모바일 헤더에 대해 각각1회 수행했다. 실행 증거/재현·원인·파일·집중 검증은 QA_FIX_LOG.json에 남겼다. 동일 명령의 무근거 반복이나 보안 계약 완화는 없다.

## Git 보존과 인계

정확한 최종 Source SHA·원격 HEAD·ahead/behind·clean 상태는 ZIP 루트 GIT_RECEIPT.json을 확인한다. feature 전용 일반 commit/push만 수행한다. main/통합 브랜치 수정·병합·rebase/reset·강제 push·PR·운영 배포는 하지 않는다.

Git 변경 파일 목록, 검증 소스 해시, 코드·SQL·시험·로그·화면·상대경로 복원법·Manifest를 인계 ZIP에 포함한다. ZIP source_files와 Git 파일 바이트를 대조하고 압축 해제 후 SHA-256을 검증한다. 기존 SCHOOL04 원본 ZIP은 보호하며 중복 overlay하지 않는다. 실제 비밀키·세션·사용자·학생 데이터·빌드 산출물은 제외한다.

## 운영 미검증과 Cloud B 준비

운영 Supabase DB/Auth/RLS/GRANT/Realtime 변경·RPC 실행은0이다. 기존 경고19개를 수정하거나 새 Workspace 권한 함수로 재사용하지 않았다. 실제 Auth provider/redirect/JWT/세션 회수, auth.sessions 최소권한, hosted PostgREST, 기존 함수 내부 인가/도달성은 NOT VERIFIED다. 기존 CONDITIONAL/NEEDS DECISION을 유지한다.

Cloud B 인계 문서에 검증 SHA, 현재 통합과 차이/fast-forward 불가, 영향 파일, Windows 시험 목록, Chromium 한계, Hosted 미검증, 기본 Gate, 중첩 경로 조정 및 선행조건을 포함했다. Source 후보는 인계 가능하나 Account01과 조정 및 실제 Windows 전체 통합 QA가 필요하다. 운영 준비 완료·배포 PASS가 아니다. SCHOOL06 구현이나 운영 활성화는 시작하지 않았다.
