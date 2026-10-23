# IM-1A 단위·유효기간 정책

## 확인된 기존 구조

- 기존 품목은 `unit text`와 `specification text`뿐이며 기본/구매/포장 단위가 분리되지 않는다.
- 모든 재고·구매·입고 수량은 `integer`다.
- 가격은 bigint, 강사 근무량 등 다른 도메인만 numeric을 사용한다.
- lot expiry는 `date`; 기존 현재고 합계는 만료 lot도 포함한다.
- “만료 < 0일, 임박 0~90일, 정상 >90일” 계산은 코드로 확인됐다.

## 계약 제안

- item: `base_unit`, `allow_fractional`, `quantity_scale`
- 구매 라인: `purchase_unit`, `units_per_purchase_unit`(정확한 양의 값)
- lot/movement 수량은 기본단위로 정규화한다.
- 묵시적 반올림 금지. scale 밖 값은 거부한다.
- 분수 필요 여부를 실제 품목 분류별로 승인하기 전 기본은 정수다.
- 포장규격 변경은 변환비를 소급 수정하지 않고 새 conversion version 또는 새 item으로 관리한다.
- 모호한 기존 규격은 자동 변환하지 않고 migration exception queue로 보낸다.

## 유효기간

- 알림: 만료 `< 기준일`, 임박 `0..90`, 정상 `>90` 잠정 유지
- 사용 가능: expiry가 없는 허용 품목 또는 `expiration_date >= 학교 현지 기준일`; expired/quarantined/unavailable 제외
- expiry 없음은 NULL로 유지하며 임의 날짜를 만들지 않는다.
- 알림 임계값과 사용 가능 판정은 별도 정책이다.

단위 scale, 분수 품목, 유효기간 당일 사용 여부, expiry 필수 품목 범주는 IM-1B 전 사용자 승인 항목이다.

