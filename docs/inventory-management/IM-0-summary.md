# BOGUNON DESK Inventory Management IM-0 요약

## 결과

독립 worktree를 원격 `main`의 검증된 SHA에서 생성했고, 기존 BOGUNON·Purchase Helper·원본 xlsx를 읽기 전용으로 조사했다. 제품 코드는 수정하지 않았다.

## 핵심 결론

- 원본 xlsx는 재고/구매/품의/입고/예산 업무 규칙을 담지만 ID·사용원장·원자성이 없고 Google Sheets 함수의 Excel 변환 손상이 있다.
- BOGUNON 물품관리는 이미 Supabase에 품목·로트·구매계획·입고·예산을 구현했다. 입고 멱등성과 부분입고는 재사용 가치가 높다.
- BOGUNON의 현재 모델은 개인 `user_id` 소유이며 사용 차감, 이동원장, 학교 공유, 교사/강사 역할이 없다.
- Purchase Helper는 분석·편집·검산·품의·에듀파인·정산을 구현했다. 이미지 OCR과 작업 저장/복원은 없다.
- 공유 저장소는 기존 Supabase Auth/Postgres/RLS/RPC 확장이 가장 낮은 통합 비용과 가장 강한 트랜잭션 근거를 가진다.
- 재고 증가는 실제 입고 확인 RPC에서만 발생해야 한다.

## 제안 데이터 모델

- `items`: school_id, item_id, name, category, specification, base_unit, package_unit, units_per_package, target/minimum stock, active.
- `stock_lots`: lot_id, item_id, receipt source, received_on, expires_on, initial/remaining quantity, availability status.
- `stock_movements`: movement_id, type(RECEIPT/USE/DISPOSE/ADJUST/REVERSAL), signed quantity, actor, reason, request_id, before/after aggregate snapshot.
- `stock_movement_allocations`: 한 movement가 여러 lot를 차감한 상세.
- `purchase_links`: Purchase Helper 건과 요청/실제 입고/상태 연결.
- `inventory_members`: school_id, user_id, role, active.
- `inventory_audit`: 권한·설정·업무 변경 append-only 감사.

## 개발 로드맵

| 단계 | 승인 게이트 |
|---|---|
| IM-1 | 데이터 모델, Supabase 프로젝트/스키마, 역할/RPC 계약 확정 |
| IM-2 | movement/FEFO/멱등 트랜잭션 엔진과 DB 테스트 |
| IM-3 | DESK 관리자 workspace |
| IM-4 | 강사 웹과 모바일 UX |
| IM-5 | Purchase Helper DTO/adapter와 입고 연결 |
| IM-6 | 합성 migration rehearsal와 대조 보고서 |
| IM-7 | 통합·동시성·권한·복원 QA |
| IM-8 | 별도 승인 기반 배포, write freeze/cutover/rollback |

## 판정

`CONDITIONAL`

조사·설계 근거는 확보했다. IM-1을 시작하기 전 운영 최신 원본, 운영 BOGUNON 데이터 권위, 학교/역할 범위, Supabase 배치·백업 정책을 승인받아야 한다. IM-1 제품 개발은 자동 시작하지 않는다.

## 보안 검토

설계 문서 전체를 비밀키·토큰·비밀번호·개인정보 표식과 실제 원본 품목명에 대해 검사했다. 전용 secret scanner는 설치되어 있지 않아 정규식 기반 best-effort 검사만 수행했으며 탐지 결과는 없었다. 원본 xlsx 자체는 Git에 복사하지 않았다.

