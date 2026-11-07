# SCHOOL H2-P4 — 합성 백업·격리 복원 준비

제품: `37ed6d435e57658336c244f847caf4d95df4002a`. 출발 QA: `d7e919f281766868e8e9d71790713445cd82f228`.
브랜치: `qa/school-h2-p4-backup-restore`. 제품/원본 SQL 변경 없음. 운영 접속·백업·데이터 조회·계정 시험·OAuth/Gate 변경 없음.

## H2-P3 제공 증거 반영

사용자가 제공한 기존 READ-ONLY 증거: postgres/postgres, DB postgres, nonsuper/CREATEROLE/DB CREATE, public CREATE WITH GRANT OPTION 및 Auth USAGE=true; Auth CREATE/owner SET=false; users.id REFERENCES/sessions4열 SELECT 가능; 예약 namespace/roles/ws_ 없음. H2-P2에서 이 값들을 미확인으로 기재한 상태는 **이번 제공 증거 범위에서 해소**한다. 새로 운영 조회한 결과가 아니다.
기존 postgres BYPASSRLS는 관리형 기본값으로 보존하고 신규 역할에 부여하지 않는다. 실제 설치의 신규 역할 SET/owner 이관 성공은 여전히 격리 결과와 구분한다.
기존 definer19는 postgres owner/명시 search_path, 1차 정적 검토에서 dynamic SQL/user_metadata/workspace 직접참조 없음; 18개 auth.uid 직접참조, complete_workflow_instance는 transition_workflow_instance 호출. 따라서 “본문 검토 전혀 없음” 상태는 사용자 제공 1차 검토 결과로 갱신한다. 호출 인가의 완전성·실제 관리형 실행·미래 schema 간접 도달까지 보증하는 보안 인증은 아니다. 기존 함수 수정/REVOKE 금지 유지.

## 백업 범위와 제외/복원 의존성

| 범위 | 보존할 대상 | 복원 합격/제한 |
|---|---|---|
| 역할·소유권 | 역할 속성/멤버십/admin·inherit·SET/grantor, schema/table/function owner, ACL/default ACL | 로그인 password는 role dump와 별도 비밀관리. Supabase 예약 역할을 일반 role dump로 덮어쓰지 않음. 실제 권한 없이 SUPERUSER/BYPASSRLS를 새로 부여하지 않음 |
| schema·함수·정책 | tables/columns/types/indexes/constraints/triggers/functions/security/search_path/RLS/FORCE/policies | catalog의 의미·이름으로 비교. 서로 다른 DB의 OID/통계값을 동일성 기준으로 사용하지 않음 |
| 업무 rows·sequence/FK | 승인 범위 행·대형 객체·sequence last/is_called·참조 무결성 | 전체 table counts+정규화 row digest+FK 실제 거부+sequence next값 검증. 운영 row digest/건수도 접근 승인 후 비공개 증거 |
| migration | `supabase_migrations` schema와 이력 rows | CLI 기본 제외 여부 확인, 명시 보존·독립 대조 |
| Auth | users/identities 등 승인된 범위와 managed schema 사용자 변경/의존성 | 실제 managed Auth 구조는 합성 fixture보다 복잡함. CLI 기본 filtering/권한/버전 대조 필요. 세션/token/provider 암호화 의존성 및 폐기 정책 별도. 일부 table SELECT 성공을 완전 백업으로 오인하지 않음 |
| Storage | buckets/objects DB metadata + 별도 실제 object bytes/checksum/수량 | DB dump는 object file 자체 백업이 아님. 실제 API 다운로드 권한과 누락 목록 필요 |
| 프로젝트/OAuth | extensions/PG major·Data API exposure/provider/redirect/site settings·외부 키 의존성 목록 | DB dump에 provider secret/프로젝트 설정이 전부 들어간다고 가정 금지. secret은 Git/로그와 분리한 관리 저장소. 설정 변경 별도 승인 |

실제 Supabase 백업은 [공식 CLI 절차](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)를 우선한다. 이번 리허설은 **고정 PostgreSQL17.6 pg_dump/pg_dumpall/psql** 경로다. Supabase CLI의 reserved role/internal schema filtering이나 Hosted restore 권한을 검증한 것이 아니다. 버전별 `--help`, 포함/제외 및 관리형 owner/extension 제약을 운영 추출 승인 후 실행 전에 대조한다. CLI 버전을 추정하거나 실행하지 않은 CLI를 PASS로 기록하지 않는다.

## 합성 리허설 구조

실행 파일: `school-workspace/hosted-h1/qa/h2-p4/backup_restore.py`.
기존 cached PostgreSQL17.6 digest `f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3`만 사용, `--pull=never`, 각 UUID 컨테이너 network none/host port 없음/tmpfs256MiB/memory512MiB/CPU1.
원본과 복원 대상은 **서로 다른 새 컨테이너**다. 외부 endpoint/credential 인자가 없으며 docker exec로 자신의 ID만 사용한다.

