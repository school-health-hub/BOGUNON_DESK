# IM-1B-2 로컬 QA 결과

## 실행 환경

- project: `inventory_qa`
- Supabase CLI: 2.121.0
- DB: 로컬 Docker `supabase_db_inventory_qa`
- ports: 56320-56327
- 데이터: `.invalid` 이메일과 명시적 synthetic 학교·품목·lot만 사용

## 결과

| 검사 | 결과 |
|---|---|
| clean `db reset --local --no-seed` | PASS, 두 migration 재적용 |
| IM-1B-1 RLS 회귀 | 17 PASS / 0 FAIL |
| IM-1B-2 ledger suite | 17 PASS / 0 FAIL |
| 기존 계약 manifest | 34 유지, 4 PASS / 30 PENDING |
| DB lint error level | PASS, schema error 0 |
| PowerShell parser | PASS, 4 scripts |
| unauthenticated Data API GET | 세 테이블 모두 HTTP 401 |
| catalog | tables 3, RLS/FORCE 3/3, policies 2, constraints 30, indexes 14 |
| authenticated client 직접 write grant | 세 테이블 모두 false |
| local medication 객체 | 0, 변경 없음 |

실행 SQL은 [`IM-1B-2-ledger-foundation.sql`](../../inventory-management/qa/tests/IM-1B-2-ledger-foundation.sql), runner는 [`Invoke-IM1B2Tests.ps1`](../../inventory-management/qa/scripts/Invoke-IM1B2Tests.ps1), 별도 결과 manifest는 [`IM-1B-2-contracts.json`](../../inventory-management/qa/contracts/IM-1B-2-contracts.json)이다.

17개 PASS는 이번 단계의 schema·제약·RLS·불변성·rollback 기반 테스트다. 기존 34개 중 완성된 업무 행동은 4개만 PASS이며 replay, typed conflict, FEFO, 동시 차감, 실제 balance/movement 원자성은 RPC 미구현으로 PENDING이다.
