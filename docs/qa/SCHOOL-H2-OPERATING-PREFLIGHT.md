# SCHOOL H1 통합 보안 검토 및 H2 운영 사전 준비

검토일: 2026-11-07. 제품 후보: `37ed6d435e57658336c244f847caf4d95df4002a`.
통합 이전 기준: `3ed1be5765b9abad4115de0d30b76088407c4539` (behind 0 / ahead 10).
이 문서는 별도 `docs/school-h2-operating-preflight` 브랜치에 보존한다. 제품 변경 없음.
운영 대상은 **UNASSIGNED**. 이번 작업에서 운영 DB 접속·SQL·Auth/OAuth 변경·실계정 사용은 하지 않았다.
H1의 구현/API 상세는 [기존 인계](SCHOOL-H1-HANDOFF.md)를 재사용한다.

## 독립 소스 검토

기존 PASS 문구에 의존하지 않고 현재 Main, Gate, Auth, HTTP, runtime, QA provider, 두 addon SQL을 다시 읽었다.
이는 별도 보안기관 감사나 운영 배포 승인에 해당하지 않는다.

| 경계 | 현재 소스에서 확인한 내용 | 판정 |
|---|---|---|
| 일반 실행 | H1 factory는 nonpackaged + 격리 프로필 + development + hosted-test + 명시 opt-in + run ID를 모두 요구. 외부 QA provider는 loopback만 허용 | CLOSED 유지 |
| Renderer | 기존 목적별 IPC와 sender/frame 검증 유지. 토큰·임의 URL·함수명 프록시를 추가하지 않음. Preload 무변경 | PASS |
| HTTP | 고정 origin/Auth 경로, 정확한 54+별도2 RPC 및 인자 이름, POST RPC, redirect 차단, 크기/timeout/abort 제한. 실패·HTTP200 오류 envelope는 성공으로 반환하지 않음 | PASS |
| 인증 | 독립 공식 SDK, Auth getUser 검증, 사용자 컨텍스트 RPC, user_metadata 인가 금지. Main 메모리와 별도 DPAPI vault. 학교/계정 전환 시 이전 결과 무효화 | PASS |
| 회수 | 최신 서버 membership/session 검증 재사용. 로컬 logout 선행, 원격 회수 실패는 unconfirmed. 네트워크 장애를 원격 회수 성공으로 표시하지 않음 | PASS / Hosted NOT RUN |
| 비밀정보 | public publishable 설정만 Hosted 후보 허용. service_role/secret 설정 거부, 로그/DTO에 세션 없음. 테스트 credentials는 업로드 밖에 둠 | 검토 범위 PASS |
| SQL | 동결 D0 54개와 Instructor 2개 분리. addon은 정확한 CLOSED 부모 digest, nonsuper installer, 명시 리뷰 marker 요구. FORCE RLS·고정 search_path·기본 ACL 정리·트랜잭션 유지 | 격리 검증 PASS / 운영 미승인 |
| 기존 제품 | Renderer/Preload/TD2/개인 저장소/기존 Instructor 계산·출력/원래 SCHOOL01~09 파일 무변경 | 보존 |

현재 CLOSED/격리 테스트 경계에서 통합을 막는 재현 가능한 결함은 발견하지 않았다. 보안 모델·제품 코드 수정 없음.
Dormant hosted-candidate 생성자가 있다고 일반 사용자가 운영 연결할 수 있는 것은 아니다. 운영용 설정 공급/Gate 활성화는 별도 설계·승인 대상이다.

## 검증 증거와 한계

