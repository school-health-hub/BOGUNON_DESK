# 설치 순서·중단·복구 계약

## 현재 실행 가능한 격리 설치 후보

새 DB `school01a` 전용이며 운영에서 실행하지 않는다. 아래 순서를 합치는 자동 운영 apply script는 제공하지 않는다.

| 순서 | 파일 | 조건/효과 |
|---|---|---|
| 0 (테스트 전용) | `local/tests/auth_fixture.sql` → `school06/tests/bootstrap.sql` | 합성 Auth·기존 public sentinel. 운영 금지 |
| 1 | `school08/sql/01-foundation.sql` | frozen `school06/.../20261105104546_workspace_foundation.sql`와 byte-identical. 세 역할·두 schema·기초 장부 |
| 2 (테스트 전용) | `school06/tests/local-auth-capabilities.sql` | 합성 Auth 소유자에게서 승인된 최소 열 권한만 부여. Managed Auth GRANT 대용 아님 |
| 3 | `school08/supabase/migrations/20261105130003_cumulative_workspace.sql` | frozen S06 core+S07 inventory를 하나의 outer transaction으로 설치. 공개54 + 내부54 CLOSED |
| 4 | `school09/sql/postinstall-readonly.sql` | 카탈로그 검사. 실행권한 열지 않음 |
| 5 (격리 QA 전용) | `school08/sql/activate-local.sql` | 명시적으로 매핑54쌍만 authenticated EXECUTE. PUBLIC/anon 계속 차단 |
| 6 | 도메인·부정·REST 테스트 | synthetic data only |
| 7 (격리 QA 전용) | `school08/sql/close-local.sql` | 업무 데이터 삭제 없이54쌍 차단 |

경로는 모두 저장소의 `school-workspace/` 기준이다. S08 `sql/install-candidate.sql`은 1/3의 psql 진입점이다.
Auth 선행조건이 없으면 foundation만 남기고 앱 설치는 중단한다. S08 release가 존재하면 foundation 재실행을 생략한다.

원본 출처(별도로 다시 설치하면 안 됨):

1. S06 core `20261105104548_workspace_core.sql`은 SCHOOL01A, integration status, SCHOOL02/03/04를 순서대로 포함한다.
2. S07 `20261105114645_shared_inventory.sql`은 Inventory를 추가한다.
3. S08 cumulative는 이 둘을 결합하므로 1/2를 따로 적용한 뒤 S08을 또 적용하지 않는다.
4. 기존 S06/S07 장부는 역사적 기록이다. S08 설치 이후 이전 installer/activator로 돌아가지 않는다.

## 원자성·재실행

- foundation은 독립 transaction이다. core+Inventory+누적장부는 하나의 transaction/advisory lock 안에서 설치된다.
- 함수 CREATE 시 PUBLIC 기본 EXECUTE가 생겨도 같은 미커밋 설치 transaction에서 REVOKE가 완료된다. 외부 세션에 중간 권한이 커밋되지 않는다.
- 반복 실행은 release digest/전체 구조 지문/권한/상태를 확인한 뒤 no-op. ALTER된 개체를 정상으로 자동 채택하지 않는다.
- 중간 Inventory 오류 주입 시 core/Inventory DDL 모두 rollback. foundation은 보존한다.
- 이미 별도로 설치된 S06 core 또는 알 수 없는 역할/schema 충돌은 거부한다. 데이터 삭제로 충돌을 없애지 않는다.
- MD5 catalog fingerprint는 구조 드리프트 탐지용이다. 공격자에 대한 서명/신뢰 근거는 아니다. 배포 파일 무결성은 SHA-256 manifest로 확인한다.
- DDL 적용권자는 자체적으로 catalog를 변경할 수 있는 신뢰 주체다. 앱 RPC 보안과 운영자 계정 통제를 혼동하지 않는다.

## Hosted 적용 전 필수 HOLD

현재 cumulative와 활성화/폐쇄 스크립트는 **local-only**다. DB 이름/GUC를 바꿔 이 가드를 우회하지 않는다.
운영 후보로 승인하려면 별도 검토된 hosted installer와 managed 역할/Auth 권한 증거가 필요하다. 이번에는
배포 가드를 제거하거나 postgres/service_role 소유로 바꾸지 않았다. 따라서 **운영 적용 실행은 BLOCKED**다.

진행 선행조건:

1. 프로젝트/리전과 실제 변경 책임·변경번호·유지보수 창 확인. GUC는 프로젝트 신원증명이 아니다.
2. 최신 READ-ONLY query 결과로 schema/역할/함수 충돌, 기존 public 정의/ACL/RLS 지문을 저장.
3. 실제 provider/redirect/JWT/세션 수명과 최소 Auth 열 권한을 확인. 읽기 전용 감사만으로 GRANT 성공을 단정하지 않음.
4. managed 역할 생성/소유권/SET ROLE 권한이 가능한지 운영자·서비스 지원의 승인된 증거 확보.
5. 신뢰 학교 directory, 최초 관리자 검증 책임, 국외 저장 안내, 보존기간, 비용·백업/복구 책임 확정.
6. 최근 백업·PITR 보장 범위와 복원 시험/복구 목표 확인. 이 작업에서는 백업/PITR 생성/복원도 실행하지 않음.
7. Hosted용 별도 설치본을 격리 PG+가능한 managed staging에서 재검증하고 명시적 운영 변경 승인 획득.
8. 승인 후에도 최초 설치 RPC54 CLOSED와 product production gate CLOSED 유지. DB와 product gate는 별개.
9. 별도 실계정 Hosted 시험 승인 후 최소 테스트 계정으로 Auth·PostgREST·회수·학교 인가를 검증.
10. 모든 security/policy/Windows gate 충족 후 별도 공개 승인. UI 플래그로 서버 권한을 대신하지 않음.

## 비파괴 복구

- foundation-only: 원인/충돌 메타데이터 보존. 승인된 권한 선행조건 후 동일 후보 재시도.
- 앱 transaction 실패: rollback 결과 확인. 자동 DROP/DELETE/CASCADE 없음.
- 설치 후 이상: feature gate CLOSED 유지, 승인된 환경별 purpose-RPC 폐쇄 절차 우선. 로컬 close를 운영에 임의 실행하지 않음.
- drift 발생: installer/activate 거부, 격리 emergency close는 `closed_unverified`를 남기고 데이터 보존.
- 앱 데이터가 생긴 뒤 DROP TABLE/role/schema와 Auth FK 변경은 되돌리기 어려운 DDL이다. 자동 rollback SQL로 제공하지 않는다.
- 데이터 보존이 필요한 업그레이드는 별도 migration 설계·승인. 과거 S06/07 설치를 S08로 자동 adoption하지 않는다.
