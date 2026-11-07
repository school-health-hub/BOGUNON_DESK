# SCHOOL H2-P5 — 운영 백업 승인용 최종 실행 준비

제품37ed6d4, 출발 QA2aa59cf. 새 브랜치 `qa/school-h2-p5-backup-readiness`.
**운영 연결/추출/설정 변경 없음.** H2-P4 PostgreSQL17.6 합성31 PASS는 그대로 재사용하며 SQL/Windows/전체 H1 테스트를 반복하지 않았다. 준비 파일과 운영 승인 조건만 확정한다. 새로운 QA 단계 승인을 요구하지 않는다.

## 최신 문서·도구 확인

2026-11-07 문서 MCP 및 공식 CLI 소스를 대조했다.

- [공식 backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [CLI dump reference](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Platform→self-hosted restore](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
- [CLI3 release](https://github.com/supabase/cli/releases/tag/v3.0.0), 2026-11-02: npm 최신3.0.0 및 실제 `--version`/`db dump --help` 확인. 기본local, `--remote`로 대상 지정; 예전 `--db-url`/`--linked`와 혼용 금지.
- CLI **2.121.0** 실제 version/help 확인: `--db-url`, `--schema`, `--role-only`, `--data-only`, `--use-copy`, `--exclude`, `--dry-run` 지원. CLI 소스 tag commit `97531eb590ccd2c5cf215287ae03e877180810b4`에서 포함/제외 및 스크립트를 확인했다. 최신 버전이라고 자동 업그레이드해 검토한 명령을 바꾸지 않는다. 두 버전의 help만 실행했고 DB dump/dry-run/link/login은 실행하지 않았다.
- changelog index HTTP fetch는 proxy403으로 미확인. 우회하지 않았다. 공식 release와 고정 소스의 변경 근거를 대신 기록한다.

**실행 환경:** 승인된 비공개 POSIX 호스트, local Docker Engine, digest 고정 PostgreSQL17.6 도구, Python+cryptography AESGCM. GitHub-hosted runner/공유 Cloud artifact에 운영 dump를 저장하지 않는다. Windows C: 대용량 작업 금지; Windows에서 직접 실행하려면 승인 F: 경로와 NTFS ACL/키 보관 검토가 필요하다. 현재 offline 도구는 POSIX 권한만 검증하며 Windows를 자동 PASS 처리하지 않는다.

**실제 dump 경로:** 아래는 CLI2.121.0의 **변경하지 않은 공식 dump 필터 스크립트**를 고정 pg17.6 컨테이너에서 사용하는 명시적 실행 절차다. CLI 전체 orchestration의 managed 접속/임시 login-role 발급/자동 fallback은 사용하지 않는다. dump 컨테이너에 TLS/CA/승인된 PG*를 명시해 전달하기 위함이다. CLI `toDumpEnv`의5개 기본 PG 필드만 보고 SSL 설정 전달까지 보증하지 않는다. 공식 scripts/정책 목록은 `school-workspace/hosted-h1/qa/h2-p5/official-2.121.0/`에 MIT 고지·출처·hash와 보존한다. 이것은 새 SQL installer가 아니다.

## 정확한 포함/제외 — 고정2.121.0 기준

공식 문서의 “auth/storage 제외”는 schema dump와 data dump에서 다르므로 분리한다.

| 모드 | 포함 | 제외/제한 |
|---|---|---|
| default schema | 사용자 schema/table/function/owner/권한/RLS/policy/default ACL 등 | auth/storage/extensions/supabase_migrations 및 내부/확장 schemas 제외. 일부 reserved owner/ACL/event trigger/publication 등을 필터링. 완전한 cluster schema 복제 아님 |
| default data+COPY | 사용자 데이터와 **auth/storage 데이터도 포함 가능**; sequence setval | schema 모드와 다른 exclude 목록. auth.schema_migrations/storage.migrations/supabase_functions.migrations 및 supabase_migrations 등 제외. extension/vault/internal 제외 명세 확인 필수 |
| role-only | custom role/허용 속성·멤버십/일부 설정 | reserved role CREATE/ALTER 및 일부 grants/슈퍼 속성·role passwords 제외. 원본 cluster role dump/P4 결과와 동일하지 않음 |
| explicit `--schema` equivalent | 지정 schema 범위 선택 | 기본 제외 목록을 대체하므로 무심코 auth/storage 전체 schema를 재생성하지 않음. 아래 history만 별도 지정 |
| migration history | 별도 schema/data로 supabase_migrations 보존 | Auth/Storage 엔진 내부 migration 테이블을 앱 migration 이력과 혼동하지 않음 |
| Auth | 승인된 data 범위에서 users/identities 등 보존 가능 | 관리형 schema/extension/provider·JWT secret/키·세션 복원 호환 별도. 기존 토큰이 다른 복원 환경에서 유효하다고 보장 안 됨. 계정 정보가 들어가므로 운영 추출 승인 필수 |
| Storage | buckets/objects 등 DB metadata | **실제 object bytes 미포함**. 별도 승인된 다운로드 권한/암호화 보관·경로/크기/hash 대조 필요 |
| OAuth/프로젝트/외부 비밀 | 별도 설정 inventory·보관 의존성 명세 | dump로 provider secret/JWT signing keys/SMTP/Edge Function 코드·secrets/custom domain 등이 모두 보존되는 것은 아님. 변경·재발급 금지 |

data 스크립트는 restore용 `SET session_replication_role=replica`를 출력한다. dump 시 운영 DB에서 이를 실행하는 것이 아니다. 복원 시 trigger/FK가 비활성화될 수 있으므로 단순 restore exit0/constraint validated flag만으로 무결성 PASS 금지. 원래 FK 관계에 대한 anti-join/고아행 검사와 별도 검증 계획을 적용하고, triggers/RLS는 최종 정상 상태를 확인한다. 원문 파일을 임의 편집해 누락을 숨기지 않는다.

## 오프라인 사전검사 및 암호화 필터

- `preflight.py`: plan/경로·소유권/권한·symlink/Git 저장소 여부·키/출력 분리·공간·암호화 메모리 한도만 검사. network/subprocess/DB 접속/credential 내용 읽기 없음. 승인기록 필드 존재는 사용자 승인 진위를 자동 인증한다는 뜻이 아니다.
- `plan.example.json`: 모든 보관처·담당자·기간·공간/RPO/RTO·restore target·snapshot 계획은 UNASSIGNED. 실제 값은 사용자 승인 후 repo 밖0600 plan에만 채운다. 현재 template는 의도적으로 BLOCKED.
- `seal.py`: 승인 plan을 다시 검사하고 stdin을 한도 내 메모리에서만 읽어 AES-256-GCM으로 암호화. 키32bytes는 별도0700 root/0600 파일, 출력은 지정0700 root에 O_EXCL/0600으로만 생성. 평문 SQL 파일/기본 키/자동 키 발급 없음. 입력이 한도를 넘으면 중단하며 임의 temp 평문으로 우회하지 않는다.
- 파일명은 `.aesgcm.unverified`: producer 실패/partial SQL도 암호화될 수 있으므로 **pipeline 전체 성공+범위 inventory+격리 복원 합격** 전 backup complete로 표시하지 않는다. stderr에 raw SQL/credential/경로를 출력하지 않는다.
- host 메모리와 process 환경/daemon inspect를 볼 수 있는 사용자가 신뢰되는 전용 환경이어야 한다. 키는 output/artifact/Git과 분리하고 별도 승인된 복구 담당자가 접근할 수 있어야 한다. 기존 키가 없으면 보관/발급 방식 승인 전 BLOCKED.
- 파일-level AEAD 외에 summary/설정 파일도 포함한 승인된 저장소의 at-rest 암호화를 사용자/담당자가 확인해야 한다. POSIX0700만으로 디스크 암호화가 증명되는 것은 아니다.

오프라인 실행(운영 연결 없음):

```sh
python school-workspace/hosted-h1/qa/h2-p5/preflight.py /approved/private/plan.json
```

## 승인 후 실제 실행할 명령 — 이번에는 실행하지 않음

아래 `<...>`는 승인 후 채울 위치다. 기본값/임의 접속 경로는 제공하지 않는다. 실행 전 사용자 승인 기록, exact target·scope·snapshot/쓰기 중단 창, 보관/키/권한/공간, 도구 image hash와 사용 명령을 최종 대조한다.
비공개 `DB_ENV`는 승인된 PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE, `PGSSLMODE=verify-full`, `PGSSLROOTCERT=/run/server-ca.crt`, `PGOPTIONS=-c default_transaction_read_only=on` 및 승인된 연결/실행 timeout만 포함한다. direct/session pooler 중 승인된 경로 하나만 사용, transaction pooler/다른 ref/자동 fallback 금지. CA 파일은 검증된 신뢰 체인으로 공급하며 TLS 검증 실패 시 중단한다. 새 PAT/임시 login role/비밀번호 reset 불필요·금지.

```bash
# 승인 후 전용 비공개 POSIX 호스트에서만. set -x/debug/터미널 dump 출력 금지.
set +x
set -euo pipefail
umask 077
trap 'rc=$?; printf "%s\n" "BACKUP_ABORTED_REVIEW_PRIVATE_RUN_STATE" >&2; exit "$rc"' ERR
PLAN='<승인된-repo밖-plan.json>'
DB_ENV='<승인된-0600-PG-credential-env-file>'
CA='<검증된-CA-file>'
OUT='<plan과-일치하는-비공개-암호화-저장소>'
QA='<검토한-checkout>/school-workspace/hosted-h1/qa/h2-p5'
SCRIPTS="$QA/official-2.121.0"
IMAGE='postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
python "$QA/preflight.py" "$PLAN" > /dev/null
# DB_ENV/OUT/CA가 승인 plan·대상과 일치하는지 담당자가 확인. 값/내용 출력 금지.
# local Docker socket만 사용; 승인된 cached image가 없으면 자동 pull하지 않고 중단.
policy() { python -c 'import json,sys;print("|".join(json.load(open(sys.argv[1]))[sys.argv[2]]))' "$SCRIPTS/policy.json" "$1"; }
run_dump() {
  docker --host=unix:///var/run/docker.sock run --rm --pull=never \
    --env-file "$DB_ENV" \
    --env "EXCLUDED_SCHEMAS=$2" --env "INCLUDED_SCHEMAS=$3" \
    --env "EXTRA_FLAGS=$4" --env EXTRA_SED= \
    --env "RESERVED_ROLES=$(policy reservedRoles)" \
    --env "ALLOWED_CONFIGS=$(policy allowedRoleConfig)" \
    --mount "type=bind,src=$SCRIPTS,dst=/run/templates,readonly" \
    --mount "type=bind,src=$CA,dst=/run/server-ca.crt,readonly" \
    --entrypoint bash "$IMAGE" "/run/templates/$1.sh"
}
# 아래는 각각 순차 실행. 한 명령이라도 실패하면 이후 실행 금지.
run_dump roles '' '' '' 2>/dev/null |
  python "$QA/seal.py" "$PLAN" roles > "$OUT/roles.summary.json"
run_dump schema "$(policy schemaExcluded)" '' '' 2>/dev/null |
  python "$QA/seal.py" "$PLAN" schema > "$OUT/schema.summary.json"
run_dump data "$(policy dataExcluded)" '*' '' 2>/dev/null |
  python "$QA/seal.py" "$PLAN" data > "$OUT/data.summary.json"
run_dump schema '' '' '--schema=supabase_migrations' 2>/dev/null |
  python "$QA/seal.py" "$PLAN" history-schema > "$OUT/history-schema.summary.json"
run_dump data '' supabase_migrations '' 2>/dev/null |
  python "$QA/seal.py" "$PLAN" history-data > "$OUT/history-data.summary.json"
# producer/consumer exit codes, inclusion/exclusion/inventory/hash와 복원 증거가 모두
# 합격하기 전에는 .unverified를 complete로 바꾸지 않는다.
```

이 명령은 DB 읽기를 발생시키므로 현재 실행 금지다. scripts의 `EXCLUDED_SCHEMAS` 등 env는 위 검토된 policy에서만 만들며 credential env에 임의 EXTRA_FLAGS/명령을 넣지 않는다. 무인 운영 실행기가 아니며 plan과 shell 변수/대상/CA의 동일성 확인을 생략할 수 없다. 원본 보관 전에는 reserved 관리형 객체/Storage bytes/설정 제외 inventory를 확정해야 한다. 기본 data 범위의 auth 개인정보도 승인에 명시한다.

## 격리 복원 실행 절차

추출된 운영 데이터는 실제 개인정보이므로 기존 승인된 접근제한 격리 환경/복원 담당자 외에 공유하지 않는다. 운영 DB로 restore하지 않는다.

1. producer/pipeline 성공·암호문/manifest hash/범위·CA/도구 version 기록 확인. key 분리 보관 및 AESGCM tag 검증 후 평문은 RAM/승인된 암호화 stage에서만 처리.
2. PG17.6/확장/managed Auth·Storage 버전/예약 역할·source owner/grantor 호환성 확인. 새 Supabase 프로젝트 생성/유료 전환 요구하지 않음. managed 객체 없는 vanilla DB에 CLI schema/data를 무조건 적용하지 않는다.
3. custom roles→사용자 schema→데이터→별도 history 순서, ON_ERROR_STOP 및 검토된 transaction 적용. role 단계는 cluster 상태이므로 실패 DB transaction만으로 모두 원복됐다고 하지 않는다. 실패한 전용 대상은 격리하고 안전한 새 대상에서만 재시도.
4. 공식 role/default ACL 필터 때문에 target의 broad defaults가 과권한을 만들 수 있다. 기존 운영 default ACL을 바꾸지 말고 **격리 restore target에서만** 새 객체 effective ACL을 원본 승인 metadata와 비교/정규화. source/hash/허용 작업 기록 없이 자동 권한 확대/관리 역할 DROP 금지.
5. P4의 ACL 기본 표현/CHECK AST 문제는 54+2가 설치된 덤프의 향후 복원 시 고려한다. 현재 운영에는 아직 SCHOOL 객체가 없으므로 P4 sidecar를 실제 운영 dump에 무작정 적용하지 않는다. 저장 지문을 새 값으로 덮어써 일치시키지 않는다.
6. table/inventory/건수/참조 anti-join/sequence current+next·ACL/defaults/owner/RLS/FORCE/functions/trigger/migration history/Storage bytes+metadata/Auth 지원 범위를 대조하고 누락목록을 기록. 원본 데이터 자동 변경·실계정 로그인·외부 API 호출 없이 검증한다.
7. restore 적용시간과 검증 포함 총 복구시간, 백업 기준시점/일관성·실측 RPO를 별도 기록. 사용자 목표와 비교; 합성31 PASS를 실제 운영 복원 합격으로 승격하지 않는다.
8. 정상/실패 모두 자신이 만든 프로세스·container·평문 stage/키 노출 여부를 확인한다. 승인 보존기간 내 원본 ciphertext와 분리 키는 임의 삭제하지 않는다. 실패는 generic stage/exit code만 공개, raw SQL/log/credential/개인정보는 비공개 보존 정책에 따른다.

## 최종 승인 항목 — 두 범위 분리

**A. 실제 운영 백업 실행 승인:** 지정 BogunOn/ref 및 접속경로/기존 credential 담당자; Auth/Storage/migration/역할·업무 data 포함·제외와 객체 bytes/설정 별도 보존; 비공개 암호화 저장소·키/복구 담당·접근자; 실제 크기에 따른 공간/메모리; 보존/삭제 정책; 정지창 또는 검증된 일관성 방법; RPO/RTO·복원 target/합격 기준. 미확정 값은 plan UNASSIGNED로 유지한다. 승인 범위는 dump/안전한 격리 restore만이며 운영 설정 변경이 아니다.

**B. 이후54+2 CLOSED 설치 승인:** 실제 운영 백업/격리 restore 합격 증거와 최신 호환성/보안 검토를 확인한 뒤 exact SQL/hash/대상·시간창·담당자·원본 불변 postflight/긴급 CLOSED 절차 승인. 54 manifest와 Instructor2를 별도 유지. 이는 A의 승인에 포함되지 않는다. OAuth 변경/실계정/일반 Gate 활성화/배포는 또 별도다.

**준비 판정:** 소스/문서/오프라인 도구 준비 완료. 실제 운영 실행은 **BLOCKED — A의 값·승인 미확정**. 새로운 임의 QA 단계를 만들지 않고 위 A만 확정되면 승인된 범위에서 실행을 시작할 수 있다. 실제 managed dump/restore 호환성 결과는 그 실행의 증거로 확인한다. 제품·원본 SQL·integration/main·Workspace CLOSED는 보존한다.

## 검증 범위

오프라인 안전검사6개: 비공개 plan, 승인 미입력 거부, symlink 거부, 공유 권한 거부, 공간 부족 거부, AESGCM 왕복/기존 파일 덮어쓰기 거부. 이는 합성 SQL/Windows/운영 테스트가 아니며 P4의31 PASS와 합산하지 않는다. 비밀정보 패턴·diff 검사 및 공식 template hash 대조 결과를 QA evidence에 보존한다.

## 기존 P5 실행 환경 확인 반영 (2026-11-07)

확인 기준251f013. 새 브랜치/QA 단계/합성 SQL·Windows 재검증 없이 현재 환경만 조사했다.

- Linux x64 Cloud, Docker28.4.0, 고정 PostgreSQL17.6 이미지 cached. pg_dump/pg_dumpall/psql17.6은 network-none 일회 컨테이너의 version만 실행, DB 시작/연결 없음. Supabase2.121.0은 npm offline cache로 version 확인. Python cryptography50.0.0 사용 가능.
- /workspace 여유21,500,297,216 bytes, 관찰 메모리17,885,106,176 bytes. 운영 크기/복원/암호화 budget이 없으므로 충분하다고 승인하지 않음. host 기본 pg_dump/psql/supabase executable은 없지만 위 고정 경로로 실행 가능해 도구 부재 차단은 아님. 추가 설치/다운로드 없음.
- 현재 managed 환경 secrets/runtime vars/outbound identity 미설정. 알려진 PG/Supabase credential env와 표준 .pgpass/.pg_service.conf 없음. 기존 H2 작업 위치의 승인 plan 후보 없음. 이는 사용자 다른 PC/보관소에 credential이 없다는 단정이 아니다. 연결된 문서 MCP를 dump credential/실행 승인으로 간주하지 않음.
- 승인된 보관처/키 경로가 없으므로 실제 ACL·at-rest 암호화·키 분리·해당 volume 공간 검사는 NOT RUN. 일반 workspace를 승인 암호화 저장소로 대체하지 않았고 비밀파일/개인 폴더 전역 검색·키 발급·credential 생성 없음. 기존 P5 preflight/seal 원문 무변경. plan 미확정 상태에서 임의 값으로 preflight PASS를 만들거나 합성 테스트를 반복하지 않음.
- 실제 남은 조건: 기존 승인 credential과 접속 경로의 안전한 공급, 승인 암호화 보관처/분리 키·복구 담당자/보존·공간·복원 budget·RPO/RTO·일관성 plan, 운영 백업 실행 승인. 값이 준비되면 **기존** preflight/실행 절차를 사용한다. 새로운 QA 단계는 추가하지 않는다.
- 현재 **도구 실행 가능 / 운영 백업 실행 BLOCKED**. 제품/integration/main·운영 DB·Gate 무변경. 세부 확인은 기존 evidence/readiness.json의 executionEnvironmentCheck에 보존한다.
