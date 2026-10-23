# IM-1A 학교·역할 계약

## 제안 엔터티

- `inventory_schools`: 서버 생성 UUID, 학교 식별 코드와 표시정보 분리
- `inventory_members`: `(school_id,user_id)` UNIQUE, role=`teacher_admin|instructor`, active, 유효기간, 변경자
- 모든 item/lot/movement/purchase link/audit에 `school_id` 저장
- 복합 FK `(school_id,item_id)`, `(school_id,lot_id)`로 교차 학교 참조를 구조적으로 차단

한 사용자의 복수 학교 소속은 스키마상 허용하되, 요청마다 membership을 하나 선택하고 서버가 검증한다. 클라이언트가 보낸 school은 “선택 힌트”일 뿐 권한 근거가 아니다.

## 권한

- `teacher_admin`: 품목·입고·사용·폐기·정정·취소·구매연동·감사·회원 관리
- `instructor`: 학교 품목/가용재고/유효기간 조회, 사용 RPC, 허용된 이력 조회
- instructor의 직접 lot/movement 변경, 입고/폐기/정정/구매/회원관리 RPC는 거부

## 위협별 계약

| 위협 | 서버 계약 |
|---|---|
| 임의 school_id | `auth.uid()`의 활성 membership과 일치 확인 |
| 타학교 item/lot | 복합 FK + RPC 내부 school 조건 조회 |
| 강사의 관리자 RPC | DB membership role 검사 |
| 비활성 계정의 기존 세션 | 매 요청 membership.active 검사 |
| 조작된 metadata | 권한 판단에 사용 금지 |

## 이력 열람 결정

잠정안은 본인 상세 이력 + 동일 학교 최근 공용 이력의 최소 필드(품목, 수량, 시각)다. 타인의 식별자·사유·감사 상세는 teacher_admin만 본다. 공용 이력 제공 여부와 보존기간은 사용자 승인 사항이다.

