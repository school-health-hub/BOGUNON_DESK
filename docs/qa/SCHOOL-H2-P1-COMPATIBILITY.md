# SCHOOL H2-P1 — 운영 후보 적합성 및 CLOSED 설치 검토

제품 기준: `37ed6d435e57658336c244f847caf4d95df4002a`.
이전 QA: `cbc38f3c35958faed2fc2cfa2308077f24bd8ec0`. 이번 QA 브랜치: `qa/school-h2-p1-compatibility`.
기존 [H2 계획/P0](SCHOOL-H2-OPERATING-PREFLIGHT.md)에 대한 증분 검토다. 운영 대상 후보는 사용자가 제시한 BogunOn `xxownwxxajzrviuvvfiu`, ap-southeast-2, PostgreSQL17.6.

## 증거 출처와 제한

운영 메타데이터는 **사용자 제공 이전 ChatGPT READ-ONLY 조회 결과**다. 이번 작업에서 운영 Supabase 접속·SQL·데이터/사용자 UUID 조회는 전혀 하지 않았다. 수집 UTC/개별 SQL 결과·함수 본문/전체 ACL은 제공되지 않았으므로 최신 운영 지문으로 보증하지 않는다.
확인한 정보: public64 tables/RLS64, policies232, functions41, definer20/authenticated callable19; SCHOOL6 schemas/ws_ public RPC/전용 roles 없음; Auth users/sessions/필수4열 존재, users.id REFERENCES와 uid/jwt EXECUTE 있음, Auth CREATE와 supabase_auth_admin SET 없음; postgres public default ACL이 클라이언트에 광범위 권한 부여.
로컬 시험은 실제 PostgreSQL17.6에서 **이 기본 ACL 위험과 역할/객체 경계를 합성 재현**한 것이다. 운영의64개 테이블/232정책/41함수의 본문·행을 복제하지 않았으며 운영 무회귀/Hosted 설치 PASS가 아니다.

## 설치 호환성 판단표

| 요구사항 | 제공된 운영 근거 | 판정/남은 확인 |
|---|---|---|
| 프로젝트/region/PG17.6 | 사용자 지정 후보 | 비교 기준 일치. 실제 endpoint 소유권/세션 identity 재확인은 별도 READ-ONLY 승인 후 |
| SCHOOL schema6/public ws_/역할 부재 | 모두 없음 | 제공 범위 충돌 없음. 정확한 예약 이름/동명 overload·role memberships/default ACL을 설치 직전 재확인 |
| Auth users.id FK REFERENCES | 있음 | 제공 근거 충족. UNIQUE/타입/FK owner 이관 및 managed 지원 동작은 실제 postflight 미검증 |
| uid/jwt EXECUTE | 있음 | 제공 근거 충족. Auth schema USAGE 및 함수 정의/실행 의미·session/claims 호환 별도 확인 |
| auth.sessions4열 | 구조 존재 | **BLOCKED: postgres에 각 열 SELECT 있음은 아직 미확인**. 구조와 권한은 별개 |
| Auth CREATE/owner SET 금지 | 둘 다 없음 | 후보 설치 경계에 부합. 추가 Auth role/CREATE/BYPASSRLS 부여 금지 |
| current_user=session_user=postgres, DB postgres, nonsuper | 명시되지 않음 | **BLOCKED: 실제 installer identity/rolsuper 미확인** |
| CREATEROLE/신규 역할 admin·SET/소유권 | 미제공 | **BLOCKED: 역할 생성·grant/SET 및 owner 전환 가능성 미확인** |
| DB CREATE/public CREATE WITH GRANT OPTION | 미제공 | **BLOCKED: schema 생성 및 새 owner에 임시 CREATE 부여 가능성 미확인** |
| 기본 ACL | postgres public에 광범위 권한 | 위험은 확인됨. 새 객체별 ACL 정리 필요. 격리 시험 통과가 실제 ACL 검토를 대체하지 않음 |
| 기존 definer20/19 callable | 개수만 제공 | **BLOCKED: 본문·소유자·직/간접 호출·동적 SQL 검토 없이 교차 위험 판정 불가** |
| 백업·복원 | 실백업 증거 미제공 | **BLOCKED: 추출 승인/보관소/복원 합격 증거 없음** |

