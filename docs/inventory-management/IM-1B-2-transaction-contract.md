# IM-1B-2 공통 트랜잭션 계약

## 고정 처리 순서

1. `auth.uid()`와 활성 school·membership·role 검증
2. 서버 canonical payload와 hash 계산, idempotency 선점·검사
3. `(school_id,item_id)` item 행 `FOR UPDATE`
4. lot 후보를 안정된 FEFO 순서로 `FOR UPDATE`
5. 수량·상태·만료·격리 여부 검증
6. lot 잔량 변경
7. lot별 movement 생성
8. audit 생성
9. idempotency를 `COMPLETED`와 응답 payload로 갱신

FEFO는 `expires_on ASC NULLS LAST`, `received_at ASC`, `lot_id ASC`다. 모든 RPC가 item을 먼저 잠그고 lot을 같은 순서로 잠가 deadlock 위험을 낮춘다. 만료·격리·사용불가 lot는 선택 전에 제외한다.

## 원자성·재시도

lot 잔량, movement, audit, idempotency 완료는 한 PostgreSQL 트랜잭션의 commit 단위다. 합성 실패 subtransaction에서 lot 변경·movement·audit가 모두 사라지는 것을 `IM1B2-15`로 확인했다.

성공 commit 후 응답 유실 시 동일 UUID·동일 payload는 저장 결과를 반환하고 재고를 다시 변경하지 않는다. 동일 UUID·다른 payload는 `IDEMPOTENCY_CONFLICT`다. serialization/deadlock 재시도도 같은 UUID를 유지하고 횟수를 제한한다.

입고·사용·폐기·정정·취소 RPC, FEFO 실제 차감, 동시 차감, replay 응답은 아직 구현하지 않았다. 이번 migration에는 업무 RPC나 SECURITY DEFINER 업무 함수를 추가하지 않았다.