1. 실제 원본 core54와 별도 Instructor2 CLOSED 설치. 합성 Auth/학교/membership/개인 sentinel·Instructor row, FK/sequence, migration 이력 및 Storage metadata/별도 synthetic bytes를 준비한다. 실제 운영 table64/policy232/함수41 전체 사본은 아니다. 성공 target DB도 postgres로 두어 동결 installer의 identity 조건을 그대로 검증한다.
2. pg_dumpall roles-only/no-role-passwords, pg_dump schema-only/data-only로 백업. 합성 원본에는 writer가 없고 dump 동안 정지한다. 운영의 여러 덤프가 자동으로 동일 snapshot을 공유한다는 뜻은 아니다.
3. 백업 평문은 메모리에서만 처리하고 AES-256-GCM으로 암호화해0700 private 임시 경로/0600 파일에 저장한다. 각 파일은 무작위 nonce, filename AAD, authenticated tag 및 평문/암호문 SHA-256/크기 검증. 원본의 명시적 기본-owner ACL 및 고정 CHECK 원문 표현도 인증된 metadata sidecar로 함께 보존한다. 키는 별도0700/0600 임시 경로에 둔다. cipher나 key bytes를 로그·repo에 저장하지 않는다.
4. 잘못된 키/암호문 변조는 decrypt 단계에서 거부한다. 해시는 인증/암호화를 대신하지 않는다. 파일과 키를 동일 공개 artifact에 올리지 않는다.
5. 새로운 대상에서 역할→스키마→데이터 복원. PG17 role GRANTED BY 보존은 원본과 같은 **합성** bootstrap identity로 역할을 생성해 수행한다. 백업 원문은 유지하고 대상에 이미 있는 정확한 lab bootstrap role의 CREATE 문장 하나만 복원 실행에서 제외한다. 나머지 역할/멤버십은 원본과 대조한다. 이번 전용 fixture root는 isolated lab용이며 운영의 관리형 privileged role 재생성/권한 확대 방법으로 사용하지 않는다.
6. pg_dump는 명시적 default-owner ACL을 NULL 기본 표현으로, BETWEEN의 내부 AND 트리를 평탄한 AND로 복원할 수 있다. 실효 권한/조건이 같아도 동결 D0 fingerprint에는 차이가 난다. 이번 격리 복원에서는 인증된 원본 metadata sidecar로 정확한 owner ACL 표현과 원본 SQL에서 추출한 두 CHECK만 단일 transaction 안에서 재구성·전체 재검증한다. 원본 installer/release fingerprint를 변경하거나 재저장하지 않는다. 실제 운영 복원에 이 단계를 쓰려면 별도 검토·승인이 필요하다.
7. ON_ERROR_STOP/transaction으로 스키마 복원 중 강제 오류를 내고 새 schema가 rollback되는지 확인한다. 성공 대상은 별도 fresh DB. 기존 사용자 DB에 재시도/덮어쓰기하지 않는다.
8. source와 restored 전체 user table 건수/row digest, function definition/owner/ACL/RLS/policy/FK, sequence 상태·실제next값, 역할 속성/멤버십, migration·Auth fixture·Storage metadata/별도 bytes,54+2 CLOSED 및 원본 D0의 checked no-op replay(불변 fingerprint), 원본 불변 및 암호화 파일 hash 불변을 대조한다.
9. backup/restore 소요시간은 **해당 소형 합성 fixture**의 측정치다. 운영 RTO/RPO 보장·공간 산정값으로 승계하지 않는다. 종료 시 자신의 컨테이너/tmpfs·합성 암호문·복구 키를 모두 제거한다. 보존하는 것은 sanitized 요약/hash뿐이다. SSD/hostRAM의 물리적 secure erase를 보장한다는 뜻은 아니다.

이 경로는 실제 pg_dump/restore이며 Mock이 아니다. 반대로 Auth JWT/HTTP/Google/실계정/운영 DB/Windows PASS도 아니다.

## 복원 실패와 CLOSED 복구

- 키/해시/AEAD 오류: DB에 적용하기 전에 중단, 원본 암호문 불변 보존, 자동 key reset/무인 재시도 금지.
- role/owner/extension/managed schema 충돌: 원본 dump 수정/권한 확대 대신 범위·도구/대상 호환 재검토. 실제 운영에는 raw 역할 생성 SQL을 그대로 사용하지 않는다.
- schema/data 실패: ON_ERROR_STOP, transaction 가능한 부분 rollback. 실패 target을 운영에 연결하지 않는다. 별도 깨끗한 격리 target에서만 수정된 **검토 절차**를 재시험한다. global role 생성은 DB transaction 밖의 상태이므로 통째로 원복됐다고 주장하지 않고 이 리허설에서는 전용 컨테이너 자체를 제거한다.
- 성공 exit0도 완전성/CLOSED/FK/sequence 검사가 실패하면 FAIL이다. constraint/trigger/RLS assertion을 꺼서 수치를 맞추지 않는다.
- 복원 직후 앱 Gate CLOSED, core54와 addon2 CLOSED 확인 전 클라이언트 연결 금지. 불명확한 상태/권한 노출이면 신뢰된 owner 확인 후 별도 Instructor `02-emergency-close-addon.sql`과 D0 `03-emergency-close.sql`의 기존 검증 절차로 차단한다. 부분 schema/owner drift는 임의 role 이관 없이 BLOCKED.
- parent closed_unverified를 reinstall/QA activation으로 재개하지 않는다. 기존 P0/P1 분리 복구 PASS는 재사용하며 제품 SQL을 바꾸지 않는다. 실제 운영에 복원하거나 DROP/TRUNCATE로 롤백하지 않는다.

