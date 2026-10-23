# IM-1B-1 스키마 구현

## 구현 범위

Migration: `inventory-management/qa/supabase/migrations/20261023024023_inventory_tenancy_foundation.sql`

공식 Supabase CLI 2.121.0의 `supabase migration new inventory_tenancy_foundation`으로 파일을 생성했다. 적용과 재현 검증은 `--local`을 명시한 `migration up` 및 `db reset --local --no-seed`로만 수행했다.

## 테이블

| 테이블 | PK | 주요 FK·제약 |
|---|---|---|
| `inventory_schools` | `school_id` UUID | 표시명 공백 금지, 활성 상태 |
| `inventory_members` | `(school_id,user_id)` | school, `auth.users`; role=`teacher_admin|instructor` |
| `inventory_items` | `item_id` UUID | school FK, `(school_id,item_id)` UNIQUE, 단위/변환비/재고 기준값 CHECK |
| `inventory_stock_lots` | `lot_id` UUID | school FK, `(school_id,item_id)` 복합 FK, `(school_id,lot_id)` UNIQUE, 수량·상태 CHECK |

`(school_id,item_id)` 복합 FK는 다른 학교 item을 lot에 연결하지 못하게 한다. `(school_id,lot_id)`는 후속 movement·audit 테이블이 tenant-safe FK로 참조할 수 있는 후보 키다.

수량은 정수 최소 사용 단위를 위해 `bigint`, 포장 변환비는 정확 계산을 위해 `numeric(18,6)`, 일시는 `timestamptz`, 유효기간은 `date`를 사용한다.

## 인덱스

- `inventory_members_user_active_idx`: 활성 membership 확인
- `inventory_items_school_active_idx`: 학교별 활성 품목 검색
- `inventory_stock_lots_school_item_fefo_idx`: 사용 가능한 lot의 향후 FEFO 조회

## 갱신 시각

`inventory_private.inventory_set_updated_at()` trigger가 네 테이블의 `updated_at`을 서버 시각으로 갱신한다. 이 함수는 `security invoker`, 빈 `search_path`, 외부 EXECUTE 회수 상태다. 전용 schema를 사용하므로 기존 기능의 일반 `private` schema 권한을 변경하지 않는다.

## 제외 범위

기존 `medication_*` 객체 참조·변경은 없다. movement, audit, idempotency, purchase link 및 재고 변경 RPC도 생성하지 않았다.

