# IM-1B-3 물품 사용 RPC

## 구현

Migration [`20261023040118_inventory_use_stock_rpc.sql`](../../inventory-management/qa/supabase/migrations/20261023040118_inventory_use_stock_rpc.sql)에 다음 함수를 구현했다.

```sql
public.inventory_use_stock(
  p_school_id uuid,
  p_item_id uuid,
  p_quantity bigint,
  p_request_uuid uuid,
  p_reason text
) returns jsonb
```

함수는 `SECURITY DEFINER`, 고정 `search_path=''`이며 `authenticated`만 EXECUTE할 수 있다. PUBLIC과 anon 권한은 명시적으로 회수했다. actor는 인자로 받지 않고 `auth.uid()`에서 결정한다.

## 처리 순서

1. 인증·양수 정수·request UUID·사유 검증
2. 활성 school과 teacher_admin/instructor membership 확인
3. server-side canonical payload SHA-256 계산과 멱등 선점
4. school/item 조건으로 item 행 잠금 및 활성 여부 확인
5. FEFO 후보 lot을 고정 순서로 잠금
6. 총 가용량 검증 후 lot별 차감
7. lot별 `USE` movement와 단일 `STOCK_USED` audit 생성
8. 멱등 응답을 `COMPLETED`로 저장하고 같은 JSON 반환

사유는 trim 후 1~500자의 printable text만 허용한다. 학생 이름·증상·진료정보 같은 개인정보를 받는 별도 필드는 없다.

## 반환

요청 UUID, operation, item ID, 요청·차감 수량, 차감 후 가용재고, lot별 전후 잔량과 movement ID, 전체 movement ID 배열, 서버 처리 시각, replay 여부를 JSON으로 반환한다.

## 오류

| SQLSTATE | 업무 코드 | 의미 |
|---|---|---|
| `PT401` | `UNAUTHENTICATED` | 유효한 actor 없음 |
| `PT403` | `PERMISSION_DENIED` | 활성 membership 없음 |
| `PT404` | `ITEM_NOT_FOUND` | 요청 학교에서 품목 사용 불가 |
| `PT409` | `INSUFFICIENT_STOCK` | 가용재고 부족 |
| `PT409` | `IDEMPOTENCY_CONFLICT` | 동일 UUID의 payload 불일치 |
| `PT409` | `RETRYABLE_CONFLICT` | 비정상적으로 남은 미완료 요청 |
| `PT422` | `INVALID_QUANTITY`, `INVALID_REQUEST_UUID`, `INVALID_REASON`, `ITEM_INACTIVE` | 입력·상태 오류 |

타학교 요청은 객체 존재 여부를 드러내지 않도록 membership 단계에서 `PERMISSION_DENIED`로 통일했다.