- 현재 SHA에서 재실행: H1 MOCK 단위 37 PASS, H1 strict TypeScript PASS, QA 프로세스 소유권 단위 3 PASS, diff --check PASS.
- [Windows 42264024323](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/42264024323): **Source 37ed6d4**, run SUCCESS. 실제 Windows Electron/DPAPI/GUI + native PostgreSQL. Auth/REST는 **합성 signed-JWT HTTP fixture**이며 실제 GoTrue/PostgREST가 아니다. 별도 vault 재실행 복원, logout 정리, 계정/학교/권한/오프라인 UI, Instructor PDF/XLSX, TD2 메모/Dock 및 정상 종료 잔여 0개 확인.
- [Linux 성공 job](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/42259569199/job/128035645870): **Source 5acd56b3e996e6e90bcb20044907b6d167774ce9**. 실제 로컬 GoTrue/Auth/JWT/refresh/logout/PostgREST + SQL 총 31 검증 그룹. 전체 run은 당시 별도 Windows QA 실패로 RED이며 Linux job만 SUCCESS. 31개 모두 HTTP 테스트라는 뜻은 아니다.
- `git diff --name-only 5acd56b3..37ed6d4`는 workflow, 인계, Windows fixture/controller 파일만 포함한다. Auth/HTTP/runtime/Main/SQL은 동일하므로 해당 Linux 제품 증거를 제한적으로 재사용한다. 새 SHA에서 Linux를 실행했다고 표시하지 않는다.
- [Windows artifact 13526591852](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/42264024323/artifacts/13526591852): ZIP SHA-256 `4322b3c9fe8509c9f984a9cb4dd3c02fd41f1af9d5201b0f9303dbde8718949c`; 54 PNG/66 파일 해시 증거.
- [Linux artifact 13524288134](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/42259569199/artifacts/13524288134): ZIP SHA-256 `38b0980b717c299e5b8b0dd4b538b44832c8518458d412167b11460b856823ff`.
- 실제 Hosted, Google OAuth, 운영 학교/세션/권한, 새 Portable, OS DPI, 물리 인쇄/Excel 앱은 NOT RUN. Windows의 개인 Finance 확인은 격리 marker이며 SQLCipher 전체 검증이 아니다.
- addon 설치 rollback/중복 거부/부모 D0 재실행/부모 긴급 CLOSED로 Instructor 차단은 로컬 검증됨. **독립 addon 복구 SQL 파일 자체의 실행 리허설은 NOT RUN**; 운영 승인 전 수행 필요.

## H2 대상 선택 판단자료 — 현재 모두 승인 전

1. 관리자가 기존 프로젝트 이름·ref·region·소유권·공개 URL을 대조해 대상을 확정한다. 기존 BogunOn 계정 프로젝트와 Workspace 대상이 같다는 가정을 하지 않는다. BAERURI 접근 및 추가 프로젝트/유료 전환 금지.
2. 기존 Auth 사용자는 동일 프로젝트의 UUID를 그대로 참조해야 한다. 다른 프로젝트의 같은 이메일은 같은 UUID가 아니다. 이메일 자동 매칭·사용자 복제·Tauri 파일 자동 이전 금지. 개인 로그인은 학교 membership 권한을 부여하지 않는다.
3. 승인 후 읽기 전용으로 namespaces/roles/public RPC signatures/owners/default ACL/RLS/FORCE RLS/확장/managed Auth capabilities를 비교한다. 현재는 NOT VERIFIED. 기존 SECURITY DEFINER 경고 19건도 현재 기준선으로 재확인해야 하며 자동 수정/일괄 REVOKE하지 않는다.
4. D0 preflight는 nonsuper postgres, 필요한 소유 역할 SET/CREATE 및 제한된 Auth users.id REFERENCES, sessions 4열 SELECT, uid/jwt EXECUTE를 요구한다. 부족하면 BLOCKED; supabase_auth_admin 상속·Auth CREATE·BYPASSRLS로 우회 금지.
5. 동결 D0의 역사적 project marker는 운영 대상 확인 수단이 아니다. 대상과 계약이 다르면 SQL/hash/digest를 치환하지 말고 별도 리뷰된 대상별 패키지가 필요하다.
6. 현재 무료 요금제의 DB/Storage/egress/Auth 제한·중지 정책·사용량과 네트워크 TLS/직접 IPv6 또는 session pooler 경로를 승인 후 확인한다. 무료 플랜이 관리형 PITR/복구 보장을 제공한다고 가정하지 않는다.

## 백업·복원 게이트 — 실제 백업 확보 여부 NOT VERIFIED

