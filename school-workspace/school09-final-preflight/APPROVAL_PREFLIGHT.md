# SCHOOL-09 운영 설치 승인 전 최종 점검

기준: 통합 `838cc0b1a7dc50129aebda75cf18b73386ed9bf7` (원격 HEAD 일치).
2026-11-06, BogunOn `xxownwxxajzrviuvvfiu` / Sydney만 READ-ONLY 조회.
0원·기존 두 프로젝트 유지 정책 준수. BAERURI 접근, 새 프로젝트/유료 전환, 운영 변경·계정 생성·로그인 시험 없음. LOCAL/Windows PASS 재실행 없음.

**판정: 사전점검 자료 CONDITIONAL. 운영 설치 승인 대기. 백업·복구 증거와 운영 정책 미확정으로 설치/서비스 활성화는 실행하지 않음.**

## 1. 현재 DB 및 대상

- ACTIVE_HEALTHY, PostgreSQL 17.6, SQL 신원 postgres (NOSUPERUSER, BYPASSRLS, CREATEROLE).
- public 일반 테이블 64개, RLS 정책 232개, SECURITY DEFINER 20개. 과거 '68개 테이블'과 집계 기준/시점이 달라 같다고 단정하지 않는다. 이번 64는 pg_class relkind=r만 집계했다.
- Workspace 네 스키마·ws_ 역할·public ws_ 함수/관계명 충돌 없음. 전체 타입/연산자 등 모든 네임스페이스 무충돌을 증명한 것은 아니며 설치 직전00 검사 필요.
- DB CREATE/public CREATE grant option/auth USAGE/users.id REFERENCES/Auth sessions SELECT 허용. auth CREATE 및 Auth owner SET ROLE 불가, authenticated 원본 sessions SELECT 불가.
- 설치 목표: workspace/workspace_private/workspace_auth_bridge/workspace_bootstrap, 최소권한 역할·FK·RLS·54개 공개 wrapper 및 내부 함수. 기존 public 개인 테이블과 Auth 스키마에는 사용자 정의 객체를 설치하지 않는다.
- 메타데이터 권한 보유는 실제 Hosted FK/owner 이전 성공 보증이 아니다. 최신 SELECT 원문과 응답은 HOSTED_METADATA.sql/json 참조. 사용자/Auth 행은 읽지 않았다.

## 2. 백업·복구 계획 — 설치 전 충족할 조건

무료 플랜에서 사용 가능한 복구 지점을 자동으로 가정하지 않는다. 담당자가 기존 승인된 보안 경로로 로컬 암호화 보관하는 논리 백업을 준비한다. 백업 생성·원문 반출·복구 실행은 이번에 하지 않았고, 저장 위치/책임자/복구 검증 증거도 아직 제공되지 않았다.

| 대상 | 준비할 산출물 | 승인 전 확인 |
|---|---|---|
| DB 구조/권한 | 역할·멤버십·schema/table/sequence/function/RLS/ACL/extension/trigger 및 migration 이력의 목록과 논리 덤프 | 기존 public/Workspace 설치 전 기준선, ACL 누락 여부 |
| 기존 업무 데이터 | 일관된 시점의 기존 앱 데이터·sequence 값 백업 | 무결성/압축 검사, 암호화·접근자·해시·시점 기록 |
| Auth 데이터 | 지원되는 Auth 백업 범위를 확인하고 users/identities 및 필요한 Auth 상태 보존 | 일반 앱 db dump가 managed Auth 전체를 포함한다고 가정하지 않음; 암호화 열/프로젝트 키 의존 검토 |
| Auth/플랫폼 설정 | provider 활성 상태, site/redirect allowlist, JWT/세션 정책, SMTP·도메인·Data API 노출·키 버전 식별자·비밀 보관 위치 | DB dump와 별개. 비밀값은 Git/ZIP/채팅에 넣지 않음 |
| Storage 사용 시 | 버킷 정책/객체 목록과 실제 파일 별도 보호 | DB 백업이 실제 파일을 보관하지 않음 |
| 복구 실행계획 | 담당자·연락처·유지보수 시간·허용 RPO/RTO·실패 판단·명령 리뷰 | 복구 중 변경 유실과 재로그인 영향 승인 |

