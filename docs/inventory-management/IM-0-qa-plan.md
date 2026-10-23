# IM-0 자동 QA 계획과 테스트 계약

## 테스트 계층

- 순수 도메인: 단위 변환, 부족/기한, FEFO allocation.
- DB 통합: 실제 Postgres 제약/RLS/RPC/동시 트랜잭션.
- 계약: Inventory DTO ↔ Purchase Helper adapter.
- UI: 교사/강사 권한별 화면과 오류 상태.
- 마이그레이션: 합성 fixture와 대조 보고서.

## 필수 시나리오

### 데이터 정확성

- 입고 전후 lot/total/available/movement 합계 일치.
- 여러 로트를 기한 순으로 차감하고 각 allocation 기록.
- 만료·격리·폐기 로트 제외.
- 부족 판정 경계값, 포장↔기본단위 정수 변환과 허용 오차 정책.
- 정정/취소 후 원본 이력이 유지되고 합계가 역전 movement와 일치.

### 동시성·멱등성

- 교사/강사가 같은 품목의 마지막 재고를 동시 차감: 한 트랜잭션만 허용되거나 합계 범위 내 직렬화.
- 같은 requestId 동시/재전송: movement 한 건, 동일 결과 반환.
- 같은 requestId 다른 payload: conflict.
- commit 직후 응답 유실: 상태 조회로 성공 확인.

### 권한

- 강사의 테이블 직접 update, 입고/정정/멤버 API 호출 거부.
- 다른 school_id의 모든 조회/RPC 거부.
- 비활성 멤버, 만료 세션, 역할 변경 직후 거부.
- 감사행 수정/삭제 거부.

### Purchase Helper

- 후보 DTO 변환과 원본 itemId 보존.
- 품의/주문 완료만으로 stock 변화 0.
- 입고 확인 후에만 RECEIPT movement와 lot 생성.
- 중복 입고 request 차단, 부분입고 누계와 잔량.

### 마이그레이션

- 중복 품목, 누락 기한, 상충 권장재고, 잘못된 단위, Sheets/BOGUNON 수량 차이.
- 오류 시 전체 batch rollback 또는 명시적 격리.
- dry-run과 실제 run의 입력 해시·결과 대조.
- restore 후 동일 검증 쿼리 통과.

## 테스트 계약 예

`consume_inventory(school_id,item_id,quantity,request_id,reason)`은 성공 시 allocation 목록과 movement ID를 반환한다. 실패는 `INSUFFICIENT_STOCK`, `FORBIDDEN`, `INVALID_UNIT`, `IDEMPOTENCY_CONFLICT`처럼 안정된 코드로 반환한다. 클라이언트는 메시지 문자열을 분기 조건으로 사용하지 않는다.

실제 테스트 코드는 IM-1 승인 전 작성하지 않는다.

