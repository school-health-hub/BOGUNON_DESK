# SCHOOL09CH2 A2 자율 해결·검증 — CONDITIONAL

운영 적용은 여전히 BLOCKED다. 로컬 설치 경계의 결함·불필요한 권한 결합은 코드로 해결했으며,
실제 Managed 지원/배포 신원/정책 승인을 로컬 성공으로 대체하지 않았다.
운영 프로젝트 xxownwxxajzrviuvvfiu 접속·변경·실제 로그인/계정/RPC/DDL/DML/GRANT/배포0.

## 1. 최초 BLOCKED 원인

기존 Hosted 자료는 Auth table owner/SELECT와 postgres BYPASSRLS, Workspace 미설치만 보여준다.
함수 OWNER 위임/SET/schema CREATE·Managed 지원 정책은 증명하지 않는다.
09C 원본의 두 DDL 소유권 문제는 이전09CH의 LOCAL 후보에서 이미 수정됐지만,
단일 설치자가 Auth/Workspace owner 양쪽 권한을 가져야 한다는 조건이 남았다.
이전26 PASS를 반복하지 않고 해당 규약과 새 경로를 대조했다.

## 2. 새 권한 조건과 구현

**Auth-side 설치와 Workspace 연결을 서로 독립된 transaction/principal로 분리했다.**

| 실제 로컬 profile | 속성 | 허용 | 없는 권한 |
|---|---|---|---|
| h2_provider | LOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT | 승인된 Auth owner SET·DB CREATE | Workspace owner/reader SET |
| h2_workspace | LOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT | ws_owner/runtime/reader SET | Auth owner SET |

Workspace 설치자의 Auth SET 요구를 제거했다. Auth owner에게 Workspace content 권한을 새로 주지 않는다.
이 profile의 membership은 **합성 fixture**다. 실제 Hosted에 그러한 권한을 GRANT하거나 지원된다고 확인한 것은 아니다.
새 Hosted metadata 관측은0이며 필요한 역할 조건만 분리·구체화했다.

## 3. 검증된 SQL 후보

INSTALL_PLAN.json에는 다음 성공 후보만 들어 있다. production_eligible=false, automatic_activation=false다.

1. `01-provider-local.sql`: 검토된 CLOSED core의 함수/RLS/역할을 검사하고 Auth-owned boolean2개 설치. 같은 transaction에서 ACL 정리·원시 reader SELECT 철회. 동일 bridge 재시도는 정의/OWNER/ACL 검사 후 no-op.
2. `02-bind-workspace-local.sql`: Auth SET 없는 Workspace 설치자가 기존 helper2를 실제 reader owner 문맥으로 연결. 임시 CREATE 회수, 별도 h2_release/h2_rpc_manifest 생성. 모든54 RPC는 CLOSED 유지.
3. `03-activate-qa-only.sql`: 격리 QA에서만 별도 실행. public/private 각 실제 function owner로54쌍 EXECUTE. 일반 요청에 service_role 사용 없음.
4. `04-close-local.sql`: 삭제 없이54쌍 차단. 정상은 closed, drift는 closed_unverified. 변조된 지문을 정상으로 자동 채택하지 않음.
5. `05-hosted-readonly.sql`: ChatGPT용 SELECT. 실행 계획의 변경 명령이 아니다.

각 단계는 사전조건 실패 시 중단한다. provider만 성공한 경우 binding 실패를 복구해 재시도할 수 있고 그 사이 public54는 CLOSED다.
새 release version/structural fingerprint를 사용하며 원래 S08 장부를 다시 쓰지 않는다.
실패한 후보/BFF 가설/부정fixture를 운영 적용 목록에 자동 포함하지 않는다.

## 4. 테스트 결과

| 실행 | PASS | FAIL | 범위 |
|---|---:|---:|---|
| 새 LOCAL PostgreSQL17.6 |23|0|분리 권한·비슈퍼 설치·기본CLOSED·일부 실패 rollback·resume/no-op·fingerprint/drift|
| 새 LOCAL PostgREST13.0.4 |15|0|실제HTTP·JWT·세션/역할/학교·purpose write·54차단|
| 새 MOCK 로그 보호 |1|0|PostgREST 시작 실패 예외의 서명재료 비노출|
| 기존09C DB177/REST23 |REFERENCED|—|a16245d의 기존 증거 보존, 신규에 합산 안 함|
| 이전09CH 경계26 |REFERENCED|—|7801638의 기존 증거 보존, 반복 안 함|
| Hosted Auth/PostgREST·실계정·Windows/Chromium |NOT RUN|—|운영 연결/배포 없음, 제품 소스 변경 없음|

HTTP의54 CLOSED108요청은 한 묶음의 테스트다. 결과 파일은 총39개 독립 체크(23 DB+15 HTTP+1 MOCK)다.
오류 로그는 별도로 보존하고 최종 FAIL0을 확인했다. 같은 테스트 재실행을 새 개수로 세지 않는다.

## 5. 54개 계약·세션 보장