실행 전 설치된 Supabase CLI/pg_dump 도움말과 버전을 확인하고 대상 프로젝트 ref를 고정한다. 승인된 관리자가 schema/role/data 및 managed Auth 포함 범위를 명시해 export한다. 비밀 문자열을 명령 인자/로그에 남기지 않는다. 공식 CLI 기본 dump의 제외 스키마를 반드시 확인한다. Auth 포함 여부를 확인하지 못하면 '완전 백업'으로 승인하지 않는다.

복구 가능성 검토는 기존 로컬 격리 환경에서 dump 목록·정합성·복원 가능 항목을 검토할 수 있다. 새 프로젝트는 만들지 않으며 기존 PASS를 다시 돌리지 않는다. Managed Auth 전체 복구/암호화 키 호환성을 로컬 검토만으로 보증하지 않는다. 이 확인이 미완료면 설치를 보류한다. 실제 dump에는 개인정보·인증 비밀이 있을 수 있어 이 개발 패키지에 포함하지 않는다.

## 3. 최종 SQL과 실행 순서

대상 파일은 `school-workspace/school09d0/sql/`이다. INSTALL_PLAN.json에 고정된 네 SHA-256 모두 통합 SHA에서 일치했다. RPC_REVIEW.json에 결과 및 공개54 서명을 보존했다.

1. 승인 전: endpoint/DB 이름/실행 신원·원본 해시·백업 영수증·유지보수 창·담당자를 확인. 제품 Feature Gate CLOSED 유지.
2. `00-hosted-preflight-select.sql`: 충돌, Auth 선행권한, 기본 ACL, 기존 객체 기준선 재확인. 결과가 다르면 중단.
3. 별도 승인 후에만 `01-install-closed-candidate.sql`: 검토된 단일 direct/session-pooler 세션에서 ON_ERROR_STOP=1. 파일 자체 BEGIN/COMMIT 사용, 문장 분할·auto-commit 금지. target marker `xxownwxxajzrviuvvfiu`, plan marker `SCHOOL-09D-0:CLOSED`를 같은 세션에 설정하되 marker는 endpoint 검증이나 승인 대체물이 아님.
4. `02-postflight-select.sql`: 54개 정확한 서명, CLOSED ACL, 소유권/FK/RLS/bridge·bootstrap 차단, 기존 public 기준선 보존 확인. 갯수만으로 통과시키지 않음.
5. 종료: CLOSED 상태 설치 영수증을 기록하고 정지. 이 설치는 Google/Auth 설정 변경·최초 관리자 부여·RPC 활성화 승인을 포함하지 않음.

이전 단계 SQL 전체를 이어 실행하지 않는다. A2/Auth 스키마 설치, raw Auth grant, local fixture/activate-local-only.sql은 운영 적용 목록에서 제외한다. 반복 설치는 후보의 지문/상태 검증이 일치할 때만 가능하며 자동 덮어쓰기가 아니다.

## 4. 54 RPC·CLOSED·긴급 차단

- 공개 함수 고유 이름 54개, 공개 wrapper는 SECURITY INVOKER. SQL 내 CREATE 선언은55번(이전 선언 후 교체 포함)으로 설치 후 고유54와 구분한다.
- 내부 실행은 ws_runtime/ws_authz_reader 등 비소유·NOBYPASSRLS 역할과 서버의 현재 세션/학교 멤버십 검사에 의존한다. authenticated에는 원시 테이블 권한을 부여하지 않는다.
- bridge 두 boolean 함수는 private 스키마의 postgres 소유 SECURITY DEFINER: BYPASSRLS 위험이 있는 예외 경계다. 고정 search_path, JWT 본인 sub/session_id 결합, 제한 EXECUTE, Auth 원본 결과 미반환 계약 유지. 실제 Hosted 호출은 NOT RUN.
- 설치 중 임시 EXECUTE 부여 구간이 있으나 외부 세션에 노출되지 않도록 같은 단일 트랜잭션에서 최종 공개/비공개54 권한을 철회한다. PUBLIC/anon/authenticated 및 기존 creator 기본 ACL로 유입되는 grant도 최종 정리해야 한다. 전역 기본 ACL과 기존20 함수는 변경하지 않는다.
- CLOSED 최종 결과는 public54와 대응 private54의 authenticated/PUBLIC/anon 실행 차단, private 스키마 노출 차단, bootstrap 미승인 상태다. 소유 역할/내부 최소권한까지 모두 제거한다는 뜻은 아니다.
- Data API allowlist role 설정 조회는 비어 있어 실제 공개 스키마/캐시 상태 NOT VERIFIED. public만 필요한 RPC 노출 후보, private/bridge/bootstrap 노출 금지.
- `03-emergency-close.sql`은 정해진54쌍을 차단하고 `closed_unverified` 상태로 전환한다. 데이터 삭제/지문 정상화/자동 재활성화 없음. bootstrap 별도 경로까지 자동 철회하는 파일은 아니므로 bootstrap은 처음부터 별도 CLOSED 유지 및 운영자 권한 취소 계획 필요.
- emergency SQL도 운영 권한 변경이므로 이번에는 실행하지 않음. 추후 설치 승인서에 해당 파일·발동자·조건의 사전 승인 포함 필요. 강제 종료나 활성 트랜잭션 취소는 포함하지 않으므로 이미 진행 중인 요청은 별도 사고 절차로 다룬다.
- 현재 패키지에는 운영 활성화 SQL 없음. 설치 승인과 시험용 최소 allowlist 활성화/Feature Gate 승인은 분리해야 한다.

