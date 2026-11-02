# IM-2B-1 Cloud B 구현·독립 QA 결과

## 판정: CONDITIONAL

2026-11-02, Inventory 연결 계층 구현 및 실행 가능한 애플리케이션 검증 완료. 이번 Cloud에서 필수 Local PostgreSQL/Auth 통합 검증은 미실행이다. Mock을 PostgreSQL/RLS PASS로 계산하지 않는다. 운영 접근, Electron UI 연결 또는 실사용 승인을 의미하지 않는다.

## Git / 보호

- 원격 Inventory HEAD를 시작 시 직접 조회: `a765ad08570dc5513edf96bb970442026a0a31ce`, 인계 SHA와 일치.
- 독립 clone: `/workspace/BOGUNON_DESK_INVENTORY`.
- 작업 브랜치: `codex/inventory-im2b1-cloud-b`.
- 기존 `/workspace/BOGUNON_DESK`: `work`, HEAD `a7717f1e1b2234a568f8877adae8c42f8a4d262b`, clean 유지. reset/clean/rebase/checkout/fetch를 수행하지 않았다.
- 최초 두 저장소 모두 clean, 각각 worktree 1개. Inventory 저장소 내부에도 별도 linked worktree는 없다.
- 작업 저장소 및 상위 `/workspace`에 적용할 AGENTS.md 없음. 기존 Inventory 인계/보안/QA 계약, QA 포트, SQL migration/GRANT/RLS와 실제 UI/Purchase Helper adapter를 조사했다.
- Cloud A가 수정할 UI/Host/IPC/common/auth/Purchase Helper 제품 코드와 겹치는 변경 없음. 서버 migration 변경 없음.
- 원격 push, PR, main 병합, 배포 없음. 최종 로컬 commit HEAD는 완료 보고와 `git rev-parse HEAD`로 확인한다.

## 변경 파일

- `src/inventory-management/connection/contracts.ts`: 공개 DTO/인증/읽기/RPC 인터페이스.
- `index.ts`: 기본 Preview와 개발 전용 Local QA factory, Production 차단.
- `localQa.ts`: 독립 메모리 Auth/PostgREST, endpoint 검증, context epoch/abort, 읽기와 typed mutation 구현.
- `validation.ts`: 입력/수량/날짜/UUID/구조 검증, 안전하지 않은 JSON 수치 거절.
- `responses.ts`: RPC 응답 범위·대상·수량·중첩 movement/receipt 검증.
- `connection.test.ts`: Mock transport 집중 검증.
- `connection.local.test.ts`: opt-in 실제 JWT/SQL 연결·학교 격리·RPC·부분입고 경합 검증. 기본 실행에서는 4개 SKIP.
- `inventory-management/qa/scripts/Verify-IM2B1-production.mjs`: 독립 production public-entry 빌드 및 네트워크 차단 검증.
- `Run-IM2B1-local.mjs`: 이미 실행 중인 inventory_qa만 허용하는 실제 연결 테스트 runner, credentials 출력 없음.
- `Verify-IM2B1-scope.mjs`: 변경 경로 allowlist, 고확신 secret/PII 패턴 및 diff 공백 검사.
- `docs/inventory-management/IM-2B-1-cloud-a-contract.md`: Cloud A 호출/상태/오류/refresh/미지원 계약.
- `inventory-management/qa/tests/IM-2B-1-security-catalog.sql`: 로컬 RLS/FORCE RLS/ACL/search_path 읽기 전용 검사 (이번에는 NOT RUN).
- 이 결과 문서.

## 실행한 검증

| 항목 | 결과 |
| --- | --- |
| Node / npm | 24.19.0 / 11.9.0 |
| 의존성 | lockfile 기반 npm ci --ignore-scripts, 전역 설치 없음 |
| TypeScript | tsc --noEmit PASS |
| 연결 계층 Mock 집중 | 62 PASS |
| Inventory 전체 집중 | 115 PASS, 실제 Local integration 4 SKIP |
| 기존 Purchase Helper Adapter | 21 PASS (위 집중 합계 포함) |
| 기존 Inventory 순수/컴포넌트 | 32 PASS (위 집중 합계 포함) |
| 전체 JS/UI 회귀 | 1,316 PASS / 실제 Local 4 SKIP (186 test files PASS / 1 SKIP) |
| 기존 production build | npm run build PASS, 기존 chunk-size 경고 있음 |
| 독립 연결 entry production build | PASS: Local QA transport 미포함, Preview/거절 모드 fetch 0회 |
| 범위/secret/PII/diff | 13개 변경 파일 allowlist·고확신 secret/PII 패턴 검사 PASS, git diff --check PASS. 전체 DLP 검사라는 의미는 아님 |

Mock 검증에는 Preview zero-network, 외부/운영 endpoint·잘못된 loopback 포트·비개발 origin·privileged key 거절, fallback 없음, 로그인/로그아웃/만료, 두 client 독립 세션, 계정/학교 변경 후 stale 응답 폐기, 권한 거부와 빈 목록 구분, 강사 구매 차단, school filter와 타학교 응답 거절, Seoul-day 가용 재고, pagination, bigint 반올림 거절, 8개 SQL RPC DTO와 acknowledgement, 같은 UUID 재시도/중복 실행/변경 payload 거절, error redaction, item INSERT 경계를 포함한다.

새 모듈에는 Electron/UI wiring이 없다. 전체 기존 UI 회귀가 통과해도 신규 Electron UI/실기기 통합 검증을 의미하지 않는다.

## Local DB 시도 및 NOT RUN