[Supabase 공식 CLI 백업/복원](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)을 2026-11-07 재대조했다.
공식 가이드의 새 프로젝트 생성/비밀번호 재설정/권한 우회 예시는 이번 작업의 허가가 아니다.

- 승인된 기존 credential과 비공개 암호화 저장소, 담당자, 보존기간, 충분한 공간을 먼저 확보한다. credential 없으면 해당 단계만 BLOCKED; 임의 재발급/재설정 금지.
- 승인된 환경에서 CLI/pg_dump/psql/Docker와 서버 major/확장을 확인한다. Docker가 필요하면 격리 환경만 사용하고 C 드라이브 대용량 실행 금지.
- 공식 논리 덤프의 역할(`--role-only`), 스키마, 데이터(`--data-only --use-copy`)를 별도로 보존한다. 테이블·시퀀스/현재값·함수·owner·GRANT·RLS·default ACL 범위를 manifest와 복원 검사로 검증한다. CLI 버전별 제외 목록을 확인하며 이름만 보고 완전 백업으로 판정하지 않는다.
- `supabase_migrations` schema/data는 별도 명시 백업한다. Auth/Storage managed schema의 기본 제외·사용자 변경사항·실제 Auth 데이터 포함 범위를 도구 dry-run/목록과 공식 문서로 확인한다. Auth users/identities/session 자료는 민감 백업으로 분리하며 provider secret/대시보드 설정은 SQL 덤프로 보존된다고 가정하지 않는다.
- Storage 메타데이터와 실제 object bytes는 다르다. object 파일 별도 보존, functions 소스·필요한 설정·외부 암호화 키 의존성도 목록화한다. 키 자체는 Git/채팅/artifact에 넣지 않는다.
- 덤프 간 일관성을 위해 쓰기 정지 창 또는 검증된 동일 snapshot 방식을 합의한다. 각각 따로 뜬 덤프만으로 동일 시점 복구를 보장하지 않는다.
- 비공개 manifest: 프로젝트/ref·UTC 시작/완료·도구 버전·범위/제외·파일 크기·SHA-256·암호화 위치·복구 책임자. 공개 증거에는 비밀/개인정보/접속 문자열/덤프 원문 제외. Actions artifact에 운영 백업 업로드 금지.
- 기존 격리 로컬 환경에서만 역할→스키마→데이터→migration 이력 순서로 복원 리허설한다. ON_ERROR_STOP/트랜잭션 사용, 플랫폼 관리 역할·Auth/Storage 호환성을 사전 검토한다. 공식 예시의 trigger 비활성화는 일반 운영 명령으로 복사하지 않는다.
- 복원 후 건수/참조/시퀀스·권한·RLS·함수/확장·합성 앱 smoke 및 백업 원본 불변 확인, RPO/RTO 실측. 운영 원본으로 복원·DROP·TRUNCATE하지 않는다. 리허설 FAIL이면 설치 차단.

## 54 + 2 CLOSED 설치 및 실패 복구 순서 — 실행하지 않음

1. 정확한 대상·설치 계정·Source/SQL SHA-256·백업/복구 증거·담당자·시간 창 승인.
2. `school-workspace/school09d0/sql/00-hosted-preflight-select.sql`의 실제 저장 위치를 패키지에서 확인하고 읽기 전용 preflight. 네임스페이스/역할/54개 시그니처/기존 테이블 지문 충돌 시 중단.
3. 동일 패키지 `01-install-closed-candidate.sql`을 한 세션/단일 transaction으로 실행, `02-postflight-select.sql`로 54 public/private manifest·owner/ACL/RLS/Auth FK·CLOSED·기존 데이터 불변 확인. 조각 auto-commit/임의 IF NOT EXISTS 금지.
4. 부모 digest `16243d5a443e6b7d40fc92a1ea14f3cd451798583aca740f3f1550d80354360f` 및 CLOSED를 확인한 뒤, 별도 검토·승인된 `school-workspace/hosted-h1/sql/01-instructor-addon-closed.sql` 적용. **현재 review candidate이며 운영 설치 승인 아님**.
5. 별도 Instructor public2/private2 ACL·FORCE RLS·owner/search_path·CLOSED 확인. 핵심 manifest는 계속 54이며 56으로 바꾸지 않는다. addon 후 부모 지문/재검사, Instructor 계산·날인/지급명세서 규칙 보존 확인.
6. 중간 실패는 트랜잭션 rollback. postflight 실패/권한 노출 시 앱 Gate CLOSED 유지, 검토된 부모 `03-emergency-close.sql`과 addon `02-emergency-close-addon.sql`로 차단. 데이터 삭제/전체 복원/자동 재활성화 금지. 두 파일 실행 순서·의존성과 독립 addon 복구를 로컬에서 먼저 리허설한다.
7. 부모 emergency의 `closed_unverified`는 재설치/테스트 activation으로 해제하지 않는다. 별도 원인·권한·지문 검토 및 복구 승인 필요.
8. CLOSED 설치는 기능 활성화가 아니다. 현재 CI의 local-only activation SQL은 운영에 사용할 수 없다. 제한 활성화 패키지/시험 절차는 별도 승인 전까지 미제공·미실행이다.

