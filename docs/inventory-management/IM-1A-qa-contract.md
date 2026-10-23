# IM-1A QA 계약

모든 입력은 합성이며 실제 학교/사용자/품목을 사용하지 않는다. 공통 실행 단계는 IM-1B(RPC/RLS), IM-5(구매연동), IM-6(이전), IM-7(E2E)다.

| Test ID | 목적 | 합성 입력/사전조건 | 기대 결과 | 실패 위험 | 단계 |
|---|---|---|---|---|---|
| INV-D01 | 단일 lot 사용 | 정상 lot 10, 사용 3 | 잔량 7, movement 1 | 재고 오차 | IM-1B |
| INV-D02 | FEFO | expiry 다른 lot 3+5, 사용 4 | 빠른 lot 3, 다음 1 차감 | 폐기 증가 | IM-1B |
| INV-D03 | 만료 제외 | 만료 5+정상 5, 사용 4 | 정상만 차감 | 위해 재고 사용 | IM-1B |
| INV-D04 | 격리 제외 | 격리 5+정상 2, 사용 3 | 부족 오류, 무변경 | 격리품 사용 | IM-1B |
| INV-D05 | 초과 사용 | 가용 2, 사용 3 | `INSUFFICIENT_STOCK`, 무변경 | 음수 재고 | IM-1B |
| INV-D06 | 부분입고 | 주문 10, 입고 4 | 재고 +4, PARTIALLY_RECEIVED | 과대 계상 | IM-5 |
| INV-D07 | 중복입고 | 동일 UUID 2회 | 1회 반영, 기존 결과 | 이중 계상 | IM-1B |
| INV-D08 | 단위변환 | 2 box × 100 | 기본단위 +200 | 단위 오차 | IM-1B |
| INV-D09 | 정정 보존 | +2 정정 후 취소 | 원본+역 movement 유지 | 감사 훼손 | IM-1B |
| INV-C01 | 교사/강사 동시 | 가용 10, 각 6 | 한 건만 성공 또는 합계≤10 | 초과 차감 | IM-1B |
| INV-C02 | 두 강사 동시 | 동일 item 사용 | 잠금 순서 유지, 음수 없음 | 데드락/초과 | IM-1B |
| INV-C03 | 마지막 1개 | 동시 1+1 | 정확히 한 성공 | 이중 사용 | IM-1B |
| INV-C04 | 동일 UUID | 같은 payload 재전송 | `replayed`, 같은 결과 | 중복 반영 | IM-1B |
| INV-C05 | UUID payload 충돌 | 같은 UUID, 수량 변경 | `IDEMPOTENCY_CONFLICT` | 요청 위장 | IM-1B |
| INV-C06 | 응답 유실 | commit 뒤 재시도 | 저장된 성공 응답 | 이중 반영 | IM-1B |
| INV-C07 | 트랜잭션 충돌 | 직렬화 실패 주입 | 같은 UUID 제한 재시도 | 불명확 상태 | IM-1B |
| INV-S01 | 비로그인 | anon SELECT/RPC | 거부 | 정보 노출 | IM-1B |
| INV-S02 | 강사 관리자 RPC | instructor 입고/정정 | `ROLE_FORBIDDEN` | 권한 상승 | IM-1B |
| INV-S03 | 직접 UPDATE | authenticated lot update | 권한 거부 | 원장 우회 | IM-1B |
| INV-S04 | 타학교 item | school A actor + B item | `TENANT_MISMATCH` | 테넌트 침해 | IM-1B |
| INV-S05 | 타학교 lot/movement | B 식별자 조회/사용 | 0 rows 또는 거부 | 정보 노출 | IM-1B |
| INV-S06 | 비활성 회원 | 유효 JWT, inactive membership | 거부 | 퇴직자 접근 | IM-1B |
| INV-S07 | 조작 metadata | client role=admin | 권한 변화 없음 | 권한 상승 | IM-1B |
| INV-S08 | 함수 권한 | PUBLIC/anon EXECUTE | 거부 | definer 우회 | IM-1B |
| INV-P01 | 후보 전달 | 부족 item 2개 | mapping 보존 | 잘못된 구매 | IM-5 |
| INV-P02 | 품의 후 불변 | APPROVED 전환 | 재고 movement 없음 | 선계상 | IM-5 |
| INV-P03 | 입고 확정 | teacher 실제수량 확인 | lot/movement 생성 | 누락 | IM-5 |
| INV-P04 | 반복 부분입고 | 4+3+3 | 누적 10, 중복 없음 | 과대 계상 | IM-5 |
| INV-P05 | 구매취소/재고취소 | 입고 전후 취소 | 서로 다른 흐름 | 이력 훼손 | IM-5 |
| INV-M01 | item mapping | 중복 명칭/규격 | 확정/예외 분리 | 중복품목 | IM-6 |
| INV-M02 | 날짜·단위 누락 | 모호한 row | 자동 변환 안 함 | 데이터 왜곡 | IM-6 |
| INV-M03 | 초기재고 | 과거 이력 없는 잔량 | 기준일/source movement | 허위 이력 | IM-6 |
| INV-M04 | dry-run 대조 | 비식별 합계 | item/lot 합계 일치 | 이전 손실 | IM-6 |
| INV-M05 | 실패 롤백 | 중간 오류 주입 | batch 무반영/원본 보존 | 부분 이전 | IM-6 |

각 실행 기록에는 실제 SQLSTATE/업무 오류, transaction 결과, movement/audit 개수, 전후 집계를 첨부한다.

