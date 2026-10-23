# IM-1A RLS·RPC 보안 검토

## 확인된 정책

5개 medication 테이블 모두 RLS가 활성화되고 `public, anon` 권한은 회수됐지만, `authenticated`에는 SELECT/INSERT/UPDATE/DELETE가 부여되며 `user_id = auth.uid()`의 `FOR ALL` 정책이 적용된다.

따라서 기존 일반 사용자는 자신의 lot 수량, receipt, 계획을 Data API로 직접 변경·삭제할 수 있다. 개인 도구에서는 소유자 경계이나 공유 재고에서는 재고 무결성과 역할 분리가 성립하지 않는다.

## `receive_medication` 평가

| 항목 | 판정 |
|---|---|
| 인증·item/plan 소유권 | 충족 |
| `SECURITY DEFINER`의 빈 `search_path` | 충족 |
| 입력 수량/가격 검증 | 충족 |
| plan 행 잠금 | 충족 |
| 함수 EXECUTE 제한 | `authenticated`만 허용 |
| 학교·역할 검증 | 없음 |
| 동일 UUID, 다른 payload 충돌 | 없음. 기존 receipt를 조용히 반환 |
| 직접 테이블 DML 차단 | 없음 |
| 감사 원장 | 없음 |

## 필수 보완

1. 재고성 테이블의 authenticated 직접 INSERT/UPDATE/DELETE를 회수하고 승인된 RPC만 EXECUTE한다.
2. RPC는 `auth.uid()`에서 활성 membership을 조회해 school과 role을 결정한다. 클라이언트 `school_id`, user metadata, role 문자열을 신뢰하지 않는다.
3. `SECURITY DEFINER`는 비노출 private schema에 두거나, 노출 함수라면 함수별 EXECUTE를 명시한다. 소유자, 빈 `search_path`, 모든 객체 schema qualification을 고정한다.
4. 요청 UUID와 정규화 payload hash를 저장해 재전송은 원결과를 반환하고 다른 payload는 `IDEMPOTENCY_CONFLICT`로 거부한다.
5. 비활성 membership은 매 호출마다 거부한다. JWT의 오래된 app metadata만으로 판정하지 않는다.
6. RLS 테스트에는 비회원, 타학교 ID, 강사의 관리자 RPC, 직접 DML, 비활성 회원을 포함한다.

공식 근거: Supabase RLS 문서는 SECURITY DEFINER의 RLS 우회와 빈 `search_path`를 강조하며, 함수는 기본 EXECUTE 권한을 회수한 뒤 필요한 역할에만 부여해야 한다.

