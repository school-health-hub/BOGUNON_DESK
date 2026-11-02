# IM-1B-4A 로컬 WIP 인계

- 저장소: `BOGUNON_DESK-inventory`
- 브랜치: `feature/inventory-management`
- 재개 기준 HEAD: `613837eabc37b8c4f9484ac3fec19607f84bc178`
- 상태: IM-1B-4A 로컬 검증 완료
- 로컬 도구: Supabase CLI 2.121.0, Docker Server 29.8.0, 프로젝트 `inventory_qa`, 포트 56320–56327

## 구현 및 확인 상태

- 공통 응답 wrapper, depleted reversal의 `reactivation_required`, 일반 입고 명칭 계약을 구현했다.
- 최초 clean reset과 기존 회귀는 통과했으나 독립 검토에서 replay snapshot과 동시성 assertion 부족을 발견했다.
- replay 응답을 최초 완료 결과로 저장하도록 migration을 보강하고, 5개 RPC DTO 및 8개 혼합 경쟁의 결과 assertion을 보강했다.
- 보강 후 clean reset은 성공했다.
- 2026-11-02 보강된 HTTP/JWT, 혼합 동시성 8개 조합, 기존 78개 회귀, DB lint 및 Security Advisor를 재실행했다.
- 결과는 JWT PASS, 혼합 동시성 8/8 PASS, 기존 회귀 78/78 PASS, DB lint 오류 0건이다.
- canonical 계약은 마지막 확인 기준 34개 중 22 PASS, 12 PENDING이다.

## 월요일 재개 순서

```powershell
Set-Location -LiteralPath '<WORKTREE_ROOT>'
git status --short
pwsh -NoProfile -File inventory-management/qa/scripts/Invoke-LocalSupabase.ps1 start
npx --yes --package=supabase@2.121.0 -- supabase --workdir inventory-management/qa db reset --local --yes
pwsh -NoProfile -File inventory-management/qa/scripts/Invoke-IM1B4AHttpE2E.ps1
pwsh -NoProfile -File inventory-management/qa/scripts/Invoke-IM1B4AConcurrency.ps1
```

다음 단계는 별도 승인 후 시작한다. Inventory QA stack은 종료하고 volume은 보존한다.

## 차단 및 보안

- 운영 Supabase 접근, 운영 데이터 조회·변경, 실제 학교 데이터 사용은 0건이다.
- 기존 `medication_*`, BOGUNON/Purchase Helper/다른 worktree는 수정하지 않았다.
- gitleaks는 설치되어 있지 않아 정규식 기반 best-effort 검사만 수행했다. 변수명 `access_token`만 탐지됐고 실제 값은 저장되지 않았다.
- 클라이언트 bounded retry와 `INV-C07`은 `PENDING_IMPLEMENTATION`이다.
- 운영 DB, 백업/PITR, 실제 재고 권위 원본은 계속 미확인이다.
