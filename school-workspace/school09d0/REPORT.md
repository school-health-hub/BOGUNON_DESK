# SCHOOL-09D-0 최종 설치 패키지 — CONDITIONAL / 운영 적용 BLOCKED

2026-11-06 KST. 실제 운영 연결/DDL/DML/GRANT/Auth·OAuth 변경/실계정/배포0.
설계 보고서만이 아니라 **누적 설치 후보·사전/사후 SELECT·긴급 차단·실행 시험·인벤토리·Gate 파일**을 완성했다.

## 1. 기준·보존

- H3 기준/시작 원격 HEAD: `4cacc51d06298ee4118273388513be1599d67095`
- 시작 재확인 통합 HEAD: `39c775cdd11509fdc6bc930ef62990acdd1e1315`
- 독립 브랜치/worktree: `feature/school-09d0-final-preflight`
- H3 원본 ZIP SHA-256 `cae8ad31cb8ee643544876cf2a55509b6fd5723a59b12dc7c98b5886d353779d`,517개 파일 검증 PASS.
- 변경은 school-workspace/school09d0만. 기존 feature/통합/main·제품 파일 변경/병합 없음.
- 최종 Source SHA/원격·divergence·clean은 GIT_RECEIPT.json과 완료 보고를 따른다.

## 2. 유일한 설치 순서

| 단계 | 파일 | 계약 |
|---|---|---|
| 사전 감사 |00-hosted-preflight-select.sql|SELECT만. 실제 신원/권한/충돌/default ACL/API 설정 확인|
| fresh 설치 |01-install-closed-candidate.sql|S01~09 전체, 단일 transaction,54 public/private쌍 및 operator CLOSED|
| 사후 감사 |02-postflight-select.sql|owner/RLS/ACL/FK/index/54 서명·개체 인벤토리 SELECT|
| 복구 전용 |03-emergency-close.sql|정해진54쌍 회수, 데이터 삭제 없음, closed_unverified|

기존 foundation/raw Auth grant/A2/H2/H3를 중복 적용하지 않는다. QA activation은 tests/ 아래 별도 파일이며 설치 순서에서 제외한다.
DB 이름 postgres/direct NOSUPERUSER postgres와 명시적 project/plan marker를 요구한다.
동일한01 파일을 로컬 빈 postgres DB에서 실행했다. **GUC marker는 실제 project나 승인 증거가 아니다.**
기존 Workspace 설치와 충돌하면 중단하는 fresh 후보이며 기존 운영 schema를 덮어쓰는 upgrade가 아니다.

## 3. 실제 수정

1. H3에서 postgres TABLE creator defaults가 accounts의 owner 이관 후 남는 상황을 rollback 실험으로 재현했다.
   새 Workspace relation의 불필요 client/PUBLIC/service-role ACL을 명시적으로 회수했다. 기존 내부 역할 권한만 보존했다.
2. 새4 schema도 H3의 정상 USAGE 집합으로 고정해 client CREATE·bridge 접근이 남지 않게 했다.
   기존 public schema/객체와 global default privileges는 변경하지 않는다.
3. strict lifecycle이 지문/Auth 권한 drift 때문에 차단도 거부하는 경우를 검증했다.
   새 emergency close는 canonical54 서명·신뢰한 비BYPASS owner만 대상으로 EXECUTE를 회수하며 Auth 원본 읽기 없이도 동작한다.
4. closed_unverified를 정상 지문으로 채택하지 않는다. installer와 QA activation은 이 상태에서 재개하지 못한다.
   already-CLOSED에서 emergency를 실행해도 QA 재활성화가 불가능한지 별도 transaction 시험했다.
5. 별도 bootstrap owner SET 권한이 없을 때 임의 GRANT하지 않았다. private operator 명령은 독립 CLOSED/운영 승인 대상 그대로다.

권한 상한·세션 회수 의미·학교 인가·업무 함수는 변경하지 않았다. 모든161 함수 정의/소유자/반환/모드는 H3와 동일하며 공개54 계약을 유지한다.
새 설치 지문은 후보에 맞게 별도 식별하되 기존 설치 장부를 다시 채택하거나 overwrite하지 않는다.

## 4. 실제 개체·최소권한

- schema4, 영구 역할5, tables33, indexes68, constraints184, RLS policies87.
- 함수161: public54 전부 INVOKER, private107. SECURITY DEFINER79 중 postgres 소유2, 나머지77은 NOBYPASS 실행 역할.
- 전체 목록: evidence/objects.json,functions.json,security-audit.json, reference/call-graph.json.

postgres는 기존 Hosted에서 BYPASSRLS라는 점을 숨기지 않는다. 상시 postgres 소유 함수는 현재 UID/session_id에 결합된 인자 없는 boolean2개뿐이다.
고정 빈 search_path·완전 수식 Auth 참조·reader만 EXECUTE, UUID 인자/동적 SQL/Workspace 내용 반환 없음.
일반 업무 RPC는 ws_runtime 및 RLS를 사용한다. user_metadata·service_role 요청·설치 여부를 인가에 사용하지 않는다.
Workspace 역할5개에 Auth USAGE/원본 SELECT를 부여하지 않는다. Auth custom 함수/테이블/trigger 생성 없음.
accounts의 Auth FK는 기존 권한을 가진 postgres가 생성 후 ws_owner로 이관하며 ON DELETE SET NULL/tombstone을 유지한다.
이 경계는 [Supabase 공식 별도 스키마 대안](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema-9e32e7)을 따르지만, 실제 Hosted FK/소유권 성공을 의미하지 않는다.

