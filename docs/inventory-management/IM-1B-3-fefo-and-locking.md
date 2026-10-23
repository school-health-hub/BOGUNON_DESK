# IM-1B-3 FEFO 및 잠금

## 가용 lot

다음 조건을 모두 만족하는 lot만 차감한다.

- 요청 school과 item 일치
- `status='available'`
- `remaining_quantity > 0`
- `expires_on`이 없거나 `Asia/Seoul` 업무일 이상

만료일 당일은 사용 가능하고 다음 날부터 제외한다. 유효기간 없는 available lot은 허용하되 `NULLS LAST`로 날짜가 있는 정상 lot보다 뒤에 배치한다. 격리·사용불가·고갈 lot은 제외한다.

## FEFO 순서

1. `expires_on ASC NULLS LAST`
2. `received_at ASC`
3. `lot_id ASC`

합성 테스트에서 만료일 당일 lot 3개를 먼저 전량 차감하고 미래 lot에서 2개를 차감했으며, movement 2개가 생성됐다. 만료·격리·사용불가·고갈 lot과 뒤순위 무기한 lot은 변경되지 않았다.

## 잠금

멱등 요청을 선점한 뒤 item을 `FOR UPDATE`하고, 가용 lot 전체를 FEFO 순서로 `FOR UPDATE`한다. 가용량 검증 후 이미 잠긴 동일 순서로 차감한다. `SKIP LOCKED`는 실제 재고가 있는데 부족으로 오판할 수 있어 사용하지 않았다.

동일 item은 item lock에서 직렬화되고 서로 다른 item은 전역 잠금을 공유하지 않는다. 향후 모든 재고 변경 RPC도 동일한 item-first, ordered-lot 규칙을 따라야 한다.