## 운영 백업 실행 전에 사용자 확정/승인 필요

| 필수 조건 | 현재 상태 |
|---|---|
| 지정 후보 endpoint 소유권·최종 범위·dump 계정과 기존 승인 credential/접속 경로 | 백업 실행 승인 없음. 비밀값을 채팅으로 요청하지 않음 |
| schema/table/sequence/role catalog 읽기, RLS 전체성, Auth/Storage 포함/제외와 객체 다운로드 권한 | 기존 설치 권한 결과와 별개. 백업용 권한/범위 미확정 |
| 접근제한 암호화 저장 위치·전송 TLS·키 분리 보관·복구/대체 담당자 | 미확정; 임의 폴더/인물 지정 금지 |
| 보존기간·삭제 책임/방법·감사 접근 | 미확정 |
| 데이터 규모·dump/암호문/복호화/restore·WAL/임시/복구 검증용 공간 | 운영 규모 미조회. 소형 합성 사용량으로 대체 불가 |
| 업무 쓰기 중단 창 또는 검증된 snapshot 공유·대상 업무 영향 | 허용 범위 미확정 |
| 목표 RPO/RTO 및 허용 손실·복원 담당/연락/중단 조건 | 미확정. 이번 초 단위 측정으로 임의 확정하지 않음 |
| 완전성 합격 기준 | 범위별 inventory/누락명세·row/FK/sequence/ACL/RLS/function·Storage bytes·migration·Auth 호환·CLOSED·실측시간 충족 필요. 실제 baseline 미확보 |
| 격리 restore 대상과 관리형 객체/extension 호환 권한 | 새 Supabase 프로젝트/유료 플랜 요구하지 않음. 기존 허가 환경의 가용 공간/권한 확인 필요 |

H2-P3로 과거 기본 권한 미확인 항목은 해소했지만 **운영 백업 추출 및 운영 설치는 계속 BLOCKED**다. 실제 백업/복원 증거, 보관/키/담당/시간·목표, 운영 적용 승인이 남아 있다. 운영 설치·OAuth·제한 계정·Gate 활성화는 각각 별도 승인이며 이번 작업으로 승인되지 않는다.

## 증거와 변경 범위

정확한 source/harness/SQL/image hash·tool versions·개별 검사·파일별 크기/hash·UTC·backup/restore 시간·누락목록·cleanup은 `school-workspace/hosted-h1/qa/h2-p4/evidence/`에 보존한다. 실제 암호화 백업/키는 업로드하지 않는다.
개발 중 fixture role 생성 순서, PostgreSQL17 grantor 실행 경계와 dump의 ACL/CHECK 표현 정규화 차이를 확인해 격리 restore 절차를 보완했으며 원본 제품/설치·복구 SQL은 수정하지 않았다. 실패한 중간 시도도 최종 PASS로 바꾸지 않고 sanitized 결과로 구분한다.

## 최종 결과

- 검증 Source: `c7b13d22bc827215379959a0c0adc431560ee6be`. 최종 **31 PASS**, PostgreSQL17.6, 원본 SQL/제품 변경 없음。
- 합성 user tables **46개**, rows **152개**, 암호화 파일 **6개**. 실제 운영 크기/테이블 수의 재현이 아니다.
- 측정: dump+암호화 0.444초, restore 적용 1.669초 (검증 포함 RTO 아님), 준비·검증·정리 포함 전체 25.193초. 운영 RPO/RTO는 미확정.
- source/runtime role 속성·멤버십, schema owner/실효 ACL, creator defaults 및 의미상 catalog 대조 PASS. 동결 installer fingerprint checked replay PASS. 원본 release/fingerprint는 갱신하지 않았다.
- `evidence/backup-restore.json`의 source/harness/image/SQL·파일별 평문/암호문 hash와 크기, tool version/UTC/누락목록 및 `SHA256SUMS`를 보존한다. 최종 증거 커밋은 실행 source를 재라벨하지 않는다.
- `evidence/development-attempts.json`에 중간 FAIL을 기록했다. ACL 비교는 OID/순서 대신 실효 권한 tuple로 대조하고, 멤버십은 grantor까지 정렬해 동일성 검사한다. source 원문 ACL/CHECK 형태는 별도 sidecar로 유지해 D0 지문 검사를 통과했다. assertion 제거/지문 갱신/제품 SQL 완화 없음.
- 실제 운영 백업/복원·Supabase CLI filtering·managed Auth/Storage API·OAuth/실계정·Windows: **NOT RUN**. 운영 설치/백업 추출: **BLOCKED (승인 및 보관/복구 조건 미확정)**. 합성 백업·격리 복원: **PASS**.
