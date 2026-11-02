# IM-1B-6 Purchase Helper Adapter 계약

## 범위

이 단계는 Inventory 구매 batch를 기존 Purchase Helper가 받는 `PurchaseItem` 모양으로 투영하고, 편집된 행을 서버 변경 후보로 다시 분류하는 순수 TypeScript Adapter를 제공한다. Purchase Helper 제품 코드, UI, Supabase RPC 및 재고 원장은 변경하지 않는다.

## 실제 Purchase Helper 지원 범위

- 품목 DTO: `id`, `selected`, `name`, `specification`, `quantity`, `unitPrice`, `importedAmount`, `vendor`, `note`, `budgetItem`, `sourceName`, `issues`, `amountMismatchReviewed`
- 가져오기: XLSX, XLS, CSV, 텍스트 PDF 및 이미지 선택 경로. Adapter는 parser를 직접 호출하지 않고 DTO 경계만 사용한다.
- 출력: XLSX/CSV, 클립보드, 품의 자료와 에듀파인 4열(내용·규격·수량·예상단가)
- 편집: 행 ID를 유지한 수정·재정렬, 삭제, 신규 임시 행 추가
- 세션: 품목 배열과 임시 ID는 메모리 전용이다. 설정 template 외 구매 편집 session 저장·복원은 구현되지 않았다.

## 권위 정보와 Sidecar

`createPurchaseHelperSession`은 Helper 행에는 표시·금액 계산 필드만 전달한다. 다음 정보는 `PurchaseHelperLineage`에 유지한다.

- `schoolId`, `batchId`, `lineId`, `itemId`, `candidateId`
- 기본 단위·구매 단위·포장 변환비
- 원래 구매 수량, 기본 단위 요청 수량, 예상 단가
- 원래 품명과 규격

Helper의 `id`는 편집 session용 opaque 행 ID다. 품명·규격 또는 Helper 행 ID만으로 Inventory 품목을 다시 찾지 않는다.

## 수량·단가 정책

- 서버 decimal string을 BigInt 유리수로 해석한다.
- `구매 수량 × 변환비`가 양의 정수 기본단위가 아니면 거부한다.
- Helper number로 손실 없이 표현할 수 없는 수량을 거부한다.
- KRW 예상 단가는 0 이상의 안전한 정수만 허용한다.
- Helper의 금액은 `수량 × 단가` 검산용이며 재고 수량의 권위 근거가 아니다.
- `=`, `+`, `-`, `@`, TAB, CR로 시작하거나 제어문자를 포함한 텍스트는 자동 연결하지 않는다.

## 편집 결과 반환

`reconcilePurchaseHelperSession`은 서버를 변경하지 않고 다음 결과만 만든다.

- `matched`: sidecar ID로 동일 line/item 확인
- `changed`: 수량·단가·품명·규격 변경 후보
- `missing`: 삭제 또는 `selected=false`
- `added`: sidecar에 없는 신규 행
- `issues`: 중복 행 ID, 타학교, 모호한 수량·품목 변경, 위험 텍스트

행 순서 변경은 허용하지만 신규 행, 삭제, 중복/분할/병합 및 identity 변경은 검토가 필요하다. 서버 batch 자동 덮어쓰기 DTO와 lot/movement/receipt 명령은 제공하지 않는다.

## 세션 복구 계약

- 서버에 저장된 구매 batch: 재투영 가능
- 저장하지 않은 Helper 편집: 자동 복구 불가
- 다운로드 파일: 외부 파일로만 존재
- 확정 입고: 기존 서버 원장에 기록

Purchase Helper 실제 UI wiring과 영속 session 저장은 후속 단계다.