**결론:** 기존 BogunOn을 우선 평가할 근거는 있으나, 현재 권한으로 운영 설치 가능하다고 확정할 수 없다. 미확인 권한을 없다고 단정하지도, 자동 GRANT로 해결하지도 않는다.

## D0 CREATE ROLE / SET ROLE / Auth / owner 요구사항

소스: `school-workspace/school09d0/sql/01-install-closed-candidate.sql`.

1. 단일 transaction 안에서 exact plan/project marker·postgres DB·nonsuper installer·기존 Auth 참조/읽기 권한을 검사한다. marker만으로 endpoint 신원을 확인하지 않는다.
2. NOLOGIN/NOSUPERUSER/NOBYPASSRLS `ws_owner`, `ws_runtime`, `ws_authz_reader`와 bootstrap2 및 임시 `ws_h3_installer`를 만든다. postgres의 신규 역할 생성과 admin/grant/SET 기능이 필요하며 기존 Auth role 상속은 요구하지 않는다.
3. postgres에 owner/runtime/reader SET(TRUE)/INHERIT(FALSE) 경로, 임시 설치자에 필요한 상속/SET을 구성한다. 신규 schema AUTHORIZATION ws_owner 및 함수/table OWNER 이관, public/private의 임시 CREATE를 수행하고 끝에서 철회한다. 임시 설치 역할은 제거한다. 영구 SET 권한은 승인된 설치 설계 일부이며 만능 admin 계정 확장으로 재해석하지 않는다.
4. `workspace.accounts.user_id`는 기존 Auth users.id를 FK 참조한다. 실제 사용자 UUID를 복제·변경하거나 membership을 자동 생성하지 않는다.
5. postgres 소유 Auth bridge 2개는 빈 search_path의 매개변수 없는 session boolean이다. 필요한4열 SELECT/uid/jwt를 통해 current sub/session/expiry/recent-login을 검증하며 반환에 사용자 행·토큰이 없다. private reader만 접근한다. 기존 Auth DDL/GRANT나 소유권을 바꾸지 않는다.
6. 새 업무 역할은 raw Auth 읽기/CREATE/owner SET, LOGIN/BYPASSRLS/CREATEROLE 등을 받지 않는다. 함수의 소유자·고정 search_path·실효 ACL을 반드시 검토한다. 필요한 권한이 부족하면 설치 실패/rollback을 유지한다.
7. 현재 로컬 양성 fixture에서 installer를 NOSUPERUSER/NOBYPASSRLS로 낮춰 설치를 검사한다. 이것은 운영의 managed Auth RLS/owner 제한을 동일하게 재현했다는 뜻이 아니며, 운영에서 BYPASSRLS를 부여할 이유가 되지 않는다.

## 기본 ACL과 기존 서비스 비간섭

- postgres의 public 기본 함수 EXECUTE·table/sequence/schema grants가 새 객체 생성 시 상속될 수 있다. PUBLIC/anon/authenticated뿐 아니라 service_role·알 수 없는 기존 client grants도 점검해야 한다.
- D0는 **새 Workspace 객체**의 함수/테이블·sequence/schema ACL을 정규화한다. core public/private54는 CLOSED, bootstrap 별도 CLOSED, 필요한 owner/runtime/reader rights만 유지한다. Instructor addon은 별도 schema2/public2 및 private 함수 권한을 정리한다.
- 기존 global default ACL을 변경하거나 기존 public64 tables/41 functions/정책/definer19를 일괄 REVOKE하지 않는다. 신규 객체를 노출한 상태로 COMMIT하고 나중에 닫는 방식도 금지한다.
- 이번 격리 fixture는 postgres creator에 PUBLIC/anon/authenticated/service_role/추가 legacy client의 광범위 schema/table/sequence/function defaults를 설정했다. 원본 core/addon 설치 및 긴급 복구 전후 기존 public/Auth 정의·owner·ACL/RLS/정책 및 합성 개인 행, creator defaults의 지문 불변을 검사한다.
- 새 table/sequence에 클라이언트 ACL 잔존 없음, client schema CREATE 없음, Auth bridge client USAGE 없음, FORCE RLS/비특권 owner, 임시 installer/CREATE grants 제거, 54+2 CLOSED를 확인한다. 기존 **합성** definer20/호출가능19의 지문·권한도 그대로 유지한다. 이 sentinel 함수들은 실제 운영 함수의 감사 사본이 아니다.