## 5. 최초 학교 관리자

NEIS 교육청코드+학교코드의 신뢰된 directory 확인 → 본인 계정 가입/최초 관리자 신청 pending → 운영 검증 → 별도 bootstrap propose → 독립 승인자 approve → 서버 멤버십 SCHOOL_ADMIN active 순서다.

bootstrap.command는 별도 DB principal/operator 매핑·활성 계정·school scope·동의 참조·증빙 SHA-256·request_id/expected_version을 검사한다. 제안자와 승인자는 다른 principal, 대상자 자기 승인 불가. 증빙 해시는 재직 증명 자체가 아니며 원문은 별도 통제 저장소에서 사람이 검증해야 한다. 실제 operator provisioning 및 EXECUTE 부여는 미실행/별도 승인이다. 공유 postgres 세션으로 두 승인자를 가장하지 않는다.

관리자2인 이상, 마지막 관리자 보호, 교사 대상 propose→accept 추가/이관 계약 유지. 지원강사를 직접 관리자로 승격하지 않음. 승인 담당자 부재/계정 분실 시 독립 복구 담당자를 지정하고 같은 검증·감사 경계를 유지한다.

## 6. 운영 전 결정표

| 결정 | 제안되는 최소 계약 | 남은 승인 |
|---|---|---|
| 최초 관리자 검증 | 학교 재직·위임 확인, 독립 제안/승인 담당자2인, 대상자 배제 | 책임자 실명/직무·대리·분실 복구 담당 |
| 증빙 | 주민번호/학생정보 제외, 최소 항목만 별도 암호화 보관 | 종류·접근자·정확한 보존기간·삭제 증거 |
| 학교 기록 | 학교 소유, 전근/퇴직해도 업무 기록 유지, 멤버십 즉시 회수 | 업무/이력/감사/백업별 기간·기산일·예외 보존 |
| 수정/삭제 | 업무 보관·논리 삭제와 실제 파기 분리, 재고 거래 임의삭제 금지 | 파기 승인자·일정·백업 만료·법적 보존 근거 |
| 학교 탈퇴/폐쇄 | 마지막 관리자 보호, 학교 전체 종료는 별도 검증 | 자료 인계·열람·종료·관리자 부재 처리 |
| 개인정보·국외 저장 | 학생 민감정보/개인 Finance/인증정보 금지, Sydney 저장 고지 | 기관 근거·고지·감사 접근 범위 |
| 운영 복구 | 비파괴 차단 우선, 전체 복원은 최후 수단 | 백업 책임자·보관처·RPO/RTO·유지보수 창 |

정확한 기간과 책임자를 임의 확정하지 않았다. 최소한 이 결정표와 백업 영수증이 승인 자료에 채워져야 한다.

## 7. 실패·복구 분기