## OAuth 및 제한 실계정 시험 준비

- Google provider에 등록하는 callback: `https://<승인된-project-ref>.supabase.co/auth/v1/callback`.
- Supabase가 허용할 Electron redirectTo: `http://127.0.0.1:<동적포트>/auth/callback/<무작위경로>` (SDK flow-ID 포함). 최소 허용 패턴 **검토 후보** `http://127.0.0.1:*/auth/callback/*`; 실제 allowlist는 NOT VERIFIED, 변경하지 않았다.
- PKCE/state/flow-ID·Host/랜덤 경로·콜백 1회성·cancel/timeout 리스너 정리·refresh/revoke를 실제 승인 환경에서 시험해야 한다. Windows 합성 Auth로 Google callback 성공을 대체하지 않는다.
- publishable 공개 키와 프로젝트 URL만 허용된 Main 설정 경로로 공급. service_role·Google client secret·토큰을 EXE/Renderer/로그에 넣지 않는다.
- 테스트 학교/기존 승인 계정 UUID/역할/기간/허용 작업/삭제·감사 책임자를 문서 승인한다. 운영 내 합성 자료도 운영 쓰기이므로 별도 승인 필요. 최초 관리자 재직 확인·독립 승인자·증빙 최소수집/보존·전근/퇴직 회수 정책을 fixture로 대신하지 않는다.
- 검증 순서: 제한된 사용자만 테스트 연결→로그인/restore/refresh/logout→미승인/타학교/회수/만료/강사 제한→학교 전환/늦은 응답→공동 Task/Event/Inventory/Instructor→개인 데이터 독립성→CLOSED 복구. 첫 실패 시 권한 확대 대신 차단·증거 보존. 일반 사용자 Gate는 계속 닫는다.

## 사용자 승인 단계별 제출 항목

1. 운영 대상 프로젝트/region/소유권 및 기존 계정 UUID 연계 방식 확정.
2. 승인된 비공개 credential·저장소를 통한 READ-ONLY 사전조사/논리 백업/격리 복원 리허설 범위.
3. 정확한 hash의 54 CLOSED 설치 + 별도 2 CLOSED addon + 복구 절차와 담당자 승인 (운영 DDL/GRANT는 별도).
4. 필요한 Google/Supabase redirect 설정 변경 승인, 승인된 시험 계정 로그인·테스트 학교 membership/데이터 쓰기 승인.
5. 제한 테스트 런타임/Gate 및 이후 일반 사용자 활성화·배포는 각각 별도 승인. 본 H1 통합으로 어느 것도 자동 승인되지 않는다.

H1 제품 통합 가능. **H2 운영 적용은 CONDITIONAL: 대상/백업/복원/Hosted 권한·OAuth/운영 정책 미검증.**

## H2-P0 프로젝트 적합성 검증 (2026-11-07)

현재 제품 기준 `37ed6d435e57658336c244f847caf4d95df4002a`는 변경하지 않았다.
아래는 코드/격리 환경에서 확인한 계약이며, 운영 현황 조사·개인정보 열람이 아니다.
**운영 대상 적합성은 아직 NOT VERIFIED**. 정책상 기존 프로젝트 유지·무료 플랜·추가 프로젝트 생성 금지 조건이 우선한다.

