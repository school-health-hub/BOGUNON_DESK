# IM-1B-6 요약

## 구현

- Inventory → Purchase Helper 순수 projection
- Inventory 권위 ID·단위·변환비를 보존하는 immutable sidecar
- Purchase Helper 편집 결과 → Inventory 변경 검토 후보 reconciliation
- BigInt 기반 정확한 수량 변환과 정수 KRW 단가 검증
- 삭제·추가·중복·타학교·모호한 identity·위험 문자열 분류
- stock effect `NONE`, receipt command 미노출

## 비구현 범위

- Purchase Helper 제품 UI 연결
- Purchase Helper 편집 session 저장·복원
- 구매 batch 변경 RPC
- 구매 취소 및 입고 reversal 정책
- 운영 Supabase 적용 또는 실제 데이터 이전

## 판정 원칙

독립 Adapter와 계약 QA가 통과해도 실제 Purchase Helper 제품 wiring은 존재하지 않는다. 따라서 IM-1B-6 판정은 `CONDITIONAL`이며, 다음 단계에서는 UI 통합 전에 adapter DTO versioning과 서버 변경 승인 RPC를 별도로 확정해야 한다.

## 이번 실행 결과

- Adapter 합성 행동 QA: 21/21 PASS
- TypeScript `tsc --noEmit`: PASS
- 계약 manifest: 34개 고유 ID, 27 PASS / 7 PENDING
- PowerShell parser: 오류 0
- 비밀정보·개인정보 best-effort 검사: 발견 0건
- 기존 Inventory DB 회귀(78 + 구매 15 + JWT + 동시성): 이번 실행에서는 NOT RUN
  - 로컬 `inventory_qa` DB가 시작 과정에서 unhealthy 상태로 연결을 거부했다.
  - 한 번의 bounded stop/start 후에도 회복되지 않아 다른 Docker stack과 volume 보호를 위해 추가 재시도를 중단했다.
  - 직전 IM-1B-5의 PASS 결과를 이번 실행 결과로 재사용하지 않는다.
- 정리: Inventory QA 컨테이너는 중지, 전용 volume 3개는 보존, 기존 `bogunon` stack은 유지

따라서 독립 Adapter 계약은 검증됐지만 필수 DB 회귀가 미실행이므로 전체 IM-1B-6 판정은 `CONDITIONAL`이다.

## 잔여 운영 게이트

- 운영 Supabase 접근·백업·PITR
- 실제 재고 권위 원본
- Purchase Helper 최신 settlement 모델과의 UI adapter
- 구매 취소·초과입고 업무 승인
