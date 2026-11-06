# SCHOOL-09D-1 — 추가 OAuth 후 READ-ONLY 검증 재개

2026-11-06. 추가 OAuth로 기존 연결 차단이 해소됐다. 최신 사용자 범위 정정에 따라 추가 프로젝트 요구는 철회하며 기존 두 프로젝트만 유지한다.

## 최신 결과

- BOGUNON 연결(`link_6aed2f31442c819194553865159fbf48`) → sungandi (`szbauswploxaodvpwtaf`) → BogunOn `xxownwxxajzrviuvvfiu`, Sydney. 프로젝트 메타데이터와 두 건의 SELECT-only 카탈로그 조회 성공.
- 기존 연결(`link_6a44df16f584819185f0e72fe3c47a52`) → TEAM BAERURI → baeruri `zbdnvdjleipnrprpwqyd`, Seoul. 프로젝트 메타데이터 접근 유지. DB/테이블/시험 조회는 하지 않음.
- 두 연결의 조직·프로젝트 목록과 get_project 결과를 각각 검증했다. 모든 요청은 link_id와 project ID를 명시했고 대체 경로는 사용하지 않았다. link ID는 연결 라우팅 식별자이며 인증 토큰이 아니다.
- 기존 두 프로젝트만 유지한다. 추가 프로젝트 생성·확보·비용 검토 및 유료 플랜 전환은 이번 작업과 후속 계획에서 제외한다.

## VERIFIED HOSTED READ-ONLY

| 항목 | 실제 결과 |
|---|---|
| SQL 신원 / 버전 | postgres / PostgreSQL 17.6 |
| 기존 public RLS / SECURITY DEFINER | 232 / 20 |
| public ws_v1 RPC / Workspace 스키마·역할 | 0 / 미설치 |
| Auth users/sessions 소유자 | supabase_auth_admin, 두 테이블 RLS 활성 |
| Auth CREATE / Auth 소유자 SET ROLE | false / false |
| DB CREATE / public CREATE grant option / users.id REFERENCES | true / true / true |
| postgres Auth 원본 SELECT | 현재 허용; 필요한 세션 4개 열도 SELECT 허용 |
| authenticated 및 anon Auth 원본 SELECT | 모두 false |
| auth.uid/jwt 실행 | 현재 SQL 신원에 허용 |
| 개인 tasks/events/profiles/medication_items | RLS 활성 |
| 기존 definer 20개 | 모두 postgres 소유, 빈 search_path; authenticated EXECUTE 19개, anon 0개 |
| 기존 postgres public 기본 ACL | anon/authenticated/service_role에 함수 EXECUTE 기본 부여 존재 |

SELECT 권한 확인만 했으며 Auth 사용자·세션 행은 읽지 않았다. 기존 definer의 literal Workspace 참조 및 EXECUTE 문자열 탐지 결과는 모두 false지만, 전체 호출 그래프의 안전성을 증명하지 않는다. 기존 함수는 변경하지 않았다.

## D0 설치 계약 대조

현재 신원의 Auth4-column SELECT, auth USAGE, auth.uid/jwt EXECUTE, users.id REFERENCES, DB CREATE, CREATEROLE, public CREATE grant option 요구는 메타데이터로 확인됐다. 그러나 역할 생성/소유권 이전/FK 생성/함수 실행이 실제 성공한 것은 아니다. Auth CREATE와 supabase_auth_admin SET ROLE 금지는 유지되며, D0 후보는 이 경로를 사용하지 않아야 한다.

public 기본 함수 EXECUTE는 명시적으로 제거해야 한다. D0의 같은 설치 트랜잭션 안 ACL 정리/CLOSED postflight 계약은 계속 필수다. 기존 전역 기본 ACL을 변경하거나 새 GRANT를 실행하지 않았다. 로컬 PASS를 Hosted 설치 PASS로 승격하지 않는다.

## NOT VERIFIED / NOT RUN

- Data API 노출 설정: allowlist한 role/pg_settings 조회 결과가 비어 있어 실제 설정을 확정할 수 없음. 비공개 설정·JWT secret을 조회하지 않음.
- Hosted 실제 CLOSED 설치, owner/FK, 54개 RPC 실행 및 PostgREST: NOT RUN.
- 실제 Google OAuth/provider/redirect, 계정 생성, 로그인/refresh/logout/세션 회수: NOT RUN.
- 새 로컬 설치·보안·기존 QA 반복: 수행하지 않음. 기존 D0 로컬 증거 보존.
- 운영 DDL/DML/GRANT/migration/Auth 변경/배포: 수행하지 않음.

## 고정 정책 및 종료 판정

**0원 운영 · 기존 두 프로젝트 유지 · 프로젝트 간 완전 격리**를 고정한다.
BogunOn `xxownwxxajzrviuvvfiu`와 BAERURI `zbdnvdjleipnrprpwqyd`만 사용한다.
추가 프로젝트 생성·확보·비용 검토·유료 전환을 반복하지 않는다. 추가 테스트 프로젝트 미확보는 더 이상 차단 조건이나 사용자 결정 항목이 아니다.

| 구분 | 범위와 상태 |
|---|---|
| 현재 수행 가능한 범위 | 기존 연결별 프로젝트 ID 확인, BogunOn SELECT-only 카탈로그 메타데이터 점검, 기존 SQL 계약과 정적 대조, 증거 보존 |
| 이번에 완료한 범위 | 두 연결의 조직/프로젝트 접근 및 BogunOn 설치 선행권한 메타데이터 확인 |
| 보존할 검증 | SCHOOL-09D-0까지 LOCAL DB/PostgREST/보안 PASS. 반복하지 않고 Hosted PASS로 확대하지 않음 |
| 별도 운영 설치 승인 후만 가능 | BogunOn DDL/DML/GRANT/migration, 실제 owner/FK/54 RPC·Data API 실행 검증 — 현재 NOT RUN |
| 별도 인증 시험/설정 승인 후만 가능 | Auth 설정 변경, 실제 계정 생성·로그인·refresh/logout/회수 검증 — 현재 NOT RUN |
| 계속 금지 | BAERURI를 BogunOn 시험에 사용, ID 불일치/거부 후 자동 대체, 보안 계약 완화 |

최초 관리자 검증 책임·독립 승인자·증빙 보존/삭제·학교 기록 보존·국외 저장 고지는 미결정으로 보존한다. 이번 범위 정정은 정책 승인이나 운영 설치 승인이 아니다.

**최종 CONDITIONAL: SCHOOL-09D-1의 현재 READ-ONLY 범위 완료. 두 연결 검증 PASS. Hosted 실설치·인증 실동작은 NOT RUN이며 운영 적용은 별도 승인 전 수행하지 않는다.**
추가 프로젝트나 운영 승인을 이번 종료 조건으로 요청하지 않는다. 이전 생성 권고는 철회했으며 변경 전 기록은 Git 이력에만 보존한다.

## 증거와 보존

`hosted-readonly/connections.json`, `metadata.sql/json`, `details.sql/json`에 정확한 연결·쿼리·응답을 보존했다. 인증정보·실제 사용자 행·토큰은 포함하지 않았다. 제품/설치 SQL 변경 없음. 전용 feature 브랜치에서만 보존하며 통합 HEAD는 `39c775cdd11509fdc6bc930ef62990acdd1e1315` 그대로다.