### 프로젝트 선택 판단표

| 판단 항목 | 기존 BogunOn 사용 | 별도 SCHOOL 프로젝트 (비교만, 생성 미승인) |
|---|---|---|
| 기존 계정 연계 | 동일 Auth의 UUID/FK 사용 가능, 추가 로그인·계정 복제 불필요 | 독립 Auth UUID/issuer/JWKS. 같은 이메일도 동일 UUID 아님. 기존 JWT를 새 DB로 전달 불가 |
| 데이터·장애 분리 | Workspace/개인 기능이 같은 DB·요금제·용량·관리자 영향 범위 공유 | 장애/백업/쿼터/운영 권한 분리 가능하지만 클라이언트 설정과 운영 책임 증가 |
| 설치 위험 | 기존 schema/role/RPC/default ACL 및 Auth 권한 충돌 조사 필수 | 별도 대상에서도 managed Auth 권한/기본 ACL/설치 호환성 검증 필요. 빈 DB라고 안전 보장 안 됨 |
| 무료 운영 | 기존 쿼터 사용량에 공동 데이터/트래픽 추가. 현재 사용량 미조회 | 추가 프로젝트 quota/비용 조건 미확인. 현 무료 정책에서 생성 금지; 우회 대안으로 요구하지 않음 |
| 사용자/학교 이전 | 기존 Auth 보존, 승인된 membership만 별도 생성. 개인 설정 자동 업로드 없음 | 계정 연결·사용자 동의·중복/탈퇴 처리 별도 설계 필요. 이메일 자동 병합/기존 UUID 강제 주입 금지 |
| 결론 | **우선 평가 후보**. 적합성 조사·복원 증거·보안 게이트 모두 충족해야 확정 가능 | 비교자료만 제공. 기존 프로젝트가 부적합해도 임의 생성·BAERURI 전용/공유 사용 금지 |

### 실제 Auth UUID → membership 계약

소스 근거: D0 `01-install-closed-candidate.sql`의 `workspace.accounts`, `school_memberships`, `workspace_auth_bridge.session_valid`; H1 `server/auth.ts`와 `runtime.ts`.

- 공식 Auth 검증으로 확인한 `auth.users.id`가 `workspace.accounts.user_id`(UNIQUE FK)에 연결된다. Workspace 내부 `accounts.id`와 Auth UUID는 서로 다른 키다. `school_memberships.actor_id`는 **accounts.id**를 참조한다.
- 학교 권한 키는 `(school_id, actor_id)` 및 membership id/epoch다. 로그인 성공만으로 active membership·학교 관리자 권한을 만들지 않는다. pending은 role NULL, active는 서버 승인된 role 필요.
- 기존 UUID는 변경하지 않는다. 계정 탈퇴 시 FK의 ON DELETE SET NULL은 작성자 계정을 보존하는 구조이며, membership/기록 삭제 또는 JWT 즉시 무효화를 보장하는 정책이 아니다. 회수/감사/기록 보존은 별도 승인 대상이다.
- 서버는 현재 `sub`/`session_id`와 managed Auth session, 정지/만료/회수·membership epoch를 검증한다. 이메일/user_metadata/클라이언트 role을 인가 근거로 사용하지 않는다.
- 다른 프로젝트를 선택하면 H1 개인 계정 세션을 그대로 재사용할 수 없다. issuer+project+subject를 구분해야 하며, cross-project SSO/신뢰 federation은 현재 구현·승인 범위가 아니다.

### 사전점검 SQL의 읽기 전용 검토와 실행 절차

**이번에는 두 파일 모두 로컬 합성 DB에서만 실행했다. 운영 SQL 실행 승인은 없다.**

