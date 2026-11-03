# BOGUNON DESK Project Instructions

이 지침은 이 저장소와 모든 worktree의 BOGUNON DESK 작업에 적용된다. 전역 `AGENTS.md`와 같은 디렉터리의 `AGENTS.override.md`가 있으면 해당 상위 규칙과 우선순위를 먼저 따른다. 이 문서는 전역 보안, 승인, Git 보호, 개발 종료 및 PC handoff 규칙을 약화시키지 않는다.

## 필수 읽기 순서

작업을 시작하기 전에 다음 순서로 확인한다.

1. 적용되는 전역 및 상위 `AGENTS.md` / `AGENTS.override.md`
2. [BOGUNON_DESK Master Plan](BOGUNON_DESK_MASTER_PLAN.md)
3. [Feature Specs Index](docs/FEATURE_SPECS/README.md)와 관련 기능 문서
4. [Decision Log](docs/DECISION_LOG.md)
5. [DESIGN.md](DESIGN.md) 및 [Design Variants](docs/DESIGN_VARIANTS.md)
6. 실제 repository, branch, HEAD, upstream, working tree, worktree 상태

문서의 상태 스냅샷을 실시간 Git 상태로 간주하지 않는다.

기능별 작업을 시작할 때 공식 Governance 문서가 기준으로 삼는 branch와 commit SHA를 확인하고 작업 기록에 남긴다. 현재 기능 브랜치의 Governance 문서가 공식 기준보다 오래되었거나 내용이 다르면 최신 공식 문서를 읽기 전용으로 비교하고, 적용 충돌·누락·stale 상태를 사용자에게 보고한다. 문서 차이만을 이유로 기능 브랜치에 merge, rebase, cherry-pick 또는 파일 복사를 자동 수행하지 않는다.

## 작업 전 검사

- repository owner, remote, 현재 branch와 HEAD를 확인한다.
- `git worktree list --porcelain`로 같은 기능의 다른 작업을 확인한다.
- staged, unstaged, untracked, ignored, unpushed commit과 진행 중 Git operation을 확인한다.
- 같은 기능이나 유사 기능이 이미 코드·branch·worktree·Feature Spec에 있는지 검색한다.
- dirty·untracked 자료의 소유권과 보존 필요성을 확인하고 임의로 stash/reset/clean하지 않는다.
- `origin/main` 최신성이 필요한 작업은 안전 조건과 사용자 범위 안에서 fetch 후 SHA를 고정한다.

## 상태와 완료 판정

- 계획, 구현, QA, 통합, 배포 상태를 분리한다.
- 코드 존재만으로 `IMPLEMENTED`, 테스트 존재만으로 `PASS`, PASS만으로 `INTEGRATED` 또는 배포 완료라고 선언하지 않는다.
- QA 결과에는 대상 SHA, 실행 명령 또는 수동 시나리오, PASS/FAIL/BLOCKED/NOT RUN을 기록한다.
- 과거 SHA의 QA 결과를 이후 변경에 자동 승계하지 않는다.
- 기능 완료가 자동 merge 승인을 뜻하지 않는다.

## 변경 및 승인 게이트

- 제품 방향 변경: Master Plan과 Decision Log 갱신 및 사용자 승인
- 기능 계약 변경: 해당 Feature Spec 갱신
- 공통 UI 원칙 변경: DESIGN 및 Design Variants 검토
- 공통 IPC, 저장, 권한, DB schema 변경: 영향 기능과 migration/rollback/QA 계약 확인
- merge, rebase, cherry-pick, push, PR, 배포, 운영 DB 변경: 명시적 사용자 승인
- Governance 문서는 공식 통합 기준 브랜치에서 관리하며 다른 worktree에 자동 전파된다고 가정하지 않는다.

## Worktree 보호

- 다른 worktree의 미커밋 파일이나 로컬 전용 커밋을 수정·이동·삭제하지 않는다.
- 동시에 변경된 HEAD를 발견하면 현재 SHA를 기록하고 작업을 되돌리지 않는다.
- 기능 통합은 승인된 clean integration worktree에서 수행한다.
- dirty worktree를 통합 기준이나 증거의 완전한 원본으로 단정하지 않는다.

## 문서 갱신

- 전체 목표·우선순위: `BOGUNON_DESK_MASTER_PLAN.md`
- 확정 의사결정: `docs/DECISION_LOG.md`
- 기능 계약: `docs/FEATURE_SPECS/*.md`
- 실제 개발·QA snapshot: `docs/WORKTREE_STATUS.md`
- 공통 디자인: `DESIGN.md`
- 디자인 branch 차이: `docs/DESIGN_VARIANTS.md`

제안과 확정을 구분하고 모든 근거에 branch와 SHA를 남긴다. 날짜를 알 수 없는 결정을 임의의 날짜로 만들지 않는다.

## 종료 및 handoff

전역 Development Closure & PC Handoff 규칙을 그대로 적용한다. Git sync와 full handoff verdict를 구분하고, ignored·out-of-repo 증거와 민감정보 검사를 포함한다.
