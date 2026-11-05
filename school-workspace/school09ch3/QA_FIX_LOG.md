# H3 자율 QA 기록

각 결함별로 실질 수정1회다. 아래 실행 파일 번호는 전체 실행 순서이며 같은 결함을9회 시도했다는 뜻이 아니다.
동일한 보안 실패를 무시하거나 테스트 단언을 줄이지 않았다. 실패/중간 로그는 최종 PASS와 분리한다.

| 발견 | 원인 | 최소 수정/검증 |
|---|---|---|
| PG17 role 생성 후 ADMIN 재부여 오류 | 생성자의 기존 ADMIN grant와 충돌 | 불필요한 ADMIN TRUE 제거, 자신의 새 WS 역할 SET만 구성 |
| schema ACL 관리 거부 | NOINHERIT 설치자가 schema owner로 전환하지 않음 | WS schema ACL은 실제 ws_owner 문맥에서 처리 |
| 함수 생성의 schema CREATE 거부 | 임시 생성 권한 누락, local public grant fixture의 grant option 누락 | 필요한 생성자에게 transaction 내부 CREATE, 끝에서 회수; 기존 권한 fixture를 명시 |
| accounts 등의 DDL 소유권 거부 | 기존 누적 SQL은 SUPERUSER 설치에 의존 | 임시 NOLOGIN/NOBYPASS 설치자를 도입, 업무 DDL을 해당 역할로 실행 후 완전 삭제; 원시 Auth/RLS 우회 없음 |
| fingerprint의 record 필드 충돌 | ACL loop의 a가 pg_attribute alias a를 가림 | ACL 변수명 분리 |
| replay에서 Auth schema 조회 거부 | ws_owner로 SET한 후 regclass 이름 해석 | 카탈로그 OID 조회로 변경, Auth USAGE를 부여하지 않음 |
| lifecycle manifest SELECT 거부 | 목적 owner로 전환하기 전에 제어 테이블 읽음 | 읽기/지문은 ws_owner, GRANT/REVOKE는 각 함수의 실제 소유자 |
| 사용자 FK 제거 위험(정적 검토) | 삭제된 관리자의 user_id가 남아 마지막 관리자 판단에 영향 | 기존 ON DELETE SET NULL 보존. 권한 있는 postgres의 FK DDL 후 비BYPASS 소유자 이관. 기존 t34 그대로 PASS |
| bootstrap fixture의 학교 코드 변경 충돌 | directory 미리 채움 후 중복 fixture 적용 | 기존 full fixture를 올바른 순서로 초기화, 업무 SQL 변경 없음 |
| Node03 파일 선택 오류 | contracts.test.ts가 없고 tasks.test.ts가 실제 파일 | 저장소에 존재하는 파일 선택, 원래 단언 그대로 실행 |
| 합성 Managed schema owner 분리 후 Auth FK fixture 거부 | Auth 테이블 소유자에게 본래 필요한 USAGE가 누락 | 합성 supabase_auth_admin에게만 USAGE를 복원, Workspace 역할에는 없음 |
| 정적 body verifier 오탐 | AS 다음 개행을 처리하지 않아 다른 함수까지 매치 | 함수 header를 세미콜론으로 경계 짓고 공백/개행 처리 |
| Docker CLI 고정 경로 | 새 환경의 CLI가 다른 위치에 설치될 수 있음 | shim 전 원래 PATH에서 해석한 CLI를 child에 전달, 임시 NOBYPASS 경계/학교 RPC 사용자 매핑은 유지 |
| mutable manifest/외부 Auth ACL drift 채택 가능성 | 구조 지문은 테이블 내용/외부 Auth ACL을 포함하지 않음 | source54 manifest exact 비교 및 모든 lifecycle에서 Auth capability guard 추가, 변조 부정 시험 |

처음28 PASS/중간174 PASS/별도 schema-only 결과는 그때 후보에 대한 중간 증거다.
최종 결과는 results.json/final-run.log와 마지막 SQL release/hash를 따른다. 중간/반복 실행을 최종 고유 체크 수에 더하지 않는다.
원본 C의177/23·H의26·H2의39는 이 작업의 새로운 PASS로 계산하지 않는다.
원본 Auth verifier의 오류 시 signing material 비노출 MOCK 시험도 새 runner에서 회귀 확인했다.

빌드/Windows: 제품 TS/JS/UI 변경이 없어 전체 빌드·실제 Windows·기존13개 타입오류/xlsx403/Cargo 재현은 NOT RUN.
Vitest/Node는 기존 검증 의존성을 사용했다. 새 의존성 버전 교체나 외부 네트워크 우회는 없다.
