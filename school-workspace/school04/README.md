# SCHOOL 04 공동 일정과 인수인계

기존 DESK의 선택적 우리 보건실 기능을 위한 로컬 합성 구현이다. 실제 PostgreSQL 17.6의 RLS/RPC와 Electron Main 인증 클래스, Web BFF 인증 클래스, React 화면을 연결한다. Auth 발급·Windows cipher·Electron IPC 전달은 합성이며 운영 로그인이나 Windows GUI 검증 결과가 아니다. 운영 준비 판정은 CONDITIONAL이다.

## 기준과 복원

기준 통합 SHA: `86f4fceed7b7a8774affc0c9db556f592eaa29ba`.
작업 브랜치: `feature/school-04-events-handovers`.

SCHOOL03 원본 ZIP의 SHA-256과 359개 Manifest 항목 및 내부 A/B/C/02 ZIP을 검증한 뒤 SCHOOL03 소스만 한 번 복원했다. 기존 미커밋 브랜치는 보존했다. 이전 소스 기준 `166df05dd45402cb1a7526c9ae824ec11fcdb579` 이후 최신 기준의 GridLayout·soft-rose·grid-content-width 테스트 변경 3개를 그대로 유지했다. 이번 feature는 이전 미커밋 SCHOOL 소스와 SCHOOL04를 누적 보존한다. 통합 브랜치에 병합하지 않는다.

전체 인계 ZIP의 루트 RESTORE.txt, VERIFY_PACKAGE.py, RESTORE_INTO_REPO.py를 사용한다. 절대 Cloud 경로는 실행 계약이 아니다. ZIP에는 의존성·빌드 산출물·실제 자격증명이 없다. 기존 보고서의 commit 금지 문구는 당시 상태이며, SCHOOL04부터 사용자 자율 보존 정책에 따라 전용 feature commit/push가 허용된다.

## 실행

저장소 루트에서 Node 24/npm, Python 3, Docker Linux Unix socket, OpenSSL, Chromium이 필요하다. package-lock을 변경하지 않는다.

```bash
npm ci
node node_modules/typescript/bin/tsc -p school-workspace/school04/tsconfig.json
SCHOOL04_REGRESSION=1 SCHOOL04_BROWSER=1 bash school-workspace/school04/run-local.sh
npm run electron:p0:build
npm run build
```

`npm run build`는 기준 SHA에서도 재현되는 기존 오류 13개로 실패한다. 신규 오류와 비교한 evidence/type-error-comparison.json을 확인한다. 루트 lint/typecheck 스크립트는 존재하지 않으므로 실행 PASS로 표시하지 않는다. 위 별도 strict TypeScript 검사와 SCHOOL04 UI/서버 빌드는 통과해야 한다.

run-local은 네트워크 none·공개 포트 없음·tmpfs를 사용하는 전용 PostgreSQL 17.6 컨테이너에 A→C→02→03→04 SQL을 적용한다. 기존 컨테이너가 있으면 거부한다. 운영 접속 문자열을 받지 않는다. 합성 fixture와 쓰기 RPC 테스트만 실행하고 컨테이너를 제거한다. SQL의 local-only DB명 guard는 운영 배포 허가가 아니다. 마이그레이션은 hosted에 적용하지 않는다.

