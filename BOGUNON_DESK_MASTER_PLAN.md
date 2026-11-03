# BOGUNON DESK Master Plan

> 공식 기준 브랜치: `origin/main`
>
> 최초 작성 기준 SHA: `97f9ee9a6fe6ba93b7bfb7a89707902c7b4f2d96`
>
> 상태: 승인된 제품 방향과 확인된 저장소 상태를 구분해 관리하는 최상위 계획 문서

## 1. 문서의 역할

이 문서는 BOGUNON DESK의 제품 비전, 기능 경계, 확정 요구사항, 모듈 연결, 개발·통합·배포 순서를 정의한다. 실제 구현·QA·통합 상태는 [Worktree Status](docs/WORKTREE_STATUS.md), 기능별 계약은 [Feature Specs](docs/FEATURE_SPECS/README.md), 확정 결정은 [Decision Log](docs/DECISION_LOG.md)를 함께 확인한다.

계획, 구현, QA, 통합, 배포는 서로 다른 상태다. 코드나 문서가 존재한다는 이유만으로 완료 또는 배포됨으로 표시하지 않는다.

## 2. 제품 비전

BOGUNON DESK는 Windows에서 보건교사의 문서 제작, 파일 처리, 전문 업무 자동화와 최근 작업 연결을 지원하는 데스크톱 업무 환경이다. 일반 작업실 창과 Windows 바탕화면에 부착되는 Desktop Surface를 분리하고, 하단 Dock을 공통 진입점으로 유지한다.

기존 BOGUNON 웹앱의 연간 보건업무 캘린더를 DESK에 중복 구현하지 않는다. DESK는 로컬 파일·전문 작업·기능 간 결과물 연결에 집중한다. 물품관리는 공유 재고 단일 원장과 Purchase Helper 연계가 필요하므로 DESK 중심 구조로 별도 이전한다.

## 3. 확정 제품 방향

- Desktop Surface는 Always on Top 창이 아니라 Windows 바탕화면 부착형 업무 표면을 목표로 한다.
- 일반 작업실 창, Desktop Surface, 하단 Dock의 책임을 분리한다.
- 기능은 독립 worktree에서 개발하고 기능별 QA 이후에만 통합 후보가 된다.
- 기능 개발이 끝난 뒤 공통 디자인 원칙에 맞춰 전체 UI/UX를 통일한다.
- 검증된 기능만 최신 통합 기준에서 순차 병합하고 Windows 실기기 회귀를 수행한다.
- 보건교사는 DESK 관리자, 보건지원강사는 제한된 웹 사용자로 공유 재고를 사용한다.
- Inventory Management와 Purchase Helper는 구매 후보, 입고, 재고 갱신 흐름으로 연결한다.
- Newsletter Studio는 `sungandi86-max/otter-nest`와 `monthly-school-health-newsletter` 제작 규칙을 참고하되 Skill 자체를 Tauri에서 직접 실행하지 않고 독립 엔진으로 구현한다.
- PDF & Image Tools는 이음오피스의 처리 엔진을 필요한 범위로만 검토하며 Electron UI나 전체 앱을 복제하지 않는다.
- Workspace Library는 공문·교육·구매·소식지 결과물과 최근 작업을 로컬 우선으로 연결한다.

확정 결정의 정규 목록은 [Decision Log](docs/DECISION_LOG.md)를 따른다.

## 4. 제품 구성

| 영역 | 제품 역할 | 현재 상태 요약 |
|---|---|---|
| Desktop Surface | 바탕화면 위젯 표면과 부착·분리 런타임 | PARTIAL, 독립 Surface UI·RendererSession checkpoint 존재 |
| Dashboard / Dock | 위젯형 홈, 공통 진입, 배치·스타일 | INTEGRATED, 후속 Surface 디자인은 미통합 |
| Official Document Helper | 공문 작성·가져오기·요약·개인정보 확인 | IMPLEMENTED, 개선 브랜치 미통합 |
| Purchase Helper | 견적 분석·품의·정산·내보내기 | IMPLEMENTED, enhancement는 WIP |
| Inventory Management | 공유 재고 원장과 권한별 입출고 | PARTIAL, 설계 및 로컬 QA 자산 미통합 |
| Newsletter Studio | 월별 소식지·카드뉴스 제작 | PARTIAL, NS-2 WIP checkpoint이며 native QA pending |
| PDF & Image Tools | 이미지 PDF화, 순서·회전·A4, 병합·분할 | PLANNED |
| Education Video Finder | 교육영상 검색·검토·추천·저장 | PARTIAL, live/native 검증 미완료 |
| Record Helper | 생기부 자료 가져오기·비식별·AI 검토 | IMPLEMENTED, 최신 실기기 QA 미확인 |
| MY FINANCE | 개인 수입·지출·세금·백업 | INTEGRATED, 물리적 두 PC 왕복은 미검증 |
| Workspace Library | 결과물 정리·전달·최근 작업 재개 | PLANNED |
| 일정 및 업무 관리 | 달력·오늘 업무·D-Day·Inbox·Quick Add | INTEGRATED |
| 외부 서비스 연동 | Supabase·ChatGPT·BOGUNON·업무포털 | PARTIAL, 환경별 검증 필요 |

