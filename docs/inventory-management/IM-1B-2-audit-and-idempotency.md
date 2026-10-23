# IM-1B-2 감사·멱등 계약

## 감사 기록

수량의 권위 이력은 movement이고, 누가 어떤 업무·보안 행위를 수행했는지는 audit다. 한 업무에서 둘 다 필요하면 lot 잔량, movement, audit, idempotency 완료를 같은 트랜잭션에서 확정한다. 토큰·키·세션·원문 개인정보는 `details`에 저장하지 않는다.

teacher_admin은 활성 membership 학교의 audit만 읽는다. instructor, 비소속, 비활성, 다른 학교 사용자는 읽지 못한다. 어떤 클라이언트 역할도 audit를 직접 생성·수정·삭제하지 않는다.

## 멱등 처리

1. 서버가 `auth.uid()`와 활성 membership으로 actor와 school을 결정한다.
2. 서버가 업무별 canonical payload를 만들고 SHA-256을 계산한다. 클라이언트 hash는 권위가 아니다.
3. `(school, actor, operation, request_uuid)` unique key로 최초 요청을 선점한다.
4. 같은 hash의 `COMPLETED` 요청은 저장 응답을 반환한다.
5. 다른 hash면 `IDEMPOTENCY_CONFLICT`를 반환한다.
6. 어느 단계든 실패하면 idempotency 행을 포함한 전체 트랜잭션을 rollback한다.

이번 단계는 저장 구조와 중복 검출 제약까지만 구현했다. 동일 payload replay와 typed conflict 반환은 IM-1B-3 업무 RPC 범위이므로 기존 `INV-C04`, `INV-C05`, `INV-C06`은 PENDING IMPLEMENTATION이다.

RPC가 단일 DB 트랜잭션 안에서 선점·업무·완료를 처리하면 실패한 요청의 `PROCESSING` 행도 함께 rollback된다. 트랜잭션 외부 선점과 고아 행 회수는 현재 계약에 포함하지 않는다.
