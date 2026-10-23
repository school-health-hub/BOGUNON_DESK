# IM-1B-3 멱등성

## 범위와 canonical payload

식별 범위는 `(school_id, actor_user_id, operation='USE', request_uuid)`다. canonical payload는 다음 의미 필드를 JSONB로 구성한다.

- operation
- school ID
- item ID
- 정수 기본단위 quantity
- 양끝 공백을 제거한 reason

PostgreSQL JSONB의 정규화된 text 표현을 UTF-8로 변환하고 `pgcrypto` SHA-256을 계산한다. 클라이언트 hash는 받거나 신뢰하지 않는다.

## 동작

- 최초 요청은 unique constraint로 `PROCESSING`을 선점한다.
- 동일 UUID·동일 hash의 완료 요청은 저장 응답에 `replayed=true`를 붙여 반환한다.
- 동일 UUID·다른 hash는 HTTP 409 `IDEMPOTENCY_CONFLICT`다.
- 동시 동일 UUID는 unique conflict 확인 과정에서 선행 트랜잭션을 기다린 뒤 한 건만 차감하고 다른 호출은 replay한다.

선점, lot 변경, movement, audit, `COMPLETED` 전환은 한 트랜잭션이므로 정상 실패에서는 외부에 독립 커밋된 `PROCESSING`이 남지 않는다. 운영자가 수동으로 만든 비정상 미완료 행처럼 별도 커밋된 PROCESSING을 만난 경우에는 `RETRYABLE_CONFLICT`로 중단한다.

serialization/deadlock은 DB 오류를 새 UUID로 자동 재제출하지 않는다. 클라이언트·API 계층의 동일 UUID 제한 재시도 횟수는 IM-1B-4 전 계약 항목으로 남긴다.
