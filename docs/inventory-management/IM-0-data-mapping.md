# IM-0 데이터 매핑

| 원본 Google Sheets | 현재 BOGUNON | 신규 권장 필드/처리 | 분류 |
|---|---|---|---|
| 분류 | `medication_items.category` | `items.category_code` | 일부 수정 |
| 품명 | `medication_items.name` | `items.name`, 학교 내 정규화 키 별도 | 재사용 |
| 규격/단위 | `specification`, `unit` | `specification`, `base_unit`, `package_unit`, `units_per_package` | 확장 필요 |
| 현재고 | 로트 `quantity` 합 | 서버가 유지하는 lot `remaining_quantity` 합 | 변경 필요 |
| 권장재고 | `recommended_stock` | `target_stock` | 재사용 |
| 최소재고 없음 | 없음 | `minimum_stock` | 신규 |
| 유통기한 | `medication_lots.expiration_date` | `stock_lots.expires_on` | 재사용 |
| 잔여일수 | 클라이언트 계산 | 조회 기준일에서 계산 | 재사용 |
| 안전상태 | 90일 규칙 | 정책 테이블/학교 설정 기반 파생 | 일부 수정 |
| 재고상태 | 현재고<권장재고 | 가용재고<최소/권장 기준 | 일부 수정 |
| 구매선택 | 구매계획 행 | `purchase_candidates` 또는 `purchase_links` | 구조 변경 |
| 구매수량 | plan quantity | 기본단위 `requested_quantity` | 재사용 |
| 예상단가 | expected unit price | 단가+가격단위 명시 | 일부 수정 |
| 입고기록 | receipts + lots | receipt confirmation + movement + lot | 확장 필요 |
| 반영완료 | RPC 멱등키 | 서버 idempotency key + unique constraint | 대체 |
| 품명 괄호 번호 로트 | 별도 lot 엔터티 | 안정적 itemId/lotId | 개선 |
| ID 없음 | UUID 존재 | UUID/ULID + source legacy key | 신규/재사용 |
| 사용이력 없음 | 없음 | `stock_movements` USE + allocation rows | 신규 |
| 폐기 체크 없음 | `disposed_at` | DISPOSE movement + reason + audit | 확장 |
| 예산 대시보드 | budget/receipt 금액 | Purchase Helper와 역할 분리, 필요 시 읽기 모델 | 중복 검토 |

## 구현 중복 방지

- BOGUNON의 로트·입고·부분입고·import preview는 재사용 후보이다.
- Purchase Helper의 파일 분석, 편집, 검산, 품의/에듀파인 출력은 중복 개발하지 않는다.
- Inventory는 재고 권위, 로트, 이동원장, 권한, 실제 입고 확정만 소유한다.

