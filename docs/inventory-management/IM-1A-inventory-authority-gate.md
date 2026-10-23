# IM-1A 운영 재고 권위 원본 게이트

## 판정

Google Sheets와 기존 BOGUNON DB 어느 쪽도 단독으로 신규 현재고의 권위 원본으로 확정할 수 없다. BOGUNON에는 사용 차감이 없고 만료 lot도 기존 currentStock에 포함되므로 DB lot 합계를 그대로 초기잔액으로 승격하지 않는다.

## 권고 절차

1. Sheets와 BOGUNON을 품목 ID/규격/lot/유효기간 기준으로 비교 참고한다.
2. 보건실 실물을 품목별·유효기간별로 확인한다.
3. 조사 기준시각, 확인자, 단위, 격리·만료 상태를 기록한다.
4. 비식별 대조 보고서는 품목 수, lot 수, 가용/만료/격리 수량의 집계와 예외 건수만 사용한다.
5. 확정 잔량은 기준일을 가진 `INITIAL_BALANCE` movement로 한 번만 반영한다.
6. 기존 receipt와 INITIAL_BALANCE의 중복 합산을 차단한다.
7. 전환 기준시각 이후 구형 쓰기를 중단하고 신규 원장만 권위로 사용한다.

## 중복 식별

기존 item ID가 있으면 우선 사용하되 신규 독립 UUID와 mapping한다. ID가 없으면 정규화 품명만으로 자동 병합하지 않고 규격, 기본단위, 제조/포장 차이, expiry lot를 함께 검토한다. 동일 purchase/receipt source, 날짜, 수량, idempotency key 또는 승인된 외부 문서 번호가 겹치면 중복 후보로 격리한다.

실제 수량 수집, 표본 조회, 데이터 이전은 수행하지 않았다. 운영 재고 권위 확정은 `DECISION REQUIRED`다.

