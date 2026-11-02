# INV-CI-01 — Inventory PostgreSQL GitHub Actions QA

## 상태

**ENVIRONMENT BLOCKED (Actions 실행 미확보)**. 전용 workflow/QA 지원 코드와 정적 검증은 준비됐지만 실제 GitHub Actions run은 없다. 이번 사용자 승인은 로컬 commit까지이며 신규 CI 브랜치 원격 push는 승인되지 않았다. 기존 Cloud B 원격 push 승인은 `codex/inventory-im2b1-cloud-b` 하나에만 적용된다. 실제 PostgreSQL/Adapter 4개를 PASS 또는 READY로 기록하지 않는다. 현재 환경에 제품 결함이 재현됐다는 의미는 아니다.

- QA worktree: `/workspace/BOGUNON_DESK_INVENTORY_CI`.
- QA branch: `ci/inventory-postgres-integration-qa`, 기준 `ef0ba64cae5c0a6ccbba05a8821a80730dcfc087`.
- 기존 B worktree/브랜치와 `work`는 보존. A 원격 `codex/cloud-a-inventory-preview`는 `0c4472b6bf21ec5c6ed31773222f5c93abae5da0`로 확인했으며 변경하지 않았다.
- Workflow: `.github/workflows/inventory-db-integration-qa.yml`.
- 실제 run URL/ID: **없음 / NOT RUN**.
- Linux Actions 결과를 Windows Native 또는 Electron 실기기 결과로 표시하지 않는다.

## 실행 경로 및 정책

Supabase 로컬 DB/Auth/PostgREST/Kong은 Linux Docker 컨테이너다. `ubuntu-24.04` GitHub-hosted runner의 Docker Engine과 PowerShell Core를 사용한다. Node 24(Cloud B 기준), lockfile `npm ci --ignore-scripts`, Supabase CLI **2.121.0** 및 기존 integrity pin을 사용한다. action은 조회한 v4 SHA로 고정하며 checkout credential을 보관하지 않는다.

`workflow_dispatch`는 추가하지 않았다. GitHub API에서 main의 신규 workflow 경로는 404였으므로 feature 브랜치에만 있는 workflow를 수동 실행할 수 있다고 가정하지 않는다. **정확한 `ci/inventory-postgres-integration-qa` 브랜치 push**와 Inventory 관련 path 변경만 트리거다. `contents: read` 외 write 권한은 없으며 PR/Git push/배포 step이 없다. 기준 B의 다른 workflow에는 push 트리거가 없어 이 QA push가 다른 제품 배포를 시작하지 않는다. PR도 생성하지 않는다.

`run.mjs`는 GitHub Actions/Linux/정확한 repository/ref/push event 조건에서만 실행한다. 외부 Docker endpoint selector, 운영 Supabase env 이름, 운영 `.env`가 있으면 거절한다. config project_id inventory_qa와 API 56321을 검증한다. API_URL은 start/status 및 실제 Adapter runner에서 `http://127.0.0.1:56321`과 대조한다. Cloud/러너의 127.0.0.1은 해당 러너 자체이며 외부 프로젝트 DB로 fallback하지 않는다.

사용자 집 PC의 여유(디스크 1.71GiB/RAM 1.49GiB)는 재사용하지 않는다. CI는 Docker data-root 가용 **디스크 14GiB, RAM 3GiB** 미만이면 시작 전에 실패한다. 기존 inventory_qa 컨테이너가 있으면 reset하지 않고 실패한다. Docker CLI 응답/PowerShell/CLI integrity와 실제 `--help`를 먼저 확인한다. Cloud Docker 복구/이미지 다운로드는 이 작업에서 반복하지 않았다.

## 순차 실행