1. 원본 `school-workspace/school09d0/sql/00-hosted-preflight-select.sql`은 SELECT/catalog/권한 검사만 포함한다. Auth/업무 행·키·JWT·session UUID를 조회하지 않는다. 함수 본문은 출력하지 않고 기존 SECURITY DEFINER의 md5와 문자열 참조 flag만 반환한다. 정의/제약/역할명도 내부 metadata이므로 공개 artifact에 자동 게시하지 않는다.
2. `school-workspace/hosted-h1/qa/h2-p0/preflight-catalog.sql`은 원본을 대체하지 않는 보조 자료다. BEGIN READ ONLY, timeout, pg_catalog search_path, 마지막 ROLLBACK. 54 SCHOOL/2 Instructor 이름·타입을 별도 경계로 명시하고 동명 overload, 소유자/definer/search_path/ACL·실효 EXECUTE, schema/role/role 상속/default ACL/extension/RLS/FORCE RLS를 조회한다. SQL은 메타데이터만 반환하며 업무 테이블 SELECT·Auth 행 SELECT 없음.
3. 보조 SQL은 PostgreSQL17 catalog 기준이다. 서버 버전이 다르거나 catalog field/관리 권한 때문에 실패하면 별도 호환 검토하며 GRANT/role 상속/설치로 해결하지 않는다. 원본도 Auth schema/table/function이 없으면 실패할 수 있으며 이를 적합성 미충족/추가 검토로 기록한다.
4. 실제 실행 전 사용자가 대상 ref/region/소유권과 READ-ONLY 접속 범위를 승인한다. 접속 role은 필요한 pg_catalog metadata 및 has_* 조회만 허용하고 비밀정보를 제공하지 않는다. 원본은 installer 권한을 current_user 기준으로 판정하므로 임의 metadata role 결과를 installer 능력으로 오인하지 않는다.
5. 승인된 세션에서 원본을 READ ONLY transaction으로 감싸고 보조 SQL은 독립 실행한다. 저장은 비공개 접근제한 증거에 최소화한다. READ ONLY는 조회 결과의 기밀성을 보장하지 않으므로 원문 배포 금지. 설치/활성화 SQL과 이어 붙이지 않는다.
6. 설치 전 새 namespace/role/예약 함수 이름·signature가 존재하면 **부재/동일 설치/충돌**을 분리한다. 정의 지문·owner·ACL·상태까지 승인된 패키지와 일치하지 않으면 덮어쓰기/IF NOT EXISTS 금지. 동명 다른 인자 overload도 충돌 후보로 기록한다.
7. 54 public/private manifest와 별도2는 각각 정확한 서명·반환형·SECURITY INVOKER/DEFINER·빈 search_path·owner/runtime 역할·PUBLIC/anon/authenticated/service_role 및 상속/default EXECUTE를 확인한다. PostgREST exposed schemas/cache·private schema 노출 여부도 별도 승인된 설정 metadata로 확인한다. 기존 다른 RPC 권한은 건드리지 않는다.
8. 사전점검이 통과해도 설치 승인이 아니다. CLOSED 설치/54+2 postflight/복구 리허설/백업 증거를 승인 후 단계별 수행한다. 원본 D0 postflight의 `public ws_` 총수는 addon 후56일 수 있으므로, 그 숫자만으로 core54 위반이라고 하지 않는다. 동결 manifest54와 별도2를 각각 대조한다.

### 백업 범위·보호·실제 필요한 권한

