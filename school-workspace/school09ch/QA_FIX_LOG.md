# Focused QA 기록

원본177/23은 반복 실행하지 않았다. 09C 설치 fragment와 새 LOCAL 설치 문맥/metadata만 시험했다.

| 항목 | 재현/원인 | 수정/검증 | 실질 수정 |
|---|---|---|---:|
| 원본09C Auth schema ACL /helper 교체 | NOINHERIT SET-only 실제 LOGIN에서42501 | 객체 소유 role로 명시 전환, 임시 CREATE는 동일 transaction 뒤 회수 | 1 |
| 초기 에러 assert | 권한 오류라도 실제 메시지는 must be able to SET ROLE로 일반 permission denied와 다름 | verbose SQLSTATE42501 검사+primary error receipt로 단계 확인 | 1 |
| guard Auth namespace 조회 | installer는 Auth schema USAGE가 없는데 regclass text lookup이42501 | pg_class/pg_namespace OID catalog 조회로 대체, 불필요 Auth 권한을 부여하지 않음 | 1 |

모든 수정은 같은 결함당3회 상한 이내다. 마지막 focused26 PASS, 중간 실패는 attempt*.log에 보존한다.
실제 PG 로그인과 역할 속성은 profile-metadata.json, 거부 단계의 SQLSTATE는 denial-receipts.json에 있다.
부정/rollback/기본 CLOSED 검사와 두 current-session 구분을 포함한다.
Auth function 본문/권한 상한·개인정보/세션회수 의미는 바꾸지 않았다.
