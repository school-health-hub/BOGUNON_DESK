# SCHOOL-06 — 운영 적용 준비 후보 (운영 적용 아님)

기준: 통합 `243ae95e69483dfbe8d2438c41f858577d748048`, SCHOOL-05 `6af60d6a071039a048833f27226f2a3c698fe80c`, SCHOOL-04 `8de4dfd8f13f3aeae8173edd7f28c9e8caa8fd8c`.

이 패키지는 SCHOOL-01A/C/02/03/04 SQL을 의존 순으로 합성한 설치 후보다. 제품/Cloud B 코드는 수정하지 않는다. 운영 프로젝트 `xxownwxxajzrviuvvfiu`(Sydney)에 연결하지 않았다. Hosted Auth/PostgREST/Windows 검증 및 운영 적용 승인을 대신하지 않는다.

## 재현

정확한 기준 커밋을 새 디렉터리에 checkout하고 이 디렉터리를 상대경로 `school-workspace/school06`에 복원한다. Python3, Bash, Docker Unix socket, Node 및 기준 package-lock에 맞는 의존성이 필요하다. 이미지 다운로드 외에 DB 네트워크는 없다.

```sh
python3 school-workspace/school06/tools/build_sql.py
bash school-workspace/school06/run-local.sh > /tmp/school06-local.log 2>&1
```

컨테이너 이름은 `bogunon-school06-pg`로 고정되며 기존 동명 컨테이너가 있으면 중단한다. 독립 PostgreSQL 17.6, network:none, 외부 포트 없음, 메모리 임시 DB다. 생성한 컨테이너 ID만 종료 시 제거한다. 회귀 실행 중에는 자신이 소유한 컨테이너만 원래 스위트 이름으로 잠시 변경한다. 다른 SCHOOL 테스트와 동시에 실행하지 않는다. 테스트 프로그램은 운영 DSN/호스트를 받지 않는다. fixtures와 로컬 Auth 권한 제공은 `tests/`에만 있다.

PostgREST 13.0.4 실제 바이너리를 동일 network:none 컨테이너 안에서 사용한다. 무작위 일회용 HS256 키는 메모리에만 두며 저장하지 않는다. 테스트 JWT 발급자와 Auth 테이블은 합성이다. 따라서 실제 HTTP/JWT/PostgREST 체인은 LOCAL POSTGREST이며 Supabase Hosted 검증은 아니다.

## 설치 파일 순서 — 자동 운영 실행 금지

1. `sql/preflight-readonly.sql`: 카탈로그 전용 조회. 운영자 신원/대상 프로젝트를 별도 확인하고 출력 검토. 기존 이름 충돌과 Auth 권한 가능성을 확인한다.
2. `supabase/migrations/20261105104546_workspace_foundation.sql`: 신규 역할·스키마·설치 장부만 생성. 기존 Auth 권한을 변경하지 않는다.
3. **외부 승인 Gate**: 실제 Auth 소유자/관리형 플랫폼이 최소 열 권한을 허용하는지 READ-ONLY로 확인하고 별도 승인. 불가하면 여기서 중단한다. 테스트용 `tests/local-auth-capabilities.sql`을 운영에 적용하지 않는다.
4. `supabase/migrations/20261105104548_workspace_core.sql`: A → C → 02 → 03 → 04 원자적 설치. public RPC는 기본 CLOSED. fixtures/실제 학교/사용자를 넣지 않는다.
5. 설치 장부·객체·RLS·ACL을 점검하고 별도 운영 인증 테스트 승인을 받는다. 승인 전 클라이언트 Production Gate는 계속 비활성이다.
6. **별도 승인 후에만** `sql/activate-new-rpcs.sql`: 새 39개 공개 목적별 함수와 각각의 내부 진입점에만 authenticated EXECUTE. public 함수는 invoker, 내부는 최소권한 definer. PUBLIC/anon은 허용하지 않는다. 제품 Gate 활성화를 의미하지 않는다.
7. 문제가 있으면 `sql/close-new-rpcs.sql`: 새 RPC만 차단. 데이터 삭제·DROP·Auth 변경 없음.

CLI3.0.0의 `migration new`로 파일을 생성했다. Cloud에서 CLI 상태 디렉터리는 `SUPABASE_HOME`으로 분리했고 HOME은 변경하지 않았다. CLI db push/link는 실행하지 않았다. 운영 설치는 managed SQL 권한 검토 전에는 실행 가능한 것으로 확정하지 않는다. 두 migration은 각각 자체 트랜잭션이며, core에는 모든 사업 기능 DDL이 함께 들어간다. 관리형 migration runner가 외부 트랜잭션을 강제하는 경우 해당 도구와 별도 검증해야 한다. 격리 검증은 psql ON_ERROR_STOP로 수행한다.

## 무결성/재실행

원본 5개 SQL과 수정 내역은 `reference/source-sql-manifest.json`에 기록한다. 기존 SQL은 변경하지 않는다. 배포 파일의 local-only guard/role/schema bootstrap/Auth GRANT만 분리하고 추가 설치 Gate/ACL/지문을 적용한다. 과거 superseded request_join 내부 함수를 다시 공개하지 않는다.

패키지 사양 체크섬과 구조 지문(함수 본문·소유자·ACL/search_path, 테이블/RLS/FORCE, 열·제약·트리거·인덱스·정책, 역할 상속/속성)을 저장한다. 동일 버전·동일 구조만 no-op 재실행한다. 충돌/드리프트는 덮어쓰지 않고 중단한다. 장부는 FORCE RLS이며 앱/runtime에서 변경할 수 없다. 설치 동시 실행은 transaction advisory lock으로 직렬화한다. 사양 수정은 새 migration과 검토가 필요하며 운영 파일을 재생성해서 기존 버전을 덮어쓰지 않는다.

## 포함/제외

학교 디렉터리·가입/최초 관리자 요청·관리자 propose/accept·권한/세션 회수·업무/배정/이력·일정/이력·인수인계/대상 snapshot/수정/읽음·감사·멱등성 영수증을 포함한다. 목록은 `evidence/object-inventory.json` 및 public signatures registry 참조.

Cloud B가 추가한 `school-workspace/instructors/sql/candidate.sql`은 별도 기능으로 이번 core 설치에 포함하지 않는다. 해당 코드/후속 수정도 덮어쓰지 않는다. 실제 전체 제품 Gate를 열기 전 그 기능의 의존성·정책도 별도로 결정해야 한다. 기존 public tasks/events/profiles/medication 및 기존20개 SECURITY DEFINER는 변경/호출 재사용하지 않는다. 로컬에는 이름만 같은 보존 검사용 sentinel 함수가 있으며 실제 운영 함수 본문 검증을 뜻하지 않는다.

최초 관리자 재직 검증 담당자, 신뢰 가능한 학교 directory 공급, 보존기간·국외 저장 고지·운영 백업은 운영 전 결정이 필요하다. 학교코드는 text이며 선행0을 유지한다. 합성 fixture는 실제 학교 증거가 아니다. 기존 개인 데이터 업로드 및 학생 의료정보 입력은 허용하지 않는다.

검증 환경은 기존 Node 의존성 캐시를 재사용했다. xlsx가 없어 전체 dependency-complete build를 검증하지 못했으며 baseline/후보에 같은 캐시를 사용했다. 로그의 줄 끝 공백/말미 빈 줄은 Git whitespace 검사를 위해 정리했다. 오류 문구/판정은 보존했다.
