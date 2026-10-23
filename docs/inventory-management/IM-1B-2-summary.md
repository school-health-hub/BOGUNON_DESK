# IM-1B-2 요약

## 완료

격리된 로컬 QA에 불변 stock movement 원장, 불변 audit 원장, 서버 전용 idempotency request 기반을 구현했다. 학교·item·lot 관계는 복합 FK로 고정했고 RLS/FORCE RLS와 최소 GRANT를 함께 적용했다.

clean DB 재현 후 기존 학교 격리 17개와 신규 ledger 기반 17개가 모두 통과했다. 기존 34개 계약 ID와 상태는 유지했고 이번 단계 보조 테스트는 별도 manifest로 관리한다.

## 판정

`READY` — IM-1B-2의 원장·감사·멱등 저장 기반과 필수 schema/RLS/rollback QA가 통과했다.

이 판정은 업무 RPC, 운영 적용, 실제 데이터 이전 승인이 아니다. IM-1B-3은 사용자 승인 후에만 시작한다.

## IM-1B-3 권장 범위

1. 공통 idempotency 선점·replay·conflict 처리
2. 사용 RPC로 item-first/FEFO-lot 잠금과 복수 lot movement 구현
3. 입고·폐기·정정·reversal RPC 순차 추가
4. 동시 요청, 응답 유실 replay, deadlock/serialization 제한 재시도 검증
5. 실제 Auth JWT/Data API E2E 추가

운영 Supabase metadata, backup/PITR, 실제 재고 권위 원본은 계속 별도 배포·이전 게이트다.
