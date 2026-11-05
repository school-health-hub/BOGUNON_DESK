# SCHOOL05 Electron Web 제품 통합 후보

제품 Dock의 업무 도구에서 우리 보건실을 연다. 개인 DESK는 로그인 없이 그대로 실행하며 연결이 승인되지 않은 Workspace는 “공동 기능 연결 준비 중”으로 표시한다. Main이 Gate를 판단하며 Renderer 플래그로 활성화하지 않는다.

현재 판정은 CONDITIONAL이다. 운영 Auth/PostgREST와 실제 Windows GUI/DPAPI는 미검증이다. 운영 Supabase에 연결하거나 설정을 변경하지 않았다. QA preview를 운영 기능으로 표시하지 않는다.

## 소스 기준

- 시작 통합: 86f4fceed7b7a8774affc0c9db556f592eaa29ba
- SCHOOL04: 8de4dfd8f13f3aeae8173edd7f28c9e8caa8fd8c
- SCHOOL05 branch: feature/school-05-product-integration
- 작업 중 통합 갱신: 8f9a1f0aa88502b1c45b2d575abdab5300234bbb

SCHOOL04 Git 커밋으로 독립 clone을 만들었다. 이전 단계 소스를 재복원하지 않았다. SCHOOL04 ZIP의 Manifest552개도 검증했다. 새 Account01 통합 변경은 보존하고 이 후보에 병합하지 않았다. 현재 통합과 fast-forward가 불가능하며 4개 공통 제품 파일은 Cloud B 조정이 필요하다. 정확한 검증 Source SHA와 원격/clean 결과는 ZIP 루트 GIT_RECEIPT.json에 있다.

## 제품 경계

전자 제품의 Main main.mts에 Workspace 전용 등록·종료 정리를 추가했다. sandbox Preload는 고정 이름의 school/tasks/activity 메서드만 노출한다. common DTO/RPC와 School02/03/04 UI·controller를 재사용한다. Main이 세션을 소유하며 토큰을 Renderer에 주지 않는다. 범용 SQL/RPC/HTTP IPC가 없다.

production/packaged에서 항상 disabled다. 합성 QA는 unpackaged, 격리 QA profile, 유효 run ID, SCHOOL_WORKSPACE_MODE=synthetic, NODE_ENV≠production을 모두 요구한다. 별도 QA provider는 build/school05-qa/provider.mjs로 제품 app 밖에 빌드한다. 빌드 스캐너가 제품 JavaScript의 합성 토큰·가상 계정·로컬 DB 실행 코드와 packaging 경로를 검사한다. 실제 운영 활성화 경로는 이번에 만들지 않는다.

QA provider도 Main의 기존 ElectronMainAuthAdapter와 WindowsSessionVault/FileSessionBlob을 재사용한다. Main의 실제 safeStorage를 주입하며 QA-only profile 하위에만 암호화 저장한다. 종료/로그아웃/계정 변경 시 지운다. 실제 Windows 암호화는 Cloud B가 확인해야 한다. Linux/암호화 불가 상태를 평문으로 우회하지 않는다. 단위 테스트는 명시된 MOCK vault를 사용한다.

Web 클라이언트는 고정 목적별 BFF 엔드포인트를 사용한다. qa-web은 loopback HTTPS·명시 opt-in에서만 실행하며 실제 기존 BFF 인증 클래스를 재사용한다. 메모리 세션/가상 provider는 QA 전용이며 영구 store·운영 호스팅은 미확정이다. production에서 이 QA server를 시작하지 않는다.

계정/학교/로그아웃 경계의 generation, 취소, 현재 멤버십 재조회는 유지한다. Web의 지연 응답은 데이터뿐 아니라 CSRF nonce도 덮어쓰지 못한다. 오프라인 쓰기 queue·디스크 캐시·Realtime·개인 데이터 업로드는 추가하지 않았다.

## UI

기존 Dashboard/Dock을 유지하고 업무 도구 카드와 선택적 overlay만 추가했다. 오류 경계가 Workspace 오류를 가두며 개인 작업으로 돌아갈 수 있다. 학교 검색·가입·대기·승인·구성원·관리자 이관은 기존 School02를 연결한다. 공동 업무는 School03, 일정/인수인계는 School04를 재사용한다. 관리자에게만 구성원 관리 진입을 제공한다. Web 홈은 미확인 전달→내 업무→다가오는 일정→학교/계정 설정 순서다.

## 재현

저장소 루트에서 Node24/npm, Python3, Docker Linux socket, OpenSSL, Chromium이 필요하다. 원본 package-lock을 사용한다.

```bash
npm ci
node node_modules/typescript/bin/tsc -p school-workspace/school05/tsconfig.json
npm run electron:p0:build
node school-workspace/school05/tools/scan-product.mjs
node school-workspace/school05/tools/build-qa.mjs
SCHOOL05_REGRESSION=1 SCHOOL05_BROWSER=1 bash school-workspace/school05/run-local.sh
```

run-local은 별도 network:none/공개 포트 없는 tmpfs PostgreSQL17.6에 기존 SQL을 적용한다. 05 전용 컨테이너 ID만 소유하고 기존 이름은 거부한다. 새 테스트 후 동일 DB를 안전하게 04/03/02 이름으로 잠시 변경해 상속 회귀를 실행한다. 종료 시 ID로 삭제한다. Browser 시험은 정적 실제 제품 Renderer(MOCK Preload)와 모바일 Web(실제 BFF/로컬 DB·MOCK Auth)을 구분한다. Chromium은 실제 Windows Electron이 아니다.

Windows 준비/시험 명령과 통합 충돌은 CLOUD_B_HANDOFF.md를 따른다. start-windows-qa.ps1은 Windows 미실행 상태이며 실제 Windows에서 먼저 확인해야 한다. 기존 EXE·일반 사용자 profile을 덮어쓰지 않는다.

## 검사 범위와 한계

루트 lint/typecheck 스크립트는 없어 NOT RUN이며 별도 strict TypeScript를 실행한다. npm run build는 시작 기준의 동일 오류13개로 실패한다. 신규 오류는0이다. Electron Main/Preload/Renderer와 Web/QA provider 빌드는 별도로 검사한다. 전체 electron:p0:test 준비는 이 환경에 cargo가 없어 실패했으며 전체 native suite는 NOT RUN이다. 직접 의존하지 않는 선택 회귀의 PASS를 전체 시험 PASS로 바꾸지 않는다.

운영 xxownwxxajzrviuvvfiu의 Auth provider/redirect, JWT·회수·managed auth.sessions GRANT, PostgREST RPC, 기존 경고 함수의 내부 인가·신규 도달성은 NOT VERIFIED다. SQL/RLS/역할/개인정보 정책은 변경하지 않았다. 학생 건강·상담·투약·처치·보건일지 원문을 저장하지 않는다. SCHOOL04의 CONDITIONAL과 기존 운영 NEEDS DECISION을 유지한다.