공개54의 서명/본문/소유자는 변하지 않았다. source baseline의 private 함수·설정·RLS/role 상한도 검사한다.
Auth boolean2개/private helper2개의 본문은09C와 동일 SHA-256이다. Renderer/Preload/Main/Web 제품 파일 변경0.
실제 local API에서 teacher write, pending/A-B 격리, 역할 강등·멤버십 정지 이후 old JWT 거부를 확인했다.

동일 UID의 두 세션 중 하나를 Auth table에서 제거하면 해당 JWT만 거부하고 다른 세션은 허용한다.
not_after 만료, 목적별 revoke RPC 이후 Auth row가 남아 있어도 다음 요청이 거부되는 것을 확인했다.
이는 사용자 존재만 확인하는 검사와 다르다. 그러나 actual GoTrue logout/전역회수/API timing·JWT/JWKS·7일/최근10분과
Google provider의 동작은 **NOT VERIFIED**다. 합성 JWT/세션행 시험을 Hosted 즉시 회수 PASS로 부르지 않는다.

## 6. 대안

A2 분리 경로를 먼저 구현했으며 다른 runtime 모델을 임의로 운영 후보에 넣지 않았다.
Trusted BFF는 session_id-specific live 검증과 직접 RPC 우회 차단까지 필요하다.
UID-only·cache/TTL·다른 Auth client의 회수를 모르는 자체 ledger만으로 대체하는 것은 현재 요구를 충족하지 못한다.
별도 verifier라는 이름으로 raw Auth SELECT를 우회하거나 service_role 요청으로 바꾸지 않는다.
공식 supported Auth API/제한 primitive의 실제 session 회수 의미는 별도 Hosted 검증이 필요하다.
이 계약이 달라지는 BFF/gateway 대안은 승인 전 운영 적용 제외다. DECISIONS.md에 근거·영향을 정리했다.

## 7. 설치 범위와 남은 조건

이번 것은 **검토된 CLOSED S08 core 위의 A2 layer**다. 전체 fresh Hosted installer라고 주장하지 않는다.
테스트 baseline은 기존 S08/local fixture로 준비했다. 그 fixture의 과거4열 grant는 운영 절차가 아니며
H2 scripts가 새로 GRANT하지 않는다. provider 성공 이후 Workspace/client의 session 원문 SELECT는0이다.
역할/스키마가 없는 실제 운영에서는 foundation·Auth users FK/공식 helper권한·A2 checker가 들어간
승인된 fresh 누적 core/새 fingerprint 통합이 선행돼야 한다. 원시 SELECT를 먼저 운영에 주는 편법은 제안하지 않는다.

추가 Hosted 조건은 다음과 같다.

- **Auth-side 지원**: 별도 승인된 신원이 custom private 함수를 Auth owner로 생성·위임할 수 있는가. Managed 업그레이드/복원 정책도 지원하는가.
- **Workspace-side**: 실제 배포 identity의 ws_owner/runtime/reader SET와 신규 역할/스키마/FK 준비가 가능한가. 이제 Auth SET는 이 신원에 필요 없다.
- **실제 Auth/API**: provider/redirect·JWT/JWKS·refresh/logout·Data API/private schema·실계정 부정 시험.
- **운영 정책**: 최초관리자 책임/독립 담당자2인·증빙·보존/국외저장·복구 승인. 이전 미승인 상태 그대로다.

이것들을 확인하려고 운영 DDL/GRANT를 실행하지 않았다. 정확한 SELECT와 질문은05/운영 인계 문서에 모았다.

## 8. 자율 수정·검증 보존

불필요한 namespace 조회권한 요구는 OID metadata로 수정하고, 생성 SQL 토큰 오류를 최소 수정했다.
설정·함수 definition/역할 drift 검증과 실패 후 재개/폐쇄를 강화했다. 결함별 실질 수정1회,3회 상한 이내다.
일반적인 코드/SQL/테스트 오류를 사용자에게 새 프롬프트로 넘기지 않고 수정·재검증했다.
현재 새 후보의 일반 오류/실패 테스트는 없다. 실패 로그·원인·재검증은 QA_FIX_LOG.md/evidence에 보존한다.
Python/Bash 구문·입력/본문/파일 해시·diff/비밀정보 검사를 수행한다.
새 TypeScript/제품 코드가 없으므로 제품 빌드·기존13타입오류/xlsx403 재현은 이번 NOT RUN이다.

## 9. Git·운영 승인

원격 통합39c775c, 기준09CH7801638을 확인하고 독립 `feature/school-09ch2-authz-resolution`에서 작업했다.
변경은 school-workspace/school09ch2만이다. 최종 SHA/원격 일치·0/0·clean/ZIP은 GIT_RECEIPT.json과 완료 보고를 따른다.
main/통합/이전 feature·기존 개인 데이터/Finance/Inventory/기존Auth경계·Native WorkerW 변경0.

정확한 후보 SQL/SHA/권한 목록·백업/복구·fresh core 검토와 별도 사용자 운영 변경 승인 전에는
운영 migration·Auth·GRANT·실계정 시험·배포를 수행할 수 없다.
**최종 CONDITIONAL(검증된 로컬 설치 후보), 운영 적용 BLOCKED.**
기술적 권한 결합과 복구/lifecycle 결함은 해결했지만 실제 Hosted 권한/서비스 지원·기관 정책은 외부 증거로만 해소할 수 있다.
