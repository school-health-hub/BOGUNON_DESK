# IM-0 권한 모델

## 멤버십

`inventory_members(school_id, user_id, role, active, joined_at, revoked_at)`를 권위로 사용한다. 역할은 `teacher_admin`, `instructor`로 시작한다. JWT 사용자 ID만으로 학교를 추정하지 않는다.

## 권한 행렬

| 작업 | 보건교사 | 보건지원강사 |
|---|---:|---:|
| 목록/가용재고/유효기간 조회 | O | O |
| 품목 등록·수정·보관 | O | X |
| 입고 확정 | O | X |
| 사용 입력 | O | O |
| 폐기·정정·취소 | O | X |
| 구매 후보/품의 연동 | O | X |
| 전체 감사/멤버 관리 | O | X |
| 본인/허용 범위 사용 이력 | O | O |

## 서버 검증

- 조회 RLS는 활성 membership의 동일 `school_id`만 허용한다.
- 강사는 stock tables의 insert/update/delete를 직접 수행할 수 없다.
- 사용 기록은 `consume_inventory` RPC만 실행 가능하며 RPC가 역할과 학교를 다시 검증한다.
- 교사 전용 RPC는 `teacher_admin`을 요구한다.
- 역할 변경은 교사라고 해서 자기 권한 상승을 허용하지 않는다. 마지막 관리자 제거 방지 규칙이 필요하다.
- 감사 테이블은 append-only이며 클라이언트 update/delete를 거부한다.

## 정정

잘못된 사용은 원본을 삭제하지 않는다. 교사가 `VOID/REVERSAL` movement를 만들고 사유와 원본 movement ID를 기록한다. 이미 후속 차감이 있으면 서버가 로트 재적립 가능 여부를 판단하고, 불가능할 때 명시적 정정 로트를 사용한다.