Docker 데몬 28.4.0은 응답했고, 최초 실행 중 컨테이너와 이미지는 없었다. PowerShell/psql/Supabase 전역 CLI는 없었다. 기존 QA harness와 같은 Supabase CLI 2.121.0을 npm exec로 실행했고 npm integrity가 기존 pin과 일치함을 확인했다.

`inventory_qa` 전용 경로에서 비필수 서비스를 제외한 최소 start를 시도했다. 이미지 다운로드 과정에서 `public.ecr.aws` 접근 Forbidden이 발생했고 이어 `failed to register layer: no space left on device`로 실패했다. 해당 start 호출을 중단했다. 데몬 재구성, registry 정책 우회, privileged 재시작, 이미지/볼륨 prune, 전역 도구 설치, 외부 DB 대체는 하지 않았다. 이번 작업에서 실행 중인 inventory_qa 서비스는 확보하지 못했다. 기존 `bogunon` stack/프로젝트에는 작업하지 않았다.

다음은 이번 실행에서 모두 **NOT RUN**:

- clean migration 및 DB 회귀 78개 (17 tenancy + 17 ledger + 24 use/경합 + 20 admin).
- 구매 SQL 15개, 기존 JWT HTTP E2E, admin 경합 및 구매 부분입고 경합.
- 신규 연결 계층 실제 JWT/SQL 테스트 4개.
- 실제 PostgreSQL RLS/학교 간 격리·GRANT/REVOKE/catalog 및 DB lint.
- Windows/Electron 브라우저·실기기 UI QA (Cloud A 별도 범위).

이전 IM-1B-6A의 DB PASS는 인계 참고 자료이며 이번 새 연결 계층의 DB PASS로 재사용하지 않는다. Supabase changelog.md 조회는 네트워크 403으로 불가했고 연결 가능한 Supabase docs 검색으로 인증/세션·local signout 문서를 확인했다.

## 로컬 Windows 재현 명령

별도 Inventory clone의 root에서 실행한다. 운영 env 파일/자격정보를 복사하지 않는다. Docker Desktop과 Node 24, 기존 PowerShell QA 조건을 먼저 확인한다. 아래 start/reset은 **inventory_qa 전용 합성 환경**임을 확인한 뒤에만 실행하며 공유 중인 stack에는 reset하지 않는다. 키/비밀번호는 출력하거나 파일로 저장하지 않는다.

```powershell
npm ci --ignore-scripts
npx tsc --noEmit
npx vitest run src/inventory-management --maxWorkers=2
node inventory-management/qa/scripts/Verify-IM2B1-production.mjs
node inventory-management/qa/scripts/Verify-IM2B1-scope.mjs

Push-Location inventory-management/qa
# 기존 전체 start가 리소스 문제를 보이면 승인된 동일 최소 스택 사용:
npm exec --yes --package=supabase@2.121.0 -- supabase --workdir . start --exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
# 기존 합성 QA 상태를 지워도 되는 전용 stack에서만 clean migration:
npm exec --yes --package=supabase@2.121.0 -- supabase --workdir . db reset --local --no-seed --yes
./scripts/Invoke-IM1B1Tests.ps1
./scripts/Invoke-IM1B2Tests.ps1
./scripts/Invoke-IM1B3Tests.ps1
Get-Content -Raw ./tests/IM-1B-4-admin-rpcs.sql | docker exec -i supabase_db_inventory_qa psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres
Get-Content -Raw ./tests/IM-1B-5-purchase-receipts.sql | docker exec -i supabase_db_inventory_qa psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres
./scripts/Invoke-IM1B3HttpE2E.ps1
./scripts/Invoke-IM1B4AHttpE2E.ps1
./scripts/Invoke-IM1B4AConcurrency.ps1
./scripts/Invoke-IM1B5HttpE2E.ps1
./scripts/Invoke-IM1B5Concurrency.ps1
Get-Content -Raw ./tests/IM-2B-1-security-catalog.sql | docker exec -i supabase_db_inventory_qa psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres
npm exec --yes --package=supabase@2.121.0 -- supabase --workdir . db lint --local --schema public,inventory_private --level error --fail-on error
Pop-Location
node inventory-management/qa/scripts/Run-IM2B1-local.mjs
npm test -- --maxWorkers=4
npm run build
git diff --check
```

SQL 결과 SUMMARY 17/17 + 17/17 + 20/20 + 동시성4/4 + admin20/20 = 78, purchase15/15를 직접 확인한다. runner는 이미 healthy인 `supabase_db_inventory_qa`를 확인하고 로컬 CLI status의 API_URL을 정확히 대조한다. 생성된 synthetic Auth 계정의 비밀번호·token은 테스트 프로세스 메모리에서만 유지한다. 실제 테스트는 독립 synthetic 학교·사용자 UUID를 생성한다. append-only ledger fixture는 QA DB에 남으며 테스트 종료 후 다음 전용 reset에서 제거한다.

DB 권한 catalog는 기존 `IM-1B-6A-regression-results.md`의 검사 기준(RLS/FORCE RLS, 제한된 column INSERT 외 직접 DML 없음, anon/PUBLIC RPC EXECUTE 없음, SECURITY DEFINER 고정 search_path)을 실제 DB에서 다시 확인한다. 공식 Advisor 부재를 전체 보안 PASS로 바꾸지 않는다.

## Cloud A 인계 조건

공개 계약은 `IM-2B-1-cloud-a-contract.md`다. Cloud A는 UI를 연결하기 전에 위 실제 통합 4개와 기존 DB 회귀가 실행된 증거를 확보한다. 현재 상태는 구현 완료 / 필수 Local DB 검증 미실행의 CONDITIONAL이다. 운영 연결·migration 변경·보안 경계 완화를 통한 QA 통과를 하지 않는다.