## 5. 실행 결과

| 실행 | PASS | FAIL | 범위 |
|---|---:|---:|---|
| LOCAL PostgreSQL17.6 |30|0|정확한 설치 순서·fresh/replay·중간/최종 rollback·기본 권한 오염·RLS/owner/FK·Inventory race/audit·회수/복구|
| LOCAL PostgREST13.0.4 |15|0|실제 HTTP + 합성 JWT/Auth. anon/pending/교차 학교/권한·세션 회수/private 노출/54 차단|
| MOCK |1|0|시작 실패에 서명재료 비노출|
| 합계 |46|0|체크 합계. 반복/중간44·45·schema-only는 합산하지 않음|
| Hosted 설치/OAuth/실계정/API·Windows |NOT RUN|—|운영 연결/제품 변경 없음|

final-run.log/results.json 기준. S01~09 기능/인가 함수161 정의가 H3와 동일해 H3의137 도메인 시험을 기존 증거로 재사용했고 신규 PASS에 더하지 않았다.
H3의178 PASS도 같은 이유로 재실행하거나 새 수로 합산하지 않았다.
소유자/FK·ENABLE/FORCE RLS·private 직접 호출/임의 UUID oracle·default EXECUTE/USAGE를 검사했다.
기존 public sentinel 정의/ACL/RLS/개인 행, Auth 객체/ACL, global default ACL은 끝까지 동일했다.
이는 합성 sentinel 및 SQL 정적 영향 분석 근거이며 실제 운영68개 테이블의 최신 실사 PASS라는 뜻이 아니다.
실제 개인 DESK 파일/저장 형식·Finance/Inventory/DPAPI·UI/기존19 경고 함수는 변경하지 않았다.

## 6. 복구 경계

- 설치 실패: 한 transaction으로 전체 rollback, 역할/schema/기본 권한 누출 없음. 동일 후보 재시도 가능.
- 정상 설치 후 장애:54 public/private 쌍만 데이터 삭제 없이 차단. 기존 데이터를 보존하고 closed_unverified로 잠금.
- 지문 변경/외부 Auth 읽기 상실에도 긴급 차단 PASS. 임의 owner 전환/기본 지문 재저장/권한 확대 없음.
- 함수 누락·신뢰하지 않은 owner 등은 자동 복구하지 않는다. private operator 권한은 독립 책임 범위.
- 데이터/스키마 자동 DROP/TRUNCATE 롤백은 없다. 상태가 unverified이면 별도 원인/복구 검토 전 활성화하지 않는다.

## 7. Gate 판정

GATES.json과 OPERATING_CHECKLIST.md가 기준이다.

| 구분 | 판정 |
|---|---|
| 로컬 설치·최소권한·46 체크·동일 함수 계약 |VERIFIED LOCAL|
| postgres/Auth 제한 등 기존 사용자 전달 READ-ONLY 사실 |VERIFIED, 과거 전달 범위만|
| 실제 Hosted 설치 신원/기존 Auth 권한·FK/owner/새 역할 |NOT VERIFIED|
| Hosted Data API 설정·private 경계/캐시 |NOT VERIFIED|
| 기존 public SECURITY DEFINER의 동적 호출/새 schema 도달성 |NOT VERIFIED, 별도 READ-ONLY 본문 감사|
| 실제 Google OAuth/JWT/JWKS/refresh/logout/회수/삭제 |NOT VERIFIED|
| 최초 관리자 책임·독립2승인자·증빙/업무 보존·삭제/국외저장·실계정 동의 |BLOCKED, 운영 결정 필요|
| 운영 설치·활성화·배포 |BLOCKED, 별도 승인 필요|

확인되지 않은 Hosted 권한을 로컬 profile이나 합성 JWT로 PASS 처리하지 않았다.
실제 인증/운영 migration/Google 설정은 이번 작업에서 실행하지 않았다.
현재 전달할 추가 Hosted SQL은00이다.02는 향후 별도 승인 설치 후에만 적용할 SELECT다.

## 8. QA·Git·인계

모든 수정은 승인된 최소권한·설치·복구 범위다. 결함별 실질 시도1회로3회 상한 이내이며 실패 로그를 보존했다.
Python/Bash 구문·pinned inputs·SQL/body 해시·secret pattern·Git diff를 확인한다.
제품 코드 변경이 없어 Electron/Web 빌드·기존 타입13/xlsx403/Cargo 재현·Windows QA는 NOT RUN이다. 과거 Windows PASS는 해당 Source에만 유지한다.
검증 결과를 전용 feature에 commit/push, 원격 일치·0/0·clean을 확인하고 ZIP을 생성한다.
ZIP에는 최종 SQL/검증/실패 로그·개체/권한·Gate·체크리스트·상대경로 복원·SHA-256 검증기가 포함된다.
실제 비밀키/토큰/사용자·학생 데이터 없음. 압축 해제·파일 해시·동일 SQL 재생성 검증을 수행한다.

**최종 CONDITIONAL(로컬 최종 설치/복구 후보), 실제 운영 적용 BLOCKED.**
