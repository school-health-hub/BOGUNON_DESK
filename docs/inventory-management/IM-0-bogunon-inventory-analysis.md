# IM-0 기존 BOGUNON 물품관리 분석

## 조사 기준

- 실제 저장소: `<BOGUNON_WEB_ROOT>`
- 구현 브랜치: `codex/medication-lot-management`
- 근거 SHA: `1191f3b683e3d0be819ed864cfb28b24513ce919`
- 기본 checkout은 사용자 변경이 있어 건드리지 않고 Git 객체를 읽었다.

## 실제 구현

| 기능 | 상태 | 근거 파일/함수 |
|---|---|---|
| 물품 목록·검색·상태 필터 | 구현 | `components/medications/medication-management.tsx`, `InventoryTab` |
| 품목 등록·수정 | 구현 | `ItemForm`, `saveMedicationItemAction`, `saveMedicationItem` |
| 품목 삭제 | 물리 삭제 대신 보관(active=false) | `archiveMedicationItemAction` |
| 로트·유효기간 | 구현 | `MedicationLot`, `LotManagementPanel`, `medicationLotStatus` |
| 부족/만료 상태 | 구현 | `deriveInventoryItem`, 90일 기준 및 권장재고 비교 |
| 구매계획·예산 | 구현 | `MedicationPurchasePlan`, `PurchaseTab`, `MedicationBudget` |
| 입고 | 구현, RPC 멱등성 포함 | `receive_medication`, `(user_id,idempotency_key)` unique |
| 부분입고 | 구현 | 입고 누계로 `partially_received`/`received` 갱신 |
| Excel 가져오기 | `.xlsx`만 구현 | `MedicationImportPanel`, `parseMedicationWorksheet` |
| 폐기 | 로트 `disposed_at` 표시 | `disposeMedicationLot` |
| 사용 차감 | 미구현 | 사용 RPC/이동원장/FEFO 차감 없음 |
| 재고 정정·취소 원장 | 미구현 | 로트 수량은 입고값이며 변경 이력 테이블 없음 |
| 실시간 동기화 | 미구현 | 일반 select/revalidate 구조, realtime subscription 없음 |

## 저장소·인증·권한

Firestore가 아니라 Supabase Postgres가 실제 저장소다. 테이블은 `medication_items`, `medication_lots`, `medication_purchase_plans`, `medication_receipts`, `medication_budgets`다. Supabase Auth의 `auth.uid()`와 RLS로 사용자 본인 데이터만 허용한다.

현재 모델은 `user_id` 소유권이다. 학교 ID, 교사/강사 역할, 공유 재고 구성원 모델이 없어 여러 사용자가 같은 학교 재고를 공유할 수 없다. 모든 authenticated 소유자는 자신의 행에 대해 select/insert/update/delete를 할 수 있으므로 신규 역할 모델에 그대로 사용할 수 없다.

## 정합성 문제

- `medication_lots.quantity`는 입고/초기 수량이면서 현재 수량으로 사용된다. 사용 차감 이력이 없다.
- 폐기는 `disposed_at`만 기록하며 폐기 수량·사유·행위자 감사 이벤트가 없다.
- Excel import는 행별 insert여서 전체 파일 단위 원자성이 없다.
- 중복 판정은 품목+유효기간+수량+단가 0 조합 중심이며 강한 원본 식별자가 없다.
- 현재고는 사용 가능한 로트 수량 합계로 계산하지만 만료 로트도 `disposed_at`이 없으면 합계에 포함된다. 신규 모델에서는 총재고와 가용재고를 분리해야 한다.

## 재사용 권고

재사용: 입력 검증 방식, 로트·구매계획·입고 분리, 입고 멱등키, 부분입고 상태, import preview UX.

수정 필요: user 소유권을 school membership 기반으로 교체, 로트 잔량/원장 도입, 서버 트랜잭션 차감, 감사·정정·취소, 실시간/동시성 정책.