REGRESSION=1은 이 SCHOOL04 확장 스키마가 적용된 동일 컨테이너 ID를 잠시 전용 03/02 이름으로 바꿔 원래 테스트를 실행한 후 복구한다. 다른 컨테이너 이름이 이미 있으면 거부한다. 예전 DB에 대한 재시험과 구분한 로그가 evidence/*-expanded-schema.*에 남는다. BROWSER=1은 동일 DB를 초기화한 뒤 loopback HTTPS:5194의 정적 React 화면·실제 BFF·실제 RPC를 Chromium으로 검증한다. 임시 인증서는 /tmp에서 생성·삭제되며 패키지에 넣지 않는다. 테스트용 BFF/메모리 세션 저장소는 운영용이 아니다.

## DB와 인가

새 테이블 6개는 workspace 비노출 스키마의 ws_owner 소유이며 FORCE RLS를 적용한다. ws_runtime/ws_authz_reader는 비소유자 NOBYPASSRLS이고 일반 요청은 authenticated로 들어온다. 공개 13개 invoker wrapper와 목적별 private definer 구현만 실행 가능하다. 인가 helper는 일반 사용자에게 실행 권한이 없다. 원시 테이블 접근·사용자 요청 service_role 우회는 없다.

기존 school advisory transaction lock, 현재 계정·학교·멤버십·유효기간·epoch·세션 검사, request_id receipt, hash payload 및 감사 기록을 사용한다. 기존 hosted SECURITY DEFINER 경고 19개나 receive_medication/owns_project를 재사용·수정하지 않는다. 실제 hosted의 auth.sessions GRANT/PostgREST/서명 JWT 계약은 별도 감사가 필요하다.

일정은 timestamptz로 저장하고 Asia/Seoul로 표시한다. 종일 일정은 Seoul 자정 시작과 종료를 사용하며 종료는 exclusive다. UI 마지막 날짜는 inclusive로 받는다. 종료>시작을 DB에서도 검사한다. 관리자·교사만 생성/수정/취소하며 지원강사는 조회만 한다. 일정 이력은 변경자·시각·상태·범위를 남기며 자유서술 원문 스냅샷을 추가 보존하지 않는다.

인수인계는 내용 revision별 대상 membership+epoch와 역할 발행 스냅샷을 고정한다. 신규/재가입자에게 과거 읽음 의무가 생기지 않는다. 관리자는 학교 전체, 교사는 본인 작성 또는 대상, 지원강사는 대상으로 지정된 항목만 조회한다. 과거 수정 이력도 해당 revision의 대상 권한을 검사한다. 읽음은 본인만, 처리 완료와 별도로 저장한다. 수정하면 새 content_revision이 발행되고 완료를 열며 새 읽음 확인이 필요하다. 완료 변경은 entity version만 올린다.

지원강사는 기본 작성·수정·처리 불가다. 기존 handover.create 명시 allow가 있으면 본인을 포함한 유효 대상으로 작성만 가능하고 수정 상한은 유지한다. handover.complete는 targeted 범위의 명시 allow가 있어야 한다. 기존 deny override가 기본 역할/allow보다 우선한다. 교사의 처리 완료는 현재 대상인 경우, 관리자는 관리 범위에서 허용한다. 관리자는 타인의 읽음을 대행할 수 없다.

모든 쓰기는 request_id 및 expected_version(신규=0)을 요구한다. NULL 버전도 DB에서 거부한다. 같은 request_id의 다른 payload, stale version은 충돌이다. 읽음은 같은 revision에서 중복 저장되지 않고 이전 revision receipt로 새 내용을 확인할 수 없다. 업무 변경·revision/target·receipt·audit는 하나의 트랜잭션이다.

## 화면과 개인 기능 보호

기존 우리 보건실에 한눈에 보기/공동 업무/공동 일정/인수인계 메뉴를 추가했다. 공동 업무 UI는 SCHOOL03을 재사용한다. 월간·목록 일정과 작성/수정/취소/이력, 미확인 우선 인수인계와 읽음/처리/수정 이력을 제공한다. 한국어 업무 레이블, 네이비/로즈 카드, 48px 터치 영역을 사용한다.

Electron 제품 진입점은 DEV && ELECTRON_P0_PUBLIC_SCHOOL04_LOCAL=1로 격리한다. 실제 운영 Main/Preload 라우트를 등록하지 않는다. 전용 IPC 계약은 기존 sender/frame/origin 검증과 localOnly guard를 유지하며 토큰을 반환하지 않는다. 실제 Windows 실행은 NOT RUN이다. 브라우저 desktop.html 980×700은 Chromium 합성 화면이다.

학교/계정 전환 시 generation과 AbortSignal로 이전 응답을 폐기한다. 메뉴 진입/저장 후/포커스/재접속/수동 새로고침에 현재 학교 권한과 데이터를 재조회한다. 열린 상세도 최신 목록으로 교체하며 대상에서 제외되면 지운다. 서버 확인 후에만 저장/읽음 성공을 표시한다. 네트워크 오류에는 공동 쓰기를 잠그고 명시적 재조회·재시도만 허용한다. 오프라인 queue·디스크 캐시는 없다. 기존 개인 데이터 저장소를 읽어 자동 업로드하지 않는다. 개인 캘린더 문서 불변과 서버 장애 중 개인 저장소 사용을 검증한다.

## 입력과 한계

제목 100자, 내용 400자·3개 이하 줄바꿈, 서버 키워드 검증과 저장 전 안내를 적용한다. 학생 이름·건강·상담·투약·처치·검사 결과·인증정보 입력을 허용하지 않는다. 탐지는 완전한 개인정보 분류기가 아니다. 차단 원문은 audit/receipt/AI로 전송하지 않으며 일반 SQL 오류 로그를 억제한 합성 DB에서 시험한다. 첨부·이미지·AI·Realtime·디스크 캐시를 추가하지 않았다.

현재 목록은 일정/인수인계 각 최대100개, 이력 최대50개이며 화면에 범위 제한을 안내한다. 고용량 페이지네이션·보존 기간·운영 최초 관리자 검증은 후속 결정이다. hosted Auth provider/redirect/JWT/세션 회수, managed auth.sessions 최소권한, PostgREST wrapper/private 호출 및 Windows safeStorage/GUI 실동작은 NOT VERIFIED이다. SCHOOL05 격리 통합과 Cloud B Windows 인계는 가능하지만 운영 출시 조건을 충족한 것은 아니다.
