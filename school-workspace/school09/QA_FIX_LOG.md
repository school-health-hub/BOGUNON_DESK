# 자율 QA 기록

업무 SQL·제품 기능의 변경은 없다. 신규 감사 harness에서 발견한 오류만 수정했다.

| 결함 | 재현/원인 | 수정 | 실질 수정 시도 |
|---|---|---|---|
| 공개 INVOKER 소유자 잘못 가정 | catalog shape assert가 ws_runtime을 요구했으나 실제54개 ws_owner 소유 INVOKER. INVOKER는 소유자 권한으로 실행하지 않음 | 기존 SQL에 맞게 owner assert 수정. private DEFINER runtime/reader 비소유 검사 유지 | 1 |
| role membership 없음 처리 | pg_auth_members JSON 집계가 0행→null, iterable 검사 TypeError | null을 빈 목록으로 처리. 실제 client/runtime membership 유무 검증 유지 | 1 |

`attempt1-audit-failure.log`, `attempt2-audit-failure.log`는 실패 증거다. 원인별 3회 상한 이내다.
보안 의미 변경, 기존 함수 owner 변경, RLS 비활성, 광범위 GRANT는 하지 않았다.
첫 실행의 S01~04 DB 회귀99는 같은 입력 SHA/SQL/PG17.6에서 모두 통과했다. 이후 harness만 수정했으므로
그 회귀는 재사용하고 installer/domain/새 보안/PostgREST probe만 재실행했다. 중복 실행을 새 고유 시나리오로 합산하지 않는다.

세 번째 별개 harness 결함: postgres session에서 `SET ROLE authenticated;SET ROLE ws_runtime`으로 시험하면
SET ROLE 허용 여부는 session_user인 superuser 기준이므로 잘못 성공한다. 실제 PostgREST authenticator와 동일한
`SET SESSION AUTHORIZATION school_rest` 후 authenticated로 전환하도록 수정했다(이 결함 수정1회).
단순 current_role 전환과 비특권 session_user의 역할 전환 가능성을 구분하며 SQL 권한은 변경하지 않았다.

인계 diff 검사를 위해 로그 행 끝의 공백만 정규화했다. 실행 결과·오류 내용은 변경하지 않았다.
