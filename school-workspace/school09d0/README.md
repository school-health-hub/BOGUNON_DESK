# SCHOOL-09D-0 최종 CLOSED 설치 후보

이 패키지는 운영 적용 승인이 아니다. 설치·Auth 실계정 시험·배포는 **BLOCKED**다.
기준 H3 `4cacc51d06298ee4118273388513be1599d67095`, 별도 `feature/school-09d0-final-preflight`.

## 정확한 순서

INSTALL_PLAN.json과 해시를 먼저 확인한다. 운영 승인 후 검토할 유일한 fresh 순서는 다음3개다.

1. `sql/00-hosted-preflight-select.sql` — 현재 설치 신원·권한·충돌·creator defaults·Data API 설정의 SELECT. **지금 별도 READ-ONLY 감사에 전달할 파일**이다.
2. `sql/01-install-closed-candidate.sql` — S01~09 누적 fresh 설치, 단일 transaction, public/private54쌍 기본 CLOSED.
3. `sql/02-postflight-select.sql` — 설치 후 개체·owner·RLS·ACL·FK·54 서명 인벤토리 SELECT. Workspace 미설치 서버에서 지금 실행할 파일이 아니다.

복구 전용 `sql/03-emergency-close.sql`은54쌍을 회수하고 `closed_unverified`로 표시한다.
데이터/역할/스키마 삭제나 지문 정상화, 자동 재활성화가 없다. 별도 bootstrap operator 명령은 계속 CLOSED이며 이 스크립트로 operator 권한을 부여/회수하지 않는다.
`tests/activate-local-only.sql`·`tests/strict-close-local-only.sql`은 격리 시험 전용, 설치 순서에서 제외한다.
과거 S06 foundation/Auth raw SELECT grant/A2/H2/H3 파일을 중복 적용하지 않는다.

## 후보의 실행 조건

실제 Supabase 기본 DB 이름과 같은 `postgres`, direct NOSUPERUSER `postgres` session을 요구한다.
`bogunon.workspace_target=xxownwxxajzrviuvvfiu`, `bogunon.workspace_plan=SCHOOL-09D-0:CLOSED` marker가 없으면 중단한다.
**marker는 사용자 설정값이며 endpoint/project 검증이나 사용자 승인이 아니다.** GATES.json/운영 체크리스트는 별도로 모두 충족해야 한다.
이 환경에서는 동일 후보 파일을 network:none Docker의 빈 `postgres` DB에서만 실행했다.
기존 Workspace schema/role/name 충돌은 중단하며 기존 설치를 덮어쓰는 upgrade 후보가 아니다.

## 로컬 재현

새 checkout 또는 ZIP의 source/에서 상대경로로 실행한다.

```bash
python3 school-workspace/school09d0/tools/verify.py
python3 school-workspace/school09d0/tools/build.py
bash school-workspace/school09d0/run-local.sh > school-workspace/school09d0/evidence/reproduced.log 2>&1
```

Python3/Bash/rg/Docker local socket 필요. PG17.6/PostgREST13.0.4는 digest로 고정했다.
Node/제품 의존성·실제 Supabase 키/DSN·사용자 계정은 필요 없다.
합성 Managed Auth/public sentinel을 준비하는 fixture_root만 SUPERUSER이며 **설치 신원은 아니다**.
설치 SQL 접속은 NOSUPERUSER postgres. Workspace DDL/업무 함수는 비BYPASS 역할이며 Auth primitive2개만 기존 postgres 권한을 사용한다.
실행기는 자기 전용 컨테이너만 만들고 ID로 정리한다. 외부 포트/Hosted 연결 없음.
JWT 서명재료는 메모리만 사용한다. 실제 사용자/학생 자료는 없다.

H3의 동일한161 함수 정의와 도메인137건은 기존 근거로 참조했다. 새 installation/ACL/recovery/HTTP 영향만 실행했다.
최종 results.json/final-run.log를 사용하고 중간44/45 PASS·schema-only 반복은 합산하지 않는다.