## SECURITY DEFINER 19건 — 교차 위험 검토

경고 개수만으로 취약 또는 안전을 단정할 수 없다. CLOSED 신규 RPC도 기존 취약 definer를 통한 권한 상승·간접 호출을 자동 방어한다고 보장하지 않는다.

| 위험 | 승인된 READ-ONLY/제공된 소스에서 필요한 근거 | 현재 |
|---|---|---|
| postgres/권한 큰 owner의 동적 SQL | identifier/value 바인딩·format %I/%L, caller 입력 allowlist, 임의 query/table/function proxy 부재 | 본문 없음 / BLOCKED |
| search_path/object shadowing | 고정 path, public CREATE·사용자 생성 객체, qualified dependency·operator/함수 해석 | 미확인 |
| caller/tenant 권한 | auth.uid/current session·school 인가, 다른 UUID 전달 시 거부, user_metadata 비신뢰 | 미확인 |
| 새 schema 간접 도달 | 의존성·호출 그래프·문자열/dynamic lookup, owner의 effective table/schema/function 권한 | 미확인; literal workspace 검색만으로 배제 불가 |
| 무제한 DDL/role/GRANT·권한 상승 | 함수가 실행 가능한 명령과 owner capabilities; 임의 객체/역할 변경 경로 | 미확인 |
| 개인 서비스 영향 | 설치 전후 동일 public 기능 contract/권한·데이터 불변 | 합성 지문 PASS, 운영 NOT RUN |

기존 함수 수정/REVOKE는 하지 않는다. 위험한 함수가 발견되면 그 사실을 별도 보고하고 설치/활성화를 보류한다. 기존 앱 동작 보호를 이유로 취약성을 무시하거나 신규 SQL 보안조건을 완화하지 않는다. 다음 READ-ONLY 승인 시 함수 본문·ACL은 비공개 검토 공간에서 최소 범위로 확인하고 키·row payload를 공개하지 않는다.

## 54 + 별도 2 CLOSED 설치·검증·복구 계획 (미실행)

1. 사용자 대상/백업/시간창·담당자·exact SQL SHA 승인 → 원본00+P0보조 catalog preflight(READ ONLY). 최신 namespace/roles/overload/default ACL/Auth capability와 기존 서비스 지문 확보.
2. 백업/격리 복원 합격과19 definer의 교차 위험 검토를 선행한다. 미확인 상태를 통과로 취급하지 않는다.
3. D0 `01-install-closed-candidate.sql` 단일 session/transaction/ON_ERROR_STOP → `02-postflight-select.sql`. manifest54·public/private54 CLOSED·RLS/owner/ACL/bridge·원래 public/Auth 불변 검사. 구문 분할/임의 GRANT/IF NOT EXISTS 우회 금지.
4. 정확한 D0 parent digest/CLOSED 확인 → 별도 승인된 H1 `01-instructor-addon-closed.sql`. 별도2를 54 manifest에 끼워 넣지 않는다. 원래 local-only installer 재사용 금지.
5. addon postflight로 public2/private2 CLOSED·owner/FORCE RLS/default ACL/parent 지문·기존 계산·도장·XLSX 계약 보존 확인. public ws_ 총56과 core manifest54를 혼동하지 않는다.
6. 실패/노출 시 앱 Gate CLOSED 유지. 신뢰된 owner/schema가 일치하는지 확인하고 addon `02-emergency-close-addon.sql` 및 부모 D0 `03-emergency-close.sql` 실행. 54+2 차단과 기존 데이터 보존 확인. partial/missing schema·owner drift면 임의 owner 전환 대신 중단한다.
7. parent emergency는 `closed_unverified`, 일반 재설치/QA activation으로 다시 열지 않는다. rollback은 데이터 DROP/TRUNCATE/운영 전체 복원을 의미하지 않는다. CLOSED 설치가 성공해도 일반 Workspace 및 실제 연결은 미승인 상태다.

## 백업·격리 복원 실행 준비 체크리스트

모두 운영 추출/접속 별도 승인 전 미실행. SQL 설치와 백업 추출은 서로 다른 승인이다.