| 범위 | 보존/복원 합격 기준 | 필요한 권한과 제한 |
|---|---|---|
| 역할/스키마/권한/RLS/함수 | 별도 roles/schema dump, owner·default ACL·RLS/FORCE·함수/search_path/시그니처 목록 대조 | 승인된 dump 계정의 schema USAGE/catalog 가시성. 역할 정의 추출에 필요한 범위를 사전 확인; 비밀번호 hash 접근을 임의 허용하지 않음 |
| 업무 rows·sequences | 승인 범위 전체 테이블 건수/참조·sequence 현재값·다음값·대형 객체 포함/제외 명시, 일관된 시점 보장 | 실제 SELECT·sequence 읽기 권한 및 dump snapshot 잠금/접속 허용 필요. RLS로 일부만 보이면 전체 백업 아님; --enable-row-security로 누락을 숨기지 않음. 슈퍼유저/BYPASSRLS를 새로 부여하지 않음 |
| Auth/Storage | managed schema의 CLI 제외와 사용자 변경사항을 확인. Auth users/identities 및 복원 호환 범위 명시. Storage DB metadata와 object bytes 별도 | 별도 승인 없이는 Auth 개인정보/session/secret 조회 금지. 복원 권한과 API object 다운로드 권한은 DB SELECT와 별개 |
| migration 이력/설정 | `supabase_migrations` schema/data 명시 백업, extension/version·Data API·OAuth/provider 설정 의존성 inventory | 읽기 승인된 범위만, provider secret/password/JWT 원문은 별도 비공개 보관. CLI 기본 dump에 모두 들어간다고 가정 금지 |
| 암호화/manifest | 전송 TLS+저장 암호화, 접근자/보존기간/키 복구 책임자·UTC/ref/크기/hash/제외목록 명시 | 암호화 키는 백업과 분리, Git/Actions artifact/채팅 금지. 이미 준비된 credential만 승인 후 사용; reset/토큰 신규 발급 금지 |
| 복원 리허설 | 기존 격리 로컬 환경에서 restore exit0 + 권한/RLS/FK/sequence/건수/합성 smoke·복구 시간 실측, 실패 로그 보존 | 격리 대상의 역할/DB/extension 생성 권한을 별도 확인. 운영 대상 restore 금지. 관리 역할 충돌을 무시하거나 무조건 owner 변경 금지 |

읽기 전용 metadata 접근 권한은 **운영 데이터 dump 권한이 아니다**. 데이터 SELECT 자체도 승인 대상이다.
현재 백업 추출·실제 운영 덤프 복원은 NOT RUN. 보관 장소·키 담당자·RPO/RTO·보존기간도 미확정이며 임의 값으로 승인하지 않았다.

### 독립 Instructor CLOSED 복구 리허설

재현 스크립트: `school-workspace/hosted-h1/qa/h2-p0/rehearse.py`.
동일 fixed-image PostgreSQL17.6 digest를 `--pull=never`, network none, host port 없음, tmpfs/512MiB/CPU1, UUID 전용 컨테이너로 실행한다. 기존 컨테이너/프로필을 재사용하지 않는다.
서버 쿼리는 해당 컨테이너 ID의 docker exec psql만 사용하며 외부 endpoint/credential 입력 기능이 없다.

- 원본/보조 preflight는 합성 catalog의 READ ONLY transaction에서 실행한다.
- 동결 core54 CLOSED와 별도 addon2 CLOSED를 실제 SQL로 설치한 뒤 **로컬 전용** 승인 fixture로 active 상태를 구성한다. 이는 운영 활성화 절차가 아니다.
- 실제 PostgreSQL authenticated teacher 호출 성공 후, **변경하지 않은 독립 복구 SQL**을 nonsuper postgres로 실행한다.
- public2/private2의 anon/authenticated/service_role EXECUTE 거부, 부모 active 유지, 54개 서명/정의/ACL·manifest 보존, 합성 Instructor/학교/Auth/개인 행 보존, 실제 호출 permission denied 및 core context 계속 동작을 확인한다.
- 복구 반복 실행의 멱등성, 강제 중간 오류 시 transaction/ACL/state rollback, 부모 emergency closed_unverified 이후 addon 복구가 부모를 재개하지 않음도 검사한다.
- 완료 시 자신의 컨테이너 ID만 제거하고 tmpfs 파기 여부를 확인한다. 운영 백업/실제 Auth/HTTP/Windows/Hosted 테스트가 아니다.

실행: `python school-workspace/hosted-h1/qa/h2-p0/rehearse.py <비공개-또는-합성-결과파일.json>`.
정확한 검증 source/harness/복구 SQL/image hash·UTC·개별 결과는 이 디렉터리 `evidence/rehearsal.json`에 보존한다.
제품/복구 SQL 수정은 없으며, 보조 QA 작성 중 빈 인자 RPC 생성 처리 누락을 바로잡았다. 해당 중간 실행은 FAIL로 유지하고 최종 결과와 혼동하지 않는다.

