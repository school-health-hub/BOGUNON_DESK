# IM-1B-6A 회귀 결과

2026-11-02 clean reset된 합성 `inventory_qa`에서 실행했다.

| 검증 | 결과 |
|---|---|
| IM-1B-1 RLS | 17/17 PASS |
| IM-1B-2 ledger | 17/17 PASS |
| IM-1B-3 use/동시성 | 24/24 PASS, deadlock 0 |
| IM-1B-4 admin RPC | 20/20 PASS |
| 기존 DB 회귀 합계 | 78/78 PASS |
| IM-1B-5 구매 SQL | 15/15 PASS |
| IM-1B-5 JWT HTTP | PASS |
| IM-1B-5 부분입고 동시성 | PASS: 성공 1, 초과입고 거부 1, 누적 6, receipt line 1, deadlock 0 |
| Purchase Helper Adapter | 21/21 PASS |
| TypeScript typecheck | PASS |
| DB lint | 오류 0 |
| PowerShell parser | 오류 0 |
| canonical manifest | 34개 유지, 27 PASS / 7 PENDING_IMPLEMENTATION |

## 보안 검사

- Inventory 공개 테이블 RLS 미활성: 0
- FORCE RLS 미활성: 0
- anon/authenticated/PUBLIC 직접 INSERT·UPDATE·DELETE 등 DML grant: 0
- PUBLIC/anon Inventory RPC EXECUTE: 0
- SECURITY DEFINER Inventory 함수 13개는 모두 고정 `search_path=""`를 사용한다.
- 공식 로컬 Security Advisor용 `supabase_linter` schema는 이 최소 스택에 없어 실행 불가했다. 위 카탈로그 검사는 대체 검증이며 Dashboard Security Advisor와 동일한 전체 규칙 집합이라고 주장하지 않는다.

실제 학교 데이터, 운영 Auth 사용자, 운영 DB dump는 사용하지 않았다.
