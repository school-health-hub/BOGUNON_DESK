# IM-1B-PREP 로컬 Supabase 구성

## 격리 구조

- Root: `inventory-management/qa/`
- Supabase workdir: `inventory-management/qa/`
- Config: `inventory-management/qa/supabase/config.toml`
- Project ID: `inventory_qa`
- Docker resource suffix: `_inventory_qa`
- Database volume: Supabase CLI가 `inventory_qa` label로 관리하는 전용 volume
- Remote link 및 remote URL: 없음
- seed와 제품 migration: 비활성·미작성

기존 로컬 스택과 충돌한 5432x 및 5532x 범위를 피하고 56320–56327을 고정했다. 시작 스크립트는 모든 포트가 비어 있거나 이미 동일 `inventory_qa` DB가 실행 중인 경우만 계속한다.

## 고정 도구 실행

`Invoke-LocalSupabase.ps1`은 Supabase CLI 2.121.0을 `npm exec --package=supabase@2.121.0`으로 실행한다. 실행 전에 npm registry의 패키지 무결성 값을 고정값과 비교하며, 전역 설치나 PATH 수정은 하지 않는다.

`status`는 Supabase CLI의 자격증명 출력을 사용하지 않고 Docker의 해당 프로젝트 서비스 상태만 표시한다. `start`와 `stop`은 credential-bearing stdout을 노출하지 않으며, 비민감 CLI 경고는 stderr에 나타날 수 있다.

## 실행 절차

```powershell
cd inventory-management/qa
./scripts/Test-Prep.ps1
./scripts/Invoke-LocalSupabase.ps1 start
./scripts/Test-Prep.ps1 -RequireRunning
./scripts/Invoke-LocalSupabase.ps1 status
./scripts/Invoke-LocalSupabase.ps1 stop
```

`stop`은 전용 stack만 중지하며 volume을 삭제하거나 DB를 reset하지 않는다.

## IM-1B 이후 순서

1. 계약용 schema migration을 로컬 전용 branch에서 작성한다.
2. 합성 fixture만 적용한다.
3. RLS, GRANT/REVOKE, cross-tenant FK를 우선 검증한다.
4. 재고 RPC를 입고, 사용, 폐기, 정정, 취소 순으로 추가한다.
5. 동시성·멱등성·FEFO를 로컬 DB에서 검증한다.
6. 운영 확인 게이트를 별도로 통과하기 전에는 remote link나 db push를 금지한다.