1. **preflight**: Node/PowerShell/Docker/자원/환경 격리/CLI integrity 및 start/reset/lint/stop help, 34개 역사 manifest 확인.
2. **start**: realtime/storage/imgproxy/mailpit/meta/studio/edge/logflare/vector/supavisor를 제외한 최소 스택. 단일 시도, 유한 timeout. 무한 재시도 없음.
3. **migration**: `db reset --local --no-seed --yes`, 적용 version 6개 순서와 공개 RPC 8개, 11개 테이블/RLS/FORCE RLS/GRANT/REVOKE 기준 검사.
4. **regression**: Prep, 기존 pwsh 17 tenancy + 17 ledger + 24 use/경합, SQL 20 admin = **78개**, 구매 SQL **15개**, 별도 INV-D06 exact SQL 1개.
5. **jwt**: 기존 실제 Auth JWT HTTP use/admin/purchase, 비활성 membership/강사/타학교/anon 거절, 직접 DML, admin 및 부분입고 경합.
6. **adapter**: 기존 `Run-IM2B1-local.mjs`로 실제 PostgreSQL/Auth를 호출하는 **4개 통합 테스트**. stdout의 4 PASS/skip 없음까지 확인. 기존 Mock 집중+Purchase Helper 순수 테스트, typecheck, Preview/Production zero-network 빌드는 별도로 실행한다. Mock을 실제 통합 결과로 합산하지 않는다.
7. **security**: `db lint --local --schema public,inventory_private --level error --fail-on error`, 기존 보안 catalog, 음수 재고/movement 산술/미완료 idempotency/초과입고 invariant 검사. audit 정합성은 기존 재고/부분입고/rollback/경합 assertion을 유지한다.
8. **stop**: `always()`지만 이 job이 start를 시도한 경우에만 `stop --project-id inventory_qa`. 다른 project/all stop/prune 없음. 서비스 시작/reset/종료는 병렬로 실행하지 않는다.

기존 QA 스크립트 중 Windows `netstat`를 사용하는 start wrapper는 호출하지 않는다. 기존 SQL/JWT/경합 스크립트는 PowerShell Core의 경로 provider와 .NET Process API로 실행하고 preflight에서 parser 검사한다. Linux 실동작은 아직 NOT RUN이므로 실제 러너에서만 최종 호환성을 판정한다. `Join-Path`를 우회하거나 제품 assertion을 완화하지 않는다.

## INV-D06 조사 및 정정

원래 `IM-1A-qa-contract.md`: 주문 10, 입고 4 → 재고 +4, `PARTIALLY_RECEIVED`. 현재 manifest는 PASS다.

`b2efb09ebb7bb10fb465714acbb702e445b69208`에서 구매 receipt SQL/Helper Adapter와 함께 manifest의 INV-D06 및 INV-P01~04가 PASS로 갱신됐다. 하지만 `Test-Prep.ps1`의 `$implementedContractIds`는 그 이전 22개 목록이었다. 현재 manifest는 27 PASS/7 PENDING이므로 D06부터 기대값 충돌이 난다.

근거:

| 계약 | 구현/검증 근거 |
| --- | --- |
| INV-D06 | 기존 구매 SQL B5-03: 주문 10 box, 4 box 입고, 변환비 10 → base 40, PARTIALLY_RECEIVED |
| INV-P01 | `purchaseHelperAdapter.test.ts`: candidate/line/item ID lineage 투영·역분류·재정렬 보존 21개 순수 검증 중 관련 assertion |
| INV-P02 | 구매 SQL B5-01/02: batch 생성·상태 전이만으로 lot 재고 증가 없음 |
| INV-P03 | 구매 SQL receipt 생성·movement/lot 및 원자성 assertion |
| INV-P04 | 구매 SQL B5-04/08 등: replay 중복 없음, 누적 40→70→100 |

과거 `IM-1B-6A-regression-results.md`는 clean DB 78/78 + 구매 SQL 15/15 + 실제 JWT/부분입고 경합 및 27 PASS/7 PENDING을 기록한다. 이것은 역사 근거이며 이번 CI run의 PASS로 대체하지 않는다.

**원인 분류: 3. Test-Prep 테스트 기대 목록 갱신 누락.** manifest/원래 계약/제품 RPC는 변경하지 않았다. QA branch에서 Prep 기대 목록에 이 다섯 계약을 동기화했다. 미구현 INV-P05/INV-C07/이관 계약은 PENDING 그대로다. 수정된 목록과 manifest의 완전 일치를 unit test로 검사한다.