- COMMIT 이전 SQL 오류: ON_ERROR_STOP로 중단, 동일 세션 ROLLBACK/연결 종료 후 기준선 재조회. 부분 파일 실행·추가 GRANT·권한 확대로 통과시키지 않는다.
- 연결 끊김/COMMIT 결과 불명: 재실행 전에 release/지문·실제 객체를 READ-ONLY 확인. 결과 불명 상태를 새 설치로 간주하지 않는다.
- COMMIT 이후 postflight 실패: 제품 Gate CLOSED, 필요한 경우 별도 승인된 emergency close. 실패 객체/ACL·해시 보존, 삭제 없이 원인 분석·수정 후보 재검토. closed_unverified는 일반 설치 재실행으로 덮어쓰지 않음.
- 기존 기능 손상/노출 의심: Workspace 차단, 운영자 통보, 영향 범위 확인. 기존 DB 전체 백업 복원은 이후 정상 데이터까지 되돌릴 수 있으므로 별도 중단·복원 승인 필요. 현재용 자동 DROP/TRUNCATE/전체 복구 SQL은 제공하지 않는다.
- 최후 복원: 승인된 백업 시점 및 손실 범위 결정 → 기존 서비스 쓰기 중단 → 담당자가 검토한 대상별 복구 → 구조/권한/Auth 호환·데이터 정합성 확인 → 필요 시 세션 재인증 → 별도 서비스 재개 승인. 관리형 Auth 객체를 generic restore로 덮어쓰지 않는다.

## 8. 설치 후 로그인·기능 체크리스트 — 현재 전부 NOT RUN

- [ ] CLOSED 설치의 owner/FK/54서명/ACL/RLS/기존 public 구조와 데이터 기준선 일치.
- [ ] Google provider/redirect, Electron PKCE callback, Web BFF 영구 세션 저장소·cookie/CSRF 검토 및 별도 설정 승인.
- [ ] 운영 시험 대상 신원·학교·기간·최소 수집·정리 승인. 실제 교직원/학생 자료 입력 금지.
- [ ] 54 전체 일괄 공개 없이 승인된 시험 RPC allowlist/내부 체인 활성화 후보를 별도 검토. Feature Gate 계속 CLOSED 또는 명시 승인된 제한 QA 모드.
- [ ] 실제 로그인 → 본인 sub/session_id → pending 차단 → 승인 멤버십 학교 선택. 학교코드/이메일/user_metadata로 권한 대체 금지.
- [ ] 관리자·교사·지원강사 기능 상한, 교차 학교/타인 ID 접근 거부, 마지막 관리자 보호.
- [ ] 공동 업무 생성/배정/완료, 일정 생성/수정/취소·서울 날짜, 인수인계 읽음/수정 후 재확인.
- [ ] 물품 입고/사용/조정/폐기, 만료 lot 차단, 중복 request_id/다른 payload·version 충돌·감사 원자성.
- [ ] 두 실제 세션을 구별해 logout/revoke/refresh/만료 후 다음 요청 거부, 멤버십 회수 직후 접근 차단.
- [ ] 학교/계정 전환 시 이전 응답 폐기, Renderer token 미노출, 개인 자료 자동 업로드 없음, 오류 시 개인 기능 유지.
- [ ] 시험 기록 검토와 incident/close 절차 확인 뒤 별도 활성화 승인. 역사적 Windows PASS를 Hosted PASS로 승계하지 않음.

## 9. 승인 자료와 남은 조건

이번에 확인한 것: 최종 통합 HEAD, 현재 BogunOn metadata, 기존 설치4파일 해시 일치, 공개54 정적 계약, 설치/중단/복구 체크리스트. 기존 LOCAL/Windows PASS는 그대로 보존했다.

설치 전 남은 것: 실제 백업 영수증·범위/복구 검증, 담당자와 RPO/RTO, 정책 결정표, 정확한 SQL hash에 대한 CLOSED 설치 및 비상차단 승인. 활성화 전에는 별도의 Hosted owner/FK/Data API/실제 Auth·세션 회수 결과와 시험/최초관리자/활성화 승인이 필요하다. 실행하지 않은 검증은 모두 NOT RUN/NOT VERIFIED다.

공식 참고(2026-11-06 확인):
- https://supabase.com/docs/guides/platform/backups — 무료 플랜은 직접 export 보관 계획 필요, Storage 파일 별도.
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore — 논리 backup/restore 항목과 관리형 객체·암호화 의존 검토 참고. 문서의 새 프로젝트 생성 예시는 이번 정책에 적용하지 않는다.
