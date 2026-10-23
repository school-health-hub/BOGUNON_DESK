# IM-0 통합 아키텍처 제안

## 저장소 비교

| 후보 | 장점 | 단점 | 판정 |
|---|---|---|---|
| A. 기존 Firebase Auth + Firestore | 실시간·오프라인 SDK 성숙 | 현재 두 제품의 실제 인증/저장소가 Supabase라 신규 이중 인증·운영 필요 | 비권고 |
| B. 별도 Firebase 프로젝트/영역 | 강한 격리 | 계정·비용·백업·운영 복잡성, DESK 재인증 | 비권고 |
| C. 기존 Supabase Auth + 논리적으로 격리된 Postgres/RLS/RPC | BOGUNON과 DESK 모두 현재 Supabase 사용, SQL 트랜잭션·제약·감사에 적합 | 역할/RLS/RPC를 새로 엄격히 설계해야 함 | 권고 |
| C-2. 별도 Supabase 프로젝트 | 장애·데이터 격리 | 로그인 연결, 배포, 백업 비용 증가 | 규제/조직 요구 시 대안 |

## 권고 구조

동일 Supabase Auth를 사용하고 Inventory 전용 테이블/RPC/정책을 만든다. 브라우저와 DESK는 publishable key와 사용자 세션만 사용한다. 서비스 역할 키는 서버/보호된 CI에만 두며 DESK 번들에 넣지 않는다.

```
DESK 교사 ─┐
            ├─ Supabase Auth ─ RLS + Inventory RPC ─ Postgres
강사 웹 ───┘                              │
                                    Realtime/조회 뷰
Purchase Helper ─ DTO adapter ─ purchase_links ─ 확인된 입고 RPC
```

## 트랜잭션 모델

- 현재고 원장은 `stock_movements`, 빠른 조회/동시성 잠금은 `stock_lots.remaining_quantity`를 사용한다.
- 모든 변경은 SECURITY DEFINER RPC 내부 트랜잭션으로만 수행한다. 직접 lot 잔량 update 권한은 클라이언트에 주지 않는다.
- RPC는 membership/role/school_id, 요청 UUID, 양수 수량, 가용 상태를 검증한다.
- 사용은 품목의 유효 정상 로트를 `expires_on, received_at, lot_id` 순으로 잠그고 FEFO 차감한다.
- 여러 로트 차감은 movement header와 allocation detail로 남긴다.
- `request_id`는 학교 단위 unique로 두고 같은 payload 재전송은 기존 결과를 반환한다. 다른 payload 재사용은 충돌 오류다.
- 음수 방지는 행 잠금, 조건부 update와 CHECK 제약으로 이중 보호한다.

## 온라인/오프라인

IM-1 기본 정책은 재고 변경 온라인 전용이다. 오프라인에서는 조회 캐시를 명확히 “마지막 동기화”로 표시하고 사용 요청을 확정하지 않는다. 향후 오프라인 큐를 허용하려면 각 요청 UUID, 만료시간, 재인증, 서버 단일 처리, 결과 재조회를 갖춘 별도 승인 단계가 필요하다. 로컬 선차감은 금지한다.

## 백업·복원

정기 DB 백업/PITR 가능 여부, 월별 논리 export, 학교별 복원 리허설, 감사 원장 보존 기간을 운영 계약으로 정한다. restore는 staging에서 참조 무결성·수량 합계를 검증한 뒤 승인한다.