기존 B5-03의 +40은 4 box×10 변환 결과다. 원래 D06의 문구를 보수적으로 그대로 확인하기 위해 `INV-CI-01-D06.sql`은 **ratio=1, 주문 10, 입고 4, stock+4, line received=4, RECEIVE movement 1개, PARTIALLY_RECEIVED**를 새 transaction 안에서 검사하고 rollback한다. 이것은 expectation 완화가 아니라 exact 사례의 추가다. 실제 PostgreSQL 실행 전에는 이 SQL을 PASS라고 표시하지 않는다. CI에서 계약 위반 시 그대로 실패한다.

## 출력/Artifact 보안

QA subprocess stdout/stderr에는 CLI key/token/합성 비밀번호가 포함될 수 있으므로 memory에서만 수집하고 출력/저장/upload하지 않는다. command 실패도 raw stderr나 Auth body를 내보내지 않는다. 기존 scripts가 만든 reports와 stack/Docker/Auth 로그는 artifact 대상에서 제외한다. 실제 credential, 운영 secrets, Supabase management API, 운영 migration, 실제 학교 데이터는 사용하지 않는다.

Artifact는 `inventory-postgres-summary-<run_id>`의 **`inventory-management/qa/reports/inv-ci-01/summary.json` 하나**만 허용한다. run/SHA, 정수 resource 수치, 고정 stage 상태/실패 분류, 명시적 통과 집계만 담는다. 토큰/비밀번호/이메일/SQL payload/DB dump/환경 dump를 담지 않는다. 최대 7일 보존한다. artifact 업로드 성공을 테스트 성공으로 해석하지 않는다. 현재는 실제 run이 없어 artifact도 없다.

실패 증거는 stage/check와 고정 분류로 제한한다: RUNNER_ENVIRONMENT, DOCKER_IMAGE_OR_START, MIGRATION, SQL_OR_CONTRACT, JWT_RLS_OR_CONCURRENCY, ADAPTER_INTEGRATION, PERMISSION_OR_INTEGRITY, CLEANUP_ENVIRONMENT. 임의의 backend 오류 문자열을 게시하지 않는다.

## 이번 Cloud에서 수행한 검사

- YAML parser: PASS (push branch/path, 최소 권한, 운영 secrets 참조 없음).
- actionlint 1.7.7: PASS (release archive checksum 검증 후 /tmp 도구로 사용, 전역 설치 없음).
- Node 문법 검사: PASS.
- 지원 코드 unit test 5개: PASS (자원 gate/엄격 SQL 집계/manifest D06/Prep 기대 목록 일치/외부 실행 문맥 차단).
- Inventory 집중 115 PASS, 실제 DB 4 SKIP; typecheck와 production 격리 빌드 PASS. 전체 기존 UI 회귀는 이번 QA 지원 파일 변경에서 반복하지 않았다.
- 실제 PowerShell Core/DB/SQL/JWT/Adapter/경합/lint: **NOT RUN**. Cloud에서 pwsh를 설치하거나 Docker를 재복구하지 않았다.
- 신규 workflow를 실행한 Actions run ID/URL: **없음**.

## 다음 승인과 실행

신규 브랜치 push는 이번 승인 범위가 아니다. 문서 포함 최종 QA SHA를 로컬 commit으로 보존한 뒤 다음 한정 승인이 필요하다:

> 최종 보고의 QA SHA를 `ci/inventory-postgres-integration-qa` 브랜치로 일반 push하여 Inventory QA workflow 1회를 실행하는 것만 승인합니다. Cloud A/B·Inventory feature·work·main 변경, PR·병합·배포·운영 Supabase 접근은 금지합니다.

승인 후 정확한 QA branch/SHA/clean/원격 동명 ref를 다시 확인하고 일반 push한다. push 트리거로 발생한 **해당 workflow·해당 SHA의 run**을 조회해 run ID/URL을 기록한다. 원격 push/실행 없이 READY로 올리지 않는다. workflow 실패는 위 분류로 조사하고 assertion을 줄여 수치를 맞추지 않는다.
