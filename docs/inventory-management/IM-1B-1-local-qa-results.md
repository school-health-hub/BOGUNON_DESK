# IM-1B-1 로컬 QA 결과

## 실행 방식

- SQL suite: `inventory-management/qa/tests/IM-1B-1-tenancy-rls.sql`
- Runner: `inventory-management/qa/scripts/Invoke-IM1B1Tests.ps1`
- 환경: `inventory_qa` local PostgreSQL
- 인증 모사: 실제 `authenticated`/`anon` DB role + local `request.jwt.claims`
- cleanup: 전체 fixture와 테스트 동작을 단일 transaction에서 실행 후 rollback

이는 실제 PostgreSQL RLS 실행이다. 실제 브라우저 JWT 로그인은 아니며, anonymous Data API 경로는 별도 live HTTP 검사로 확인했다.

## 결과

| 구분 | 결과 |
|---|---|
| 요청된 핵심 시나리오 | 14/14 PASS |
| 보조 보안 시나리오 | 3/3 PASS |
| 전체 suite | 17 PASS / 0 FAIL / 0 BLOCKED |
| clean local DB migration replay | PASS |
| Supabase DB lint, error level | PASS, schema error 0 |
| anonymous Data API | HTTP 401 |
| local Auth health | HTTP 200 |

두 번째 clean reset 과정에서 DB migration은 정상 적용됐지만 Docker의 부가 `storage` service가 일시적으로 unhealthy여서 전체 CLI 호출이 도구 제한시간을 넘겼다. DB health, migration replay, RLS suite, lint와 Data API는 이후 개별 명령으로 모두 통과했다. Storage는 이번 단계의 테스트 대상이 아니며 운영 준비 근거로 사용하지 않는다.

보조 테스트는 forged user metadata, helper EXECUTE 범위, teacher_admin의 제한된 품목 관리다.

## 기존 34개 계약

- 고유 ID: 34개 유지
- PASS: 4개 (`INV-S03`, `INV-S06`, `INV-S07`, `INV-S08`)
- PENDING IMPLEMENTATION: 30개

`INV-S01`은 재고 RPC가 없어 RPC 부분을 실행하지 못했다. `INV-S04`는 타학교 item 조회/FK 차단까지, `INV-S05`는 lot 조회 차단까지 검증했지만 후속 RPC·movement 범위가 남아 있어 기존 계약 상태를 PASS로 올리지 않았다.

## 재실행 명령

```powershell
./inventory-management/qa/scripts/Invoke-LocalSupabase.ps1 start
npm exec --yes --package=supabase@2.121.0 -- supabase --workdir inventory-management/qa db reset --local --no-seed
./inventory-management/qa/scripts/Test-Prep.ps1 -RequireRunning
./inventory-management/qa/scripts/Invoke-IM1B1Tests.ps1
```

