# IM-1B-1 요약

## 완료

학교, membership, 품목, lot의 독립 신규 schema와 tenant-safe FK, 최소 GRANT, RLS를 로컬 QA에 구현했다. 기존 개인형 medication 구조는 변경하지 않았다.

로컬 DB clean reset 후 migration을 재적용했고 17개 PostgreSQL/RLS 테스트가 모두 통과했다. 기존 34개 계약 중 이번 단계에서 완전히 검증된 4개만 PASS로 전환했으며 30개는 PENDING IMPLEMENTATION을 유지했다.

## 판정

`READY` — IM-1B-1의 로컬 schema·RLS 구현과 필수 학교 격리 QA가 통과했다.

이는 운영 적용, 실제 데이터 이전 또는 IM-1B-2 자동 착수 승인이 아니다.

## IM-1B-2 선행 조건과 범위

1. movement, audit, idempotency request 테이블 추가
2. `(school_id,item_id)` 및 `(school_id,lot_id)` 복합 FK 재사용
3. immutable movement/audit 직접 DML 차단
4. 입고·사용·폐기·정정·취소 RPC별 역할 계약 확정
5. request UUID와 payload hash 충돌 처리
6. item lock 후 FEFO lot lock 순서와 동시성 테스트

운영 프로젝트 metadata, backup/PITR 및 실제 재고 권위 원본은 별도 게이트로 남는다.

