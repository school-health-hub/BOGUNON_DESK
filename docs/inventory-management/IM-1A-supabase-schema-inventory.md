# IM-1A 기존 Supabase 스키마 인벤토리

## 코드로 확인된 `public` 테이블

| 테이블 | 핵심 컬럼/제약 | 저장 의미 |
|---|---|---|
| `medication_items` | UUID PK, `user_id` FK, category check, 정수 권장재고, `(user_id,name,specification,unit)` UNIQUE | 사용자별 품목 |
| `medication_lots` | UUID PK, owner/item/receipt 복합 FK, `quantity integer > 0`, expiry/received date, `disposed_at` | 입고 로트이자 잔량처럼 사용 |
| `medication_purchase_plans` | item 복합 FK, `quantity integer > 0`, 가격 bigint, 상태 check | 한 계획당 한 품목 |
| `medication_receipts` | item/plan 복합 FK, 입고수량·가격·날짜, `(user_id,idempotency_key)` UNIQUE | 입고 확인 |
| `medication_budgets` | 연도, 금액 bigint, `(user_id,budget_year)` UNIQUE | 연간 예산 |

구매계획 상세 별도 테이블, 학교, 재고 movement, 감사 원장, 사용 차감 테이블은 없다.

## 인덱스·트리거

- items: `(user_id, active, name)`
- lots: `(user_id, item_id, expiration_date, received_at)` 및 미폐기 partial index
- plans: `(user_id, status, created_at desc)`
- receipts: `(user_id, received_at desc)`
- items/budgets/plans에 `set_updated_at` trigger
- 외래키 검색을 위한 일부 복합 인덱스는 쿼리 계획으로 재검증해야 한다.

## 현재고 구조

- 총재고 컬럼은 없다.
- 클라이언트가 미폐기 `medication_lots.quantity`를 합산한다.
- lot 수량은 입고 시 한 번 기록되고 사용 차감 경로가 없어 실질적으로 “입고 원수량”과 “현재 잔량”이 섞여 있다.
- `disposeMedicationLot`은 `disposed_at` 직접 UPDATE, lot 편집도 직접 UPDATE다.
- 만료 lot은 `currentStock` 합산에서 제외되지 않는다. 만료는 상태 표시만 바꾼다.
- 초기수량 import/품목 등록은 lot 직접 INSERT이며 원장과 단일 트랜잭션 계약이 없다.

## 입고 RPC

`public.receive_medication`은 `SECURITY DEFINER`, `SET search_path=''`, `auth.uid()`·소유권 검증, 구매계획 행 `FOR UPDATE`, receipt와 lot 생성 및 plan 상태 갱신을 한 함수 호출에 묶는다. 부분입고 상태는 누적 receipt 합계로 판정한다.

확인 한계: 연결된 Supabase 계정에서 코드의 프로젝트 ref를 찾지 못해 실제 운영 스키마, 정책, 함수 소유자와 migration 적용 여부는 검증하지 못했다.

