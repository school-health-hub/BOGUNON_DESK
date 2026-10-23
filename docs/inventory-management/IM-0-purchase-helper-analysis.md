# IM-0 Purchase Helper 분석

## 기준

- worktree: `<PURCHASE_WORKTREE_ROOT>`
- branch: `feature/purchase-helper-enhancement`
- HEAD: `888917b8b35b679ac7e406a0b89c9b0425282ce9`
- 상태: clean, upstream 대비 0/0. 수정하지 않았다.

## 데이터 계약

`src/purchase/types.ts`의 `PurchaseItem`은 품명, 규격, 수량, 단가, 원본 금액, 구매처, 비고, 예산항목, 출처, 선택 여부, 오류/불일치 검토 상태를 가진다. 공급가액·부가세는 품목 기본 DTO에 분리 저장되지 않는다. 구매결과에는 planned/actual 수량·단가·금액과 배송비, 할인, tax adjustment가 있다.

`PurchaseDraft`는 품의 제목, 구매 목적, 요약, 구매처, 예산항목, 비고, 첨부 문구와 템플릿 순서를 가진다.

## 파일 지원

| 형식 | 실제 상태 | 제한 |
|---|---|---|
| XLSX | 지원 | ZIP/확장 크기·행열·셀 수 사전 제한, 여러 시트 중 최적 표 선택 |
| XLS | 지원 | BIFF/OLE 구조와 범위 사전 검사 후 파싱 |
| CSV | 지원 | UTF-8 BOM 및 CP949 테스트, CSV formula injection 완화 |
| 텍스트 PDF | 지원 | 최대 페이지/텍스트 크기 제한, 표 머리글·반복 헤더 처리 |
| 이미지 PDF | 미지원 | 텍스트가 없으면 unsupported |
| PNG/JPG/JPEG | 선택 가능하지만 OCR 미지원 | 즉시 unsupported 안내 |

## 기능 상태

- 견적 분석, 미인식 열 수동 매핑, 매핑 템플릿 저장: 구현.
- 품목 추가/선택/수량·단가 편집: 구현.
- 수량×단가와 원본 금액 검산, 불일치 확인 게이트: 구현.
- 품의문 초안·템플릿·미리보기·복사: 구현.
- TSV/HTML 표 클립보드 복사: 구현.
- CSV/XLSX 및 에듀파인용 XLSX 출력: 구현.
- 구매결과 정산과 XLSX 출력: 구현.
- 작업 품목/품의/정산 저장·복원: 미구현. 세션 메모리에만 유지.
- localStorage에는 출력 열, import 매핑 템플릿, 품의문 템플릿 같은 설정만 저장.
- 클라우드 업로드: 없음.

## 통합 경계 제안

Purchase Helper 내부 파일 파서를 재고 DB에 직접 연결하지 않는다.

1. Inventory가 `PurchaseCandidateDTO`를 생성한다: `candidateId`, `schoolId`, `itemId`, 표시 품명/규격/단위, 요청 기본단위 수량, 예상단가, 생성 시점.
2. 어댑터가 이를 기존 `PurchaseItem`으로 변환한다. Purchase Helper는 견적 분석·품의·정산에만 집중한다.
3. 완료 시 `PurchaseDecisionDTO`를 반환한다: 구매건 ID, 품목 매핑, 승인/주문 수량, 예상/실제 단가, 상태, 원본 후보 ID.
4. 재고 측에는 `purchase_links`가 `planned/ordered/partially_received/received/cancelled`를 보존한다.
5. Purchase Helper의 품의/정산 상태 변경은 재고를 변경하지 않는다.
6. 보건교사가 실제 도착 물품의 수량·유효기간·로트를 확인하고 `ConfirmReceipt`를 실행할 때만 입고 movement와 lot 잔량을 한 트랜잭션으로 생성한다.