### Google/loopback 요구사항 및 제한 시험 정책

- Google provider callback과 Supabase Electron redirect는 위 기존 계획의 두 주소로 구분한다. `AccountLoopback`은 127.0.0.1에 동적 port0 바인딩, 무작위24bytes 경로, GET/Host/origin·허용 query·중복 query·sb_flow_id 검사, 180초 timeout/1회성·종료 정리를 사용한다. H1은 별도 인스턴스와 SDK PKCE verifier/session을 소유한다.
- 공식 redirect 문서는 wildcard 지원과 운영의 정확한 URL 권장을 명시한다. 동적 포트/무작위 경로 때문에 제안한 wildcard는 **검토 후보**이며 실제 dashboard 허용/거부를 확인하지 않았다. 광범위 `**`, localhost/외부 host 대체나 Site URL 자동 변경 금지. OAuth provider state는 SDK/provider가 담당하며 Renderer가 임의 state로 권한을 부여하지 않는다.
- 최초 시험은 담당자가 승인한 기존 테스트 계정 alias와 별도 학교 식별자 A/B만 사용한다. 계정 UUID 원문은 비공개 명부에만, 공개 결과에는 역할 alias만 기록한다. 실학교를 테스트 학교로 자동 등록하거나 실교직원/학생 정보를 복제하지 않는다.
- 최소 역할 매트릭스: A 관리자/보건교사/강사, A pending·suspended·expired·revoked, B 관리자. 강사는 인가된 제한 조회/업무만, 임금·계산 상세/관리 쓰기 거부. 요청자 본인의 승인·최초 관리자 검증 우회 금지.
- 시험 시작/종료 UTC·승인자·학교/계정·허용 CRUD·실패 중단 조건·회수 담당자·데이터 보존/삭제일을 사용자 지정한다. 미지정이면 실제 시험 BLOCKED. 비용 발생 외부 호출/실제 학교 로그인은 제외.
- 종료 순서: 사용중 요청 중단→테스트 세션/멤버십 회수·이전 JWT 거부 확인→앱 Gate CLOSED→검토된 RPC CLOSED 확인→합성 데이터/로그 inventory 대조. 데이터 삭제는 승인된 테스트 UUID/학교에만 별도 명시; Auth users DELETE·TRUNCATE·개인 파일 정리 금지. 감사/업무 기록의 법적 보존 요구가 있으면 삭제 대신 접근 회수하며 담당자가 결정한다.
- 네트워크/원격 회수 실패면 unconfirmed로 기록하고 담당자에게 전달한다. 로컬 logout만으로 서버 세션 폐기를 PASS로 표시하지 않는다.

### 공식 문서 및 남은 승인 게이트

문서 MCP로 확인: [CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [self-hosted restore](https://supabase.com/docs/guides/self-hosting/restore-from-platform), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
Changelog index 직접 fetch는 환경 proxy 403으로 미확인; 우회하지 않았다. 문서 예시의 프로젝트 생성/비밀번호 reset/role 삭제는 이 작업의 승인 범위가 아니다.

- **BLOCKED / 승인 대기:** 운영 대상 소유권·ref/region 확정 및 metadata READ-ONLY 접근. 이번 단계에서 운영 SQL/데이터 조회는 전혀 하지 않음.
- **BLOCKED / 증거 미확보:** 기존 Auth UUID 실제 매칭, schema/role/RPC 충돌·권한·보안 Advisor 기준선, 실제 backup/restore·안전 보관처·권한·RPO/RTO.
- **BLOCKED / 별도 승인:** 운영 54+2 CLOSED 설치/복구, OAuth allowlist/provider 변경, 실제 계정 로그인·테스트 학교/membership 쓰기, 제한 연결/일반 Gate 활성화.
- **NOT RUN:** Hosted Auth/HTTP·실계정·운영 dump/restore·Windows 신규 QA. 기존 H1 Windows/로컬 Auth 증거의 범위를 확장하지 않음.

H2-P0 문서·격리 검증 범위는 완료 가능하며, **운영 설치/활성화 준비 완료 판정은 보류**한다.
