# BOGUNON DESK Feature Specs Index

> 기준: `origin/main` `97f9ee9a6fe6ba93b7bfb7a89707902c7b4f2d96`, 기능별 브랜치는 각 문서에 별도 표시

이 폴더는 제품 수준의 공식 기능 계약과 기존 구현·QA 증거의 위치를 연결한다. 기능 브랜치의 상세 설계·QA 문서를 복제하지 않는다. 각 문서의 구현·QA 상태는 근거 SHA 시점의 판단이며 현재 Git 상태는 반드시 [Worktree Status](../WORKTREE_STATUS.md)와 실제 worktree에서 다시 확인한다.

| 기능 | Spec | 구현 | QA | 통합 |
|---|---|---|---|---|
| Desktop Surface | [desktop-surface.md](desktop-surface.md) | PARTIAL | NOT VERIFIED | 미통합 후속 작업 존재 |
| Dashboard / Dock | [dashboard.md](dashboard.md) | INTEGRATED | PASS | main 포함 |
| Official Document Helper | [official-document-helper.md](official-document-helper.md) | IMPLEMENTED | PASS | 개선 브랜치 미통합 |
| Purchase Helper | [purchase-helper.md](purchase-helper.md) | IMPLEMENTED | NOT VERIFIED | enhancement 미통합 |
| Inventory Management | [inventory-management.md](inventory-management.md) | PARTIAL | NOT VERIFIED | 미통합 |
| Newsletter Studio | [newsletter-studio.md](newsletter-studio.md) | PARTIAL | NOT VERIFIED | 미통합·미커밋 |
| PDF & Image Tools | [pdf-image-tools.md](pdf-image-tools.md) | PLANNED | NOT RUN | 없음 |
| Education Video Finder | [education-video-finder.md](education-video-finder.md) | PARTIAL | BLOCKED | 미통합 |
| Record Helper | [record-helper.md](record-helper.md) | IMPLEMENTED | NOT VERIFIED | main 포함 |
| MY FINANCE | [my-finance.md](my-finance.md) | INTEGRATED | PASS | main 포함 |
| Workspace Library | [workspace-library.md](workspace-library.md) | PLANNED | NOT RUN | 없음 |
| 일정 및 업무 관리 | [schedule-and-task-management.md](schedule-and-task-management.md) | INTEGRATED | PASS | main 포함 |
| 외부 서비스 연동 | [external-integrations.md](external-integrations.md) | PARTIAL | NOT VERIFIED | 일부 main 포함 |

상태 정의는 [Master Plan](../../BOGUNON_DESK_MASTER_PLAN.md#8-상태-정의)을 따른다.
