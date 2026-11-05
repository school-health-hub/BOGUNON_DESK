# SCHOOL09CH2 A2 역할 분리·복구·API 검증

실제 코드/SQL 검증이다. 운영 Supabase 연결/변경은 없다.
기준78016384a304540a1097935f454501d84c1367a9에서 독립 feature/school-09ch2-authz-resolution.

## 상대경로 실행

루트에서 Python3/Bash/rg/Docker local socket이 필요하다. Node·제품 빌드는 필요 없다.

```bash
python3 school-workspace/school09ch2/tools/verify-inputs.py
python3 school-workspace/school09ch2/tools/build.py
bash school-workspace/school09ch2/run-local.sh
```

실행은 pinned PG17.6·PostgREST13.0.4, network:none, 외부 포트 없이 tmpfs에서 한다.
기존 동일SHA의177 DB/23 PostgREST/26경계 테스트를 반복하지 않는다.
이번에 바꾼 역할 분리·일부 실패·지문/lifecycle·실제 HTTP 영향만 검사한다.
합성 Auth·학교·계정·JWT만 사용하며 키는 메모리에만 두고 저장하지 않는다.

## 실행 계획

INSTALL_PLAN.json은 검증된 후보만 명시한다. operating eligible=false, 자동 활성화=false다.

1. 검토된 CLOSED S08 app이 선행조건이다. 로컬 baseline 준비는 이전 fixture/SQL 그대로 사용한다.
2. 01-provider-local.sql: 승인된 Auth-side principal만 실행. Auth 소유 bridge를 설치하며 Workspace 역할 SET 불필요.
3. 02-bind-workspace-local.sql: Workspace principal만 실행. Auth owner SET 없이 helper2개 연결/별도 release ledger 생성.
4. 모든54 RPC는 여전히 CLOSED. 03은 격리 QA에서만 별도 실행하는 활성화다.
5. 04-close-local.sql은 데이터 삭제 없이54 public/private 목적 함수 차단. drift는 closed_unverified다.
6. 05-hosted-readonly.sql은 ChatGPT에 전달하는 catalog SELECT뿐이다. 여기서 운영에 실행하지 않는다.

함수 본문4개와 public54 계약은 그대로다. Auth/Workspace 설치자에게 서로의 owner SET를 자동 부여하지 않는다.
실패한 접근/권한 없는 profile은 tests/evidence의 부정 시나리오이며 설치 목록에 포함하지 않는다.
이 결과는 전체 fresh Hosted migration이나 배포 승인이 아니다. 실제 프로젝트의 역할·FK·기본 설치 권한 및
Auth-owned custom function 지원은 별도 증거가 필요하다. 자세한 범위는 REPORT.md/DECISIONS.md 참조.
