# MY FINANCE

## 목적

개인 수입·지출·세금·자산을 보건업무 데이터와 분리해 로컬에서 관리하고 암호화 백업·복원을 제공한다.

## 확정 요구사항

- 개인 재무 데이터와 보건업무 데이터 분리
- 로컬 데이터 보호
- 백업·복원 및 충돌 차단 규칙 준수
- 실사용·운영 배포와 QA 전용 설치물 구분

## 현재 구현 범위

`origin/main@97f9ee9`에 Phase 1/2 UI, Rust commands, backup/restore, QA entrypoint와 배포 보호가 포함된다. `feature/my-finance-2-redesign@dc6772c` 및 여러 QA/CI worktree가 후속 이력을 가진다.

구현 상태: `INTEGRATED` for main baseline. redesign 후보는 별도다.

## QA 상태

`PASS` for documented scopes:

- SHA-pinned TESTABLE 자동 검증
- 동일 Windows 11 Pro PC의 서로 다른 사용자 간 암호화 백업 최초 이식·재실행 영속성 수동 PASS

미검증: 실제 물리적으로 다른 학교·집 PC 왕복, 모든 기관 정책, 장애·키 손실 복구. 근거는 [MY_FINANCE Windows QA](../MY_FINANCE_WINDOWS_QA.md), [Backup & Restore](../MY_FINANCE_BACKUP_RESTORE.md), [Phase 2](../MY_FINANCE_PHASE2.md)다.

## 아직 구현·확정하지 않은 범위

- redesign branch의 통합 여부
- 실제 두 PC 왕복 QA
- 장기 백업 보존·장애 복구 운영 승인

## 연결 관계

Main Workspace에서 별도 화면으로 진입하지만 보건업무, Inventory, Workspace Library의 공유 데이터 원장과 분리한다.

## 위험 및 다음 작업

로컬 전용 커밋이 있는 Finance worktree(↑9, ↑1)를 감사하고, 과거 PASS를 최신 redesign에 승계하지 않은 채 별도 회귀한다.
