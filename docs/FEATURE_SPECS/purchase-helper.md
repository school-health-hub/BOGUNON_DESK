# Purchase Helper

## 목적

견적·품목 데이터를 분석하고 구매 품의문, 정산 자료, 내보내기 결과를 생성한다.

## 확정 요구사항

- 견적 및 품목 데이터 분석
- 구매 품의문 작성
- 정산 및 내보내기
- 구매 후보·입고 결과를 Inventory Management와 연결

## 현재 구현 범위

`origin/main@97f9ee9`에 purchase domain, repository, import/output settings, UI와 Rust helper가 존재한다. `feature/purchase-helper-enhancement@888917b`는 11개 파일의 추가 변경을 가진 WIP checkpoint다.

구현 상태: `IMPLEMENTED`, enhancement는 미통합.

## QA 상태

`NOT VERIFIED`. main의 단위 테스트 존재는 확인했으나 enhancement HEAD에 대한 독립 QA 완료 문서와 실기기 결과는 확인되지 않았다.

## 아직 구현·확정하지 않은 범위

- enhancement의 완료 및 QA
- Inventory 구매 후보·입고·재고 갱신 계약의 구현
- Workspace Library 결과물 형식

## 근거 및 연결 관계

- main: `src/purchase/**`, `src/components/desktop/PurchaseHelperPanel.tsx`, `src-tauri/src/purchase_helper.rs`, `purchase_settlement.rs`
- branch: `feature/purchase-helper-enhancement@888917b`
- Inventory는 공유 재고의 권위 원장이고 Purchase Helper는 구매 준비·입고 후보의 생산자다.

## 위험 및 다음 작업

WIP를 완료로 오인하지 않는다. Inventory의 확정 schema/RPC 뒤에 idempotent 입고 계약과 실패·재시도 규칙을 설계한다.