- [ ] 대상/ref/region·DB major/extension·TLS direct/session-pooler 경로 및 승인된 기존 credential 담당자 확인. reset/새 token 발급·추가 프로젝트·유료 도구 금지.
- [ ] dump 전용 계정이 필요한 schema/table SELECT·sequence 읽기·snapshot/잠금 및 역할/catalog 조회를 할 수 있는지 확인. RLS가 가리는 행을 포함한 완전성 검증 필요. 부족하면 새 BYPASSRLS/슈퍼권한을 부여하지 말고 BLOCKED.
- [ ] 공식 CLI roles/schema/data 분리 덤프, version별 내부 schema 제외 목록 확인. 같은 시점 일관성(snapshot 또는 승인된 쓰기 정지 창), RLS/GRANT/default ACL/function/sequence/large object 범위 기록.
- [ ] Auth users/identities·sessions/managed schema 사용자 변경사항, Storage metadata와 실제 object bytes, migration history(`supabase_migrations`), extension/설정·외부 키 의존성 포함/제외를 명시. 기본 dump가 전부 포함한다고 가정 금지.
- [ ] 암호화 비공개 저장소·분리된 복구 키·접근자·보존/파기 책임자 및 기간 확정. UTC/ref/tool versions/크기/hash/제외목록만 공개 요약. 운영 dump·접속 문자열·credential·개인정보는 Git/CI artifact/채팅 업로드 금지.
- [ ] 기존 격리 환경의 DB/role/extension 생성·restore 권한과 관리 schema 호환성 확인. 운영으로 restore하지 않는다. roles→schema→data→별도 migration history를 ON_ERROR_STOP/검토된 transaction으로 적용. 권한 오류를 무시하거나 기존 managed role을 임의 DROP하지 않는다.
- [ ] exit0 외에도 테이블/참조 건수·sequence next값·owner/RLS/ACL/함수/signature·합성 smoke와 복원시간/RPO/RTO 실측. 허용 손실·복구시간 목표는 담당자가 지정. 암호화 키가 없으면 복원 완료가 아님.
- [ ] 원본 불변·검증 사본과 manifest 대응·안전 정리 확인. actual backup/restore 증거가 없으면 설치 승인 차단.

## OAuth·제한 계정 시험 승인

별도 Google callback은 `https://<승인ref>.supabase.co/auth/v1/callback`, Electron redirectTo는 `http://127.0.0.1:<동적포트>/auth/callback/<무작위경로>`로 구분한다. 현재 allowlist/provider는 미조회. 최소 wildcard 후보는 기존 P0의 **검토 후보**이며 광범위 ** 허용·Site URL 자동변경 금지.

필요 승인: (a) 필요한 경우 callback/allowlist 설정 변경, (b) 기존 허가된 테스트 계정 로그인·세션/학교 조회, (c) 테스트 학교 A/B와 역할(admin/teacher/assistant/pending/revoked/expired)·허용 CRUD/기간·감사/정리, (d) 제한 테스트 연결 및 별도 activation 정책. 일반 Gate 개방은 별도 승인이다.
개인 로그인→membership 자동 승인 금지. 최초 관리자 실재직/독립 승인자 정책은 fixture로 대체하지 않는다. 종료 시 요청 중단→세션/멤버십 회수와 이전 JWT 거부→Gate/RPC CLOSED→대상별 합성 데이터 보존/정리 계획 이행. Auth user 일괄 삭제/개인 업무 데이터 정리 금지. 원격 회수 미확인은 unconfirmed로 기록한다.

## 판정

- **PASS (STATIC/LOCAL SQL):** 후보 SQL·기존 H1/TD2/저장 계약 무변경, 범위 내 기본 ACL/권한 누락/rollback/CLOSED/합성 비간섭 검증. 정확한 실행 source·개별 결과·SQL/hash·정리는 `school-workspace/hosted-h1/qa/h2-p1/evidence/` 참조.
- **NOT RUN:** 운영 접속/SQL/rows/백업 추출·실덤프 restore·OAuth·실계정·Hosted/Windows 추가 QA. 이전 H1 PASS를 확장하지 않음.
- **BLOCKED:** 설치자 미확인 권한,19 definer 본문/교차 위험, 최신 실제 catalog 지문·backup/restore 증거·설치/로그인 별도 승인.

**운영 CLOSED 설치 가능성: 조건부 후보. 실제 운영 설치 실행은 BLOCKED 유지.**
