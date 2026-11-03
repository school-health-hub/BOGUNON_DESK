# BOGUNON DESK Worktree Status

> 스냅샷 시각: 2026-10-23T15:03:08+09:00 (Asia/Seoul)
>
> 원격 기준: `origin/main` `97f9ee9a6fe6ba93b7bfb7a89707902c7b4f2d96`
>
> 주의: 이 문서는 실시간 상태가 아니다. 작업 전 해당 경로에서 `git status`, `git rev-parse HEAD`, upstream divergence를 다시 확인한다.

향후 스냅샷에는 명령으로 실제 측정한 날짜·시간·UTC offset 또는 IANA 시간대를 기록한다. 측정 시각을 확보하지 못한 과거 상태에는 임의의 시각을 기입하지 않고 `정확한 측정 시각 미확인`으로 표시한다.

dirty 표기는 `staged / unstaged / untracked` 파일 수다. `↑/↓`는 upstream 대비 ahead/behind다.

| 기능/용도 | 경로 | 브랜치 | HEAD | upstream | dirty | 구현 | QA | 통합/비고 |
|---|---|---|---|---|---:|---|---|---|
| Desktop probe | `BOGUNON_DESK` | `feature/desktop-surface-probe-9b1` | `160eec4` | origin 0/0 | 0/0/0 | PARTIAL | NOT VERIFIED | main 기준보다 뒤, 독립 probe |
| C2D2 cleanup | `BOGUNON_DESK-c2d2-cleanup` | `fix/desktop-surface-c2d2-cleanup-receipt` | `8cf151f` | origin 0/0 | 0/0/0 | PARTIAL | NOT VERIFIED | 미통합 |
| RendererSession | `BOGUNON_DESK-c2d2-renderer` | `feature/desktop-surface-c2d2-renderer-session` | `1574e46` | 없음 | 0/0/0 | PARTIAL | NOT VERIFIED | P-3 전 동시 작업이 local checkpoint 생성 |
| Dashboard v2 | `BOGUNON_DESK-dashboard-v2` | `feature/dashboard-mint-ivory-v2` | `b37c247` | origin 0/0 | 0/0/0 | IMPLEMENTED | PASS | 후속 branch, main과 divergence |
| 공문작업실 | `BOGUNON_DESK-documents` | `feature/official-document-enhancement` | `344cf66` | origin 0/0 | 0/0/0 | IMPLEMENTED | PASS | 개선분 미통합 |
| Education Video | `BOGUNON_DESK-education-video` | `feature/education-video-finder` | `8c2172f` | origin 0/0 | 0/17/2 | PARTIAL | BLOCKED | Vitest 실행 중 감지, 보호 필요 |
| MY FINANCE redesign | `BOGUNON_DESK-finance` | `feature/my-finance-2-redesign` | `dc6772c` | origin 0/0 | 0/0/0 | IMPLEMENTED | NOT VERIFIED | WIP 후속분 미통합 |
| Governance | `BOGUNON_DESK-governance` | `docs/project-governance` | `97f9ee9` | 없음 | 0/0/0 | PARTIAL | NOT RUN | P-2 문서 작성 전 스냅샷 |
| Inventory | `BOGUNON_DESK-inventory` | `feature/inventory-management` | `5e97478` | 없음 | 0/0/61 | PARTIAL | NOT VERIFIED | IM-1B 자산 포함, 보호 필요 |
| Newsletter | `BOGUNON_DESK-newsletter` | `feature/newsletter-studio` | `2ffadef` | 없음 | 0/0/0 | PARTIAL | NOT VERIFIED | `NS-2` WIP checkpoint, native QA pending |
| Purchase Helper | `BOGUNON_DESK-purchase` | `feature/purchase-helper-enhancement` | `888917b` | origin 0/0 | 0/0/0 | IMPLEMENTED | NOT VERIFIED | WIP 커밋, 미통합 |
| Surface UI | `BOGUNON_DESK-surface-ui` | `feature/desktop-surface-widget-ui` | `2c50e45` | 없음 | 0/0/0 | PARTIAL | NOT VERIFIED | 6-widget renderer preview, P-1 중 새 커밋 |
| Surface C2C2 CI | `BOGUNON_DESK-worktrees/desktop-surface-c2c2-registration` | `codex/desktop-surface-c2c2-registration` | `160ced0` | origin 0/0 | 0/0/0 | IMPLEMENTED | PASS | main 병합 이력 존재 |
| Finance backup limit | `BOGUNON_DESK-worktrees/my-finance-backup-size-limit` | `fix/my-finance-backup-size-limit` | `392b3dc` | origin ↑9/↓0 | 0/0/0 | IMPLEMENTED | NOT VERIFIED | 로컬 전용 커밋 9개 확인 필요 |
| Finance Phase 2 | `BOGUNON_DESK-worktrees/my-finance-phase2` | `feature/my-finance-phase2` | `1b6a138` | origin 0/0 | 0/0/0 | IMPLEMENTED | PASS | 후속 이력은 main 포함 여부 재검증 |
| Finance testable controller | `BOGUNON_DESK-worktrees/my-finance-phase2-testable-controller` | `ci/my-finance-phase2-testable-controller` | `d332f6c` | origin 0/0 | 0/0/0 | IMPLEMENTED | PASS | CI controller |
| Finance isolated QA | `BOGUNON_DESK-worktrees/my-finance-pr14` | `fix/my-finance-isolated-windows-qa` | `39b4834` | origin ↑1/↓0 | 0/0/0 | IMPLEMENTED | PASS | 로컬 커밋 1개 확인 필요 |
| Finance QA entrypoint | `BOGUNON_DESK-worktrees/my-finance-qa-entrypoint` | `ci/my-finance-qa-diagnostic-entrypoint` | `799d01b` | origin 0/0 | 0/0/0 | IMPLEMENTED | PASS | CI 진입점 |
| Finance testable gate | `BOGUNON_DESK-worktrees/my-finance-testable-gate` | `fix/my-finance-testable-publish-gate` | `e445370` | 없음 | 0/0/0 | IMPLEMENTED | PASS | upstream 없음 |
| Finance UI 2 | `BOGUNON_DESK-worktrees/my-finance-ui-2` | `feature/my-finance-ui-2` | `a1be553` | origin 0/0 | 0/0/0 | IMPLEMENTED | NOT VERIFIED | 후속 UI 후보 |
| v1 testable controller | `BOGUNON_DESK-worktrees/v1-integrated-testable-controller` | `ci/v1-integrated-testable-controller` | `9779b4e` | origin 0/0 | 0/0/0 | IMPLEMENTED | PASS | 통합 QA controller |
| Windows clean install evidence | `BOGUNON_DESK-worktrees/windows-clean-install-evidence-only` | `fix/windows-clean-install-evidence-only` | `183fb6f` | origin 0/0 | 0/0/0 | IMPLEMENTED | NOT VERIFIED | evidence-only branch |

## 보호 및 동시 작업 메모

- Inventory untracked 항목은 P-1 종료 시 53건, P-2 시작 시 60건, 이 스냅샷에서 61건으로 증가했다.
- Surface UI는 P-1 조사 도중 `b37c247` + dirty 24건에서 `2c50e45` clean으로 변경됐다. Governance 작업이 만든 변경이 아니다.
- P-2 작성 이후 RendererSession은 `1574e46`, Newsletter는 `2ffadef`의 clean local checkpoint로 다른 작업에 의해 변경됐다. Governance 작업이 만든 변경이 아니다.
- Education Video는 이 스냅샷에서도 19개 dirty 항목을 보존한다.
- 위 worktree의 dirty 파일, 로컬 전용 커밋, ignored 증거를 자동 정리하거나 통합 소스로 간주하지 않는다.
