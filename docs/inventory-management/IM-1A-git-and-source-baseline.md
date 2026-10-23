# IM-1A Git 및 소스 기준선

조사일: 2026-10-23 (Asia/Seoul)

## Git 안전 게이트

| 항목 | 결과 |
|---|---|
| Worktree | `C:\Users\sehwa\Documents\GitHub\BOGUNON_DESK-inventory` |
| Branch | `feature/inventory-management` |
| HEAD / IM-0 기준 | `97f9ee9a6fe6ba93b7bfb7a89707902c7b4f2d96` |
| Upstream | 없음 |
| Working tree | `docs/inventory-management/`만 untracked |
| `git diff --check` | 통과 |
| IM-0 문서 | 12개 존재, SHA-256 기록 후 보존 |
| 기존 worktree | 변경하지 않음 |

기본 BOGUNON checkout에는 기존 미커밋 파일 2개가 있고, 다른 DESK worktree에도 기존 변경이 있다. 이 작업은 어느 파일도 정리·수정하지 않았다. Purchase Helper는 `feature/purchase-helper-enhancement`, HEAD `888917b8...`, clean이었다.

## 지침

전역 `C:\Users\sehwa\.codex\AGENTS.md`를 확인했다. 저장소별 `AGENTS.md`는 발견되지 않았다. IM-0 문서 12개는 모두 untracked이며 원문을 수정하지 않았다.

## 근거 소스

- BOGUNON 물품관리 기준 ref: `codex/medication-lot-management` (`1191f3b683e3d0be819ed864cfb28b24513ce919`)
- 주요 SQL: `supabase/migrations/20260824232517_add_medication_administration.sql`, `20261006100000_add_medication_lot_disposal.sql`
- 저장 경로: `lib/medications/repository.ts`, 계산 경로: `lib/medications/domain.ts`
- Purchase Helper: `src/purchase/types.ts`, `purchaseDomain.ts`, `purchaseRepository.ts`, import/export 및 settlement 모듈

## IM-0 재분류

| 주장 | 판정 |
|---|---|
| Supabase 기반 물품관리 | VERIFIED (코드/SQL) |
| 품목·로트·구매계획·입고·예산 구현 | VERIFIED |
| 사용/폐기/정정 movement 원장 | NOT VERIFIED / 미구현 |
| 학교 공유·교사/강사 역할 | DESIGN PROPOSAL |
| RPC 기반 원자적 사용 차감 | DESIGN PROPOSAL |
| 운영 재고 권위 원본 | DECISION REQUIRED |
| 실제 운영 DB에 해당 migration 적용 | NOT VERIFIED |
| 백업/PITR 활성 상태 | NOT VERIFIED |

