# IM-0 Git 기준선

조사일: 2026-10-23 (Asia/Seoul)

## 기준 선택

- 신규 worktree: `C:\Users\sehwa\Documents\GitHub\BOGUNON_DESK-inventory`
- 브랜치: `feature/inventory-management`
- 기준 SHA / 생성 직후 HEAD: `97f9ee9a6fe6ba93b7bfb7a89707902c7b4f2d96`
- 기준 ref: `origin/main`
- 근거: `git ls-remote --heads origin main`과 로컬 `origin/main`이 같은 SHA를 반환했다. 현재 기본 checkout의 `feature/desktop-surface-probe-9b1` HEAD나 Purchase Helper의 작업 HEAD를 기준으로 사용하지 않았다.
- 생성 직후 상태: clean. 신규 브랜치는 upstream 미설정이며 push하지 않았다.

## 주요 작업영역

| Repository / worktree | Branch | HEAD | Upstream / divergence | 상태와 보호사항 |
|---|---|---|---|---|
| BOGUNON DESK 기본 | `feature/desktop-surface-probe-9b1` | `160eec4e...` | `origin/feature/desktop-surface-probe-9b1`, 0/0 | clean, 읽기 전용 |
| Purchase Helper | `feature/purchase-helper-enhancement` | `888917b8...` | `origin/feature/purchase-helper-enhancement`, 0/0 | clean, 읽기 전용 |
| Inventory Management | `feature/inventory-management` | `97f9ee9a...` | 없음 | 본 문서만 작성 |
| 교육영상 Finder | `feature/education-video-finder` | `00961618...` | `origin/feature/education-video-finder`, 0/0 | 11개 미커밋 파일 확인. 전혀 수정하지 않음 |
| BOGUNON 기본 checkout | `codex/calendar-sticker-icons` | `d74b1539...` | 원격 추적 브랜치 존재 | `.gitignore`, `components/layout/responsive-detail-panel.tsx` 변경을 보존 |
| BOGUNON 물품 기능 Git ref | `codex/medication-lot-management` | `1191f3b6...` | 원격 SHA와 일치 | Git 객체만 읽음. checkout 변경 없음 |

등록된 다른 BOGUNON DESK worktree도 목록과 상태를 확인했다. 대부분 clean이었다. 일부 upstream 미설정 worktree와 별도 기능 worktree가 존재하므로 정리·삭제·브랜치 이동을 하지 않았다.

## 원격 최신성

- BOGUNON DESK `main`: 원격 `97f9ee9a...`를 `ls-remote`로 확인했다.
- BOGUNON 웹앱 `main`: 원격 `986d7191...`; 로컬 `main`은 당시 2커밋 뒤였다.
- BOGUNON 물품 기능 브랜치: 원격 `1191f3b6...`와 로컬 ref가 일치했다.
- fetch, merge, rebase, reset, clean, stash, cherry-pick은 실행하지 않았다.

## 규칙

`C:\Users\sehwa\.codex\AGENTS.md`의 Development Closure & PC Handoff v1.0을 확인했다. 저장소 루트에는 별도 AGENTS 파일이 없었다. `node_modules` 내부 AGENTS 파일은 해당 의존성 내부 작업이 아니므로 적용 범위 밖이다.

