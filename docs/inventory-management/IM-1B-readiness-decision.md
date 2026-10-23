# IM-1B 준비도 판정

## 유지할 권고

혼합형 아키텍처를 유지한다. 품목·구매계획·부분입고·예산·Purchase Helper 기능은 재사용하고, 학교 membership, 역할, tenant 격리, lot balance, movement, audit, idempotency, 사용/폐기/정정 RPC 및 강사 웹을 신규 영역으로 만든다.

## 계약 후보

| 항목 | 권고 | 상태 |
|---|---|---|
| 스키마 | 혼합형 | DECISION REQUIRED |
| membership | 복수 학교 허용, 기본 1개 | DECISION REQUIRED |
| 강사 이력 | 본인 전체 + 학교 공용 최소 내역 | DECISION REQUIRED |
| 수량/포장 | 정수 최소단위 + 정확 변환비 | DECISION REQUIRED |
| 임박/만료일 | 90일, 날짜 당일까지 사용 가능 | DECISION REQUIRED |
| 만료·격리 lot | 자동차감 제외 | 계약 후보 확정 가능 |
| UUID | 신규 독립 UUID + 기존 ID mapping | 계약 후보 확정 가능 |
| 초과입고 | 기본 차단, 관리자 별도 확인 | DECISION REQUIRED |
| 오프라인 쓰기 | 초기 버전 미지원 | 계약 후보 확정 가능 |
| 품의/입고 | 품의는 불변, 교사 입고확정만 증가 | 계약 후보 확정 가능 |

## 최신 플랫폼 영향

Supabase 2026-04-28 changelog에 따르면 새 public table의 Data API 자동 노출은 중단 방향이며 2026-10-30부터 모든 프로젝트에 적용 예정이다. IM-1B에서는 RLS뿐 아니라 Data API exposed schema 및 명시적 GRANT/REVOKE를 테스트 계약에 포함해야 한다.

## 미충족 게이트

1. 운영 DB migration/RLS/RPC 실제 적용 상태
2. 실제 plan, backup/PITR, 복원 책임자와 runbook
3. 운영 재고 권위 원본과 전환 기준시각
4. 운영과 격리된 합성 QA 환경
5. 학교·역할·단위·이력 정책 승인
6. 사용자 명시적 IM-1B 구현 승인

## 최종 판정

`CONDITIONAL`. 문서 checkpoint와 프로젝트 ref 대조는 완료됐지만 운영 메타데이터·복구 가능성·QA 격리 증거가 부족하다. 이는 IM-1B 자동 구현 승인이 아니다.

