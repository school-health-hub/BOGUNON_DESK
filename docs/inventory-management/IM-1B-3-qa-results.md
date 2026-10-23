# IM-1B-3 QA 결과

## 결과

| suite | 결과 |
|---|---|
| clean migration 3개 재현 | PASS |
| IM-1B-1 RLS 회귀 | 17/17 PASS |
| IM-1B-2 ledger 회귀 | 17/17 PASS |
| IM-1B-3 순차 RPC | 20/20 PASS |
| IM-1B-3 독립 세션 동시성 | 4/4 PASS |
| 실제 local Auth/JWT HTTP RPC | PASS |
| deadlock 증가 | 0 |
| DB lint | schema error 0 |
| DB security advisor | issue 0 |
| PowerShell parser | PASS |
| 최종 합성 데이터 정리 | schools 0, synthetic Auth 0 |
| Inventory QA stack 중지 | PASS, 전용 volume 보존 |

실행 파일:

- [`IM-1B-3-use-rpc.sql`](../../inventory-management/qa/tests/IM-1B-3-use-rpc.sql)
- [`IM-1B-3-concurrency-setup.sql`](../../inventory-management/qa/tests/IM-1B-3-concurrency-setup.sql)
- [`IM-1B-3-concurrency-verify.sql`](../../inventory-management/qa/tests/IM-1B-3-concurrency-verify.sql)
- [`Invoke-IM1B3Tests.ps1`](../../inventory-management/qa/scripts/Invoke-IM1B3Tests.ps1)
- [`Invoke-IM1B3HttpE2E.ps1`](../../inventory-management/qa/scripts/Invoke-IM1B3HttpE2E.ps1)

동시성 테스트는 별도 PostgreSQL 세션 두 개를 실제 병렬 실행했다. 교사/강사 6+6 against 10, 두 강사 6+6 against 10, 마지막 1개 경쟁은 각각 한 건만 성공했다. 동일 actor·UUID 동시 요청은 한 차감과 한 replay만 생성했다.

기존 34개 계약은 ID를 유지하며 18 PASS / 16 PENDING IMPLEMENTATION이다. receipt, unit conversion, adjustment/reversal, serialization retry injection, Purchase Helper, migration 계약은 PENDING을 유지한다.