상세 상태와 근거는 [Feature Specs](docs/FEATURE_SPECS/README.md)와 [Worktree Status](docs/WORKTREE_STATUS.md)를 따른다.

## 5. 모듈 연결 구조

```text
Windows Desktop
├─ Main Workspace
│  ├─ Dashboard / Dock / 일정·업무
│  ├─ Official Document Helper
│  ├─ Purchase Helper ──> Inventory Management
│  ├─ Record Helper
│  ├─ Education Video Finder
│  ├─ Newsletter Studio
│  ├─ PDF & Image Tools
│  ├─ MY FINANCE (업무 데이터와 분리)
│  └─ Workspace Library (기능 결과물 연결)
├─ Desktop Surface
│  └─ 일정·오늘 업무·D-Day 등 제한된 projection
└─ External boundaries
   ├─ BOGUNON Web / Supabase
   ├─ ChatGPT/OpenAI 승인 흐름
   └─ 로컬 파일·승인 기반 백업
```

Desktop Surface renderer에는 Main 전용 업무 데이터와 IPC를 자동 노출하지 않는다. MY FINANCE 데이터는 보건업무 데이터 및 공유 재고와 분리한다. Workspace Library는 원본을 임의 복제하거나 외부로 전송하지 않고 사용자 승인에 따라 기능 간 참조를 연결한다.

## 6. 개발 및 통합 원칙

1. 작업 전 [프로젝트 AGENTS.md](AGENTS.md), 관련 Feature Spec, Decision Log, DESIGN, 실제 Git 상태를 확인한다.
2. 동일 기능이나 유사 기능이 다른 worktree에 존재하는지 먼저 조사한다.
3. 기능별 독립 worktree에서 구현하고 실제 구현 상태와 QA 상태를 분리해 기록한다.
4. 기능 QA PASS가 자동 통합 승인을 뜻하지 않는다.
5. 통합은 최신 `origin/main` 기반의 별도 clean worktree에서 수행한다.
6. dirty·untracked 자산을 통합 소스로 간주하지 않는다. 먼저 소유권·보존·검증 상태를 확정한다.
7. 공통 UI/UX 정리는 기능 안정화 이후 별도 디자인 통합 단계에서 수행한다.
8. Windows 릴리스는 통합 회귀, 설치·업데이트·제거 검증을 통과한 릴리스 후보만 진행한다.

## 7. 로드맵

### Phase 1 — 기능별 개발과 증거 보존

- 독립 worktree 개발
- 기능별 단위·통합·수동 QA
- 설계·QA 증거와 blocker 기록
- 미커밋·ignored·외부 증거의 안전한 보존

### Phase 2 — 공통 디자인 통합

- `DESIGN.md`의 main 기준과 기능별 디자인 차이 검토
- Navy·Mint·Ivory 토큰, Dock, 작업실 패널, 버튼·입력·카드 통일
- 창 크기, DPI, keyboard/focus, 접근성 검증

### Phase 3 — 순차 통합

- 최신 원격 main과 후보 SHA 고정
- 기능별 전체 의존 파일 및 IPC 검토
- 정적 병합과 회귀 검사
- 사용자 승인 후 순차 병합

### Phase 4 — Windows 릴리스

- 통합 회귀 및 Windows 실기기 QA
- 릴리스 후보 빌드
- 설치·업데이트·제거 검증
- 승인된 정식 배포
- 완료 worktree의 handoff 감사 후 안전한 정리

## 8. 상태 정의

구현 상태:

- `PLANNED`: 요구사항만 확정됨
- `PARTIAL`: 일부 코드·설계·검증이 존재하나 기능 경계가 미완성
- `IMPLEMENTED`: 기능 코드가 구현됐으나 main 통합 여부와 무관
- `INTEGRATED`: 승인된 기준 브랜치에 포함됨

QA 상태:

- `NOT RUN`, `PASS`, `FAIL`, `BLOCKED`, `NOT VERIFIED`

`PASS`에는 검증 대상 SHA와 검증 범위가 있어야 한다. 과거 SHA의 PASS를 이후 변경에 자동 승계하지 않는다.

## 9. 문서 갱신 책임

| 변경 | 갱신 문서 |
|---|---|
| 제품 목표·우선순위·모듈 관계 | 이 Master Plan |
| 기능 요구사항 | 관련 Feature Spec |
| 확정 결정 | Decision Log |
| Git·구현·QA 현황 | Worktree Status |
| 공통 UI/UX 원칙 | DESIGN.md |
| Codex 작업 절차 | AGENTS.md |
| 릴리스 절차와 사용자 변경 | RELEASE / CHANGELOG |

공식 버전은 통합 기준 브랜치에서 관리한다. ChatGPT·Drive 사본은 Git branch와 commit SHA를 표시하며 Git 공식본을 대체하지 않는다.
