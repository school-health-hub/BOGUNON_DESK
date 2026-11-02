# IM-1B-5 QA·보안 결과

## 실행 결과

- 구매 SQL 계약: 15/15 PASS
- 실제 로컬 JWT HTTP: PASS
- 독립 PostgreSQL session 동시 입고: 1건 성공, 1건 초과입고 거부, 최종 누적 6, receipt line 1, deadlock 0
- 기존 회귀: IM-1B-1 17/17, IM-1B-2 17/17, IM-1B-3 24/24, IM-1B-4 20/20, 합계 78/78 PASS
- IM-1B-4 합성 fixture는 현재 로컬 Auth schema의 생성 열에 직접 값을 넣지 않도록 테스트 코드만 호환 수정했다. 제품 migration과 Auth schema는 변경하지 않았다.
- 다중 line 입고에서 첫 line 처리 뒤 둘째 line이 초과입고로 실패하는 장애를 주입했고 receipt, lot, movement, audit, idempotency, 누적량이 모두 원상 유지됨을 확인했다.

## 보안 경계

- 모든 신규 테이블은 RLS와 FORCE RLS를 사용한다.
- authenticated에는 학교 teacher_admin 범위의 SELECT만 허용하며 직접 INSERT/UPDATE/DELETE는 grant하지 않는다.
- 공개 RPC는 SECURITY DEFINER, 빈 search_path, fully-qualified 객체, auth.uid(), 활성 학교·teacher_admin membership을 검증한다.
- reversal wrapper는 인증·활성 teacher_admin membership을 purchase receipt 존재 조회보다 먼저 검증한다. instructor, 비활성 사용자, 비소속·타학교 호출자는 실제 연결 movement와 임의 movement 모두 동일한 `PT403 / PERMISSION_DENIED`를 받는 것을 SQL과 JWT HTTP에서 확인했다.
- PUBLIC/anon 실행 권한을 제거하고 authenticated에 필요한 overload만 허용한다.
- 합성 `.invalid` 사용자와 합성 학교·물품만 사용했다. 운영 ref, 운영 키, 실제 학교 데이터를 사용하지 않았다.

## 계약 manifest

34개 ID를 유지하고 `INV-D06`, `INV-P02`, `INV-P03`, `INV-P04`만 실행 근거로 PASS 전환했다. `INV-P01` adapter 왕복과 `INV-P05` 구매/재고 취소 분리는 PENDING이다.
