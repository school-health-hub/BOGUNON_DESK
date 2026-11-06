# 자율 QA 수정 기록

| 발견/재현 | 원인 | 최소 수정 | 실질 시도 |
|---|---|---|---:|
| H3 accounts에 client SELECT/ALL 잔존(롤백 실험) | postgres creator TABLE defaults가 owner 이관 후에도 남을 수 있음 | 새 Workspace relation만 불필요 ACL 회수. 내부 비BYPASS 역할의 기존 권한 유지, global defaults 불변 | 1 |
| 새 비공개 schema에 creator defaults가 남을 수 있음 | PostgreSQL schema default ACL은 기능/table hardening과 별개 | 새4 schema만 H3의 깨끗한 USAGE 집합으로 정규화. client CREATE/bridge USAGE 없음 | 1 |
| 긴급 close의 owner 검사 실패 | 일부 실제 private RPC 소유자가 ws_authz_reader | 기존54의 실제 비BYPASS owner3종으로 경계 수정. 권한을 부여하는 복구가 아니라 회수만 수행 | 1 |
| bootstrap executor SET 거부 | 해당 별도 운영 역할 SET은 설치자의 상시 권한이 아님 | 신규 SET/GRANT하지 않음. 긴급 close는54쌍만, bootstrap private command는 독립 CLOSED 상태/승인 절차 유지 | 1 |
| already-CLOSED에서 emergency 이후 QA reopen 가능성 | H3 QA lifecycle이 state보다 지문만 비교 | QA에도 closed/active 상태 제한. closed_unverified를 재활성화할 수 없음을 transaction rollback 시험 | 1 |

동일 결함3회 상한 이내. attempt1/2 실패 로그와 중간44/45 결과는 최종 성공에 합산하지 않는다.
권한 확대·RLS 해제·Auth 원본 GRANT·회수 검사 삭제·기존 제품 변경은 없다.
최종 결과는46 PASS/0 FAIL (30 LOCAL DB,15 LOCAL PostgREST,1 MOCK).
H3의 동일161 함수 정의·137 도메인 회귀는 참조만 했으며 새 테스트로 재계산하지 않았다.
