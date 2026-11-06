# SCHOOL-09C-H3 — 지원 가능한 비공개 Auth 검증 경로

기준 `01647c13283b88e5a73b4c0542fe6d344129216f`, 브랜치 `feature/school-09ch3-supported-auth`.
운영 프로젝트 연결·변경 없음. **운영 적용 BLOCKED**, 검증 대상은 새 로컬 설치 후보다.

## 재현

새 checkout 또는 패키지의 `source/` 루트에서 실행한다. 절대 Cloud 작업 경로를 사용하지 않는다.

```bash
python3 school-workspace/school09ch3/tools/verify.py
python3 school-workspace/school09ch3/tools/build.py
bash school-workspace/school09ch3/run-local.sh > school-workspace/school09ch3/evidence/reproduced.log 2>&1
```

필요: Python3, Bash, rg, Docker local socket, pinned PostgreSQL17.6/PostgREST13.0.4 이미지,
Node 및 이 저장소 package.json/lock과 일치하는 의존성(Vitest5.0.1 등).
기존 검증 의존성을 사용했으며 버전 교체/네트워크 차단 우회는 하지 않았다.
새 환경에서는 승인된 npm 설치 절차로 의존성을 준비한다. xlsx403 등으로 준비가 실패하면 해당 Node 계약 시험은 NOT RUN이며 전체 성공으로 처리하지 않는다.
Python/SQL/API 실행에는 실제 Supabase 접속 문자열·키를 전달하지 않는다.

실행기는 별도 `bogunon-school09ch3-pg`만 만들고 ID로 정리한다. network:none, tmpfs, 포트 공개 없음.
PostgREST는 같은 컨테이너의 loopback에서만 실행한다. HS256 키/토큰은 메모리에만 두고 저장하지 않는다.
새 실행은 빈 DB에서 합성 Managed Auth와 기존 public sentinel을 먼저 만든다.
fixture_root SUPERUSER는 **합성 기존 환경 준비·테스트 fixture/관측용**이며 설치 SQL 실행자가 아니다.
실제 설치 접속자는 NOSUPERUSER postgres, Auth owner SET/CREATE 없음이다.
업무 DDL은 임시 NOBYPASSRLS 설치 역할로 수행하고 해당 역할을 같은 transaction에서 삭제한다.
Node의 docker-shim은 과거 시험의 DBA fixture 사용자명만 fixture_root로 매핑한다.
실제 RPC 호출 사용자 school_client/authenticated는 바꾸지 않는다. 원본 시험·제품 코드는 수정하지 않는다.

## 유일한 신규 설치 순서

`INSTALL_PLAN.json`과 SQL 해시를 확인한다.

1. `sql/01-fresh-local.sql`: 전체 S01A/C·S02·S03·S04·S07 업무 및 C의 CLOSED bootstrap을 한 transaction으로 설치.
2. 기본54 RPC 및 bootstrap operator 명령은 CLOSED. 자동 활성화 없음.
3. `sql/02-activate-qa-only.sql`: 별도 명시적 격리 QA 활성화. 운영 적용 명령이 아니다.
4. `sql/03-close-local.sql`: 54쌍 EXECUTE 회수, 데이터 삭제 없음.
5. `sql/04-hosted-readonly.sql`: 추가 카탈로그 SELECT 요청. 설치/시험 중 운영에 실행하지 않는다.

기존 A2/S06 raw Auth grant/foundation/H2 설치를 먼저 실행하지 않는다.
이것은 **fresh 전용** 후보이며 기존 Workspace schema/role이 있으면 충돌로 중단한다.
새 release 지문/manifest로 재실행을 검증한다. 이전 설치 장부를 덮어쓰지 않는다.
운영 guard 제거, Hosted 설치·로그인·Feature Gate 활성화는 별도 검토·승인 대상이다.
