# UX-08 TD2·쌤보드 기반 메뉴 및 위젯 UX 재검토

> 상태: **설계 검토 PASS / 실제 UI 구현 NOT RUN**<br>
> 기준: `integration/electron-feature-baseline` / `9e3ead09927aff4535aa422c3c15831dc4de6c89`<br>
> 조사일: 2026-11-13<br>
> 범위: 실제 Windows 화면 관찰, 저장소·Git 이력·승인 캡처 비교, 익명화 시안. 업무 로직·AI 연결·데이터·UI 소스는 변경하지 않았다.

## 1. 결론

현행 BOGUNON DESK를 “쌤패스형 상시 좌측 메뉴 프로그램”으로 단정할 수는 없다. 실제 설치 앱에서 확인한 Dashboard는 **하단 Dock과 독립 위젯 중심**이고, 업무 도구함은 overlay, 공문작업실은 **상단 3개 탭과 편집/미리보기 2열**이다. 세 화면에는 상시 좌측 메뉴가 없다.

상시 좌측 내비게이션이 실제로 확인되는 대표 영역은 독립 Settings다. Settings의 148px 열은 설정 정보 구조에 맞고 820px 이하에서 가로 스크롤형 상단 내비게이션으로 전환된다. 업무 모듈 전반의 전역 메뉴가 아니라 **설정 전용 패턴**으로 유지하는 편이 안전하다.

재검토가 필요한 실제 문제는 다음과 같다.

1. Newsletter는 상시 전역 메뉴 대신 330px(1040px 이하 280px) 편집 도구 열을 사용하지만, 파일 도구막대·mode tabs·편집 열이 동시에 나타나 단계와 파일 작업의 위계가 약하다.
2. Dock, Dashboard의 빠른 실행, 업무 도구함이 같은 실행 기능을 반복해 “어디에서 시작해야 하는지”가 분산된다.
3. 1050px 이하에서는 업무 편집기가 1열로 전환되지만, 현재 단계·다음 단계·보조 도구를 구분하는 공통 패턴이 없다.
4. Settings의 좌측 내비게이션을 일반 업무 모듈까지 확대하면 TD2의 desktop canvas → widget objects → live work data 계층과 충돌한다.

따라서 권고안은 **전역 좌측 메뉴 폐기**가 아니라 다음의 경계 확정이다.

- Dock: 실행과 복귀
- Desktop Palette: 작은 정보 확인과 짧은 입력
- Workspace: 본격 편집, 현재 단계 도구만 노출
- 독립 Settings: 계정·기기·화면·연결 설정; 설정 전용 내비게이션 유지

## 2. 조사 근거와 한계

### 2.1 확인한 저장소 자료

- `DESIGN.md`: Desktop Workspace 정체성, TD2 Soft Rose Glass 승인 계약, Dock·Widget·Settings·좁은 창 규칙
- `docs/evidence/td2-soft-rose-glass/approved-1280x800.png`
- `docs/evidence/td2-soft-rose-glass/approved-1440x900.png`
- `docs/evidence/td2-soft-rose-glass/MANIFEST.md`
- `docs/qa/TD2-WORKSPACE-UNIFICATION.md`
- `docs/qa/TD2-FUNCTIONAL-STABILITY.md`
- `docs/qa/TD2-FLOATING-B-CLOUD-B.md`
- `docs/qa/SCHOOL-TD2-CANDIDATE.md`
- UX-07B~07F Git 이력과 인계 문서: Workspace 창 수명, Palette, Desktop-first 전환, 독립 Settings, 멀티모니터 팔레트/프로필, 통합 표현 검증
- 현재 구현: `electron-p0/renderer/P0App.tsx`, `electron-p0/renderer/ui/WorkspaceShell.tsx`, `electron-p0/renderer/td2-workspace.css`, `src/newsletter/NewsletterStudio.tsx`, `src/newsletter/newsletter-studio.css`, `src/components/desktop/DesktopSettingsPanel.tsx`, `src/styles/dashboard.css`

UX-07의 실제 계약은 다음과 같이 이어진다.

| 단계 | 확인된 계약 | UX-08 영향 |
|---|---|---|
| UX-07B | 단일 Workspace 창 수명과 모듈별 미저장 guard 유지 | 단계 이동이 모듈 owner를 unmount하면 안 됨 |
| UX-07C | 별도 Desktop Palette, 제한된 preload, Dock 미복제 | Palette에 Workspace 내비게이션·업무 데이터 owner를 넣지 않음 |
| UX-07D | Desktop-first surface와 guarded navigation, 독립 Settings renderer | Settings와 Workspace 내비게이션을 합치지 않음 |
| UX-07E | 모니터별 Palette와 로컬 프로필 | 시안이 Palette 위치·크기·모니터 프로필을 덮어쓰지 않음 |
| UX-07F | 통합 디자인 표현과 작은 창 QA | 새 공통 패턴은 980×700/900×680에서 별도 검증 필요 |

### 2.2 TD2·TeacherDesk에서 실제 확인된 패턴

저장소의 승인된 BOGUNON 캡처와 설계 계약에서 확인된 패턴은 다음과 같다.

- 독립된 크기와 비율의 위젯 객체
- 위젯 사이의 의도적인 여백
- 하단의 아이콘 중심 Dock/launcher shelf
- Dashboard와 Dock의 별도 스크롤·행 영역
- 설정이나 편집 chrome이 기본 View mode의 주인공이 되지 않음
- 작은 창에서 콘텐츠를 숨기거나 글자를 과도하게 줄이지 않고 2열→1열로 reflow

TeacherDesk 공식 공개 페이지는 일정·할 일·업무 기록의 통합, 가볍고 빠른 사용, 데스크톱 자동 실행, 단순하고 직관적인 인터페이스를 설명한다. 저장소 정책대로 공간 문법만 참고하며, 제3자 시각 자산·아이콘·기능은 복제하지 않는다.

- 외부 출처: [TeacherDesk 공식 사이트](https://www.tdesk24.com/) (2026-11-13 확인)
- 공개 페이지의 현재 제품 설명만 참고했으며, 화면·아이콘·브랜드 자산은 저장하거나 복제하지 않았다.

### 2.3 쌤보드 근거 상태

현재 worktree, 전체 로컬/원격 ref의 텍스트 이력, 공개 검색에서 **‘쌤보드’를 특정할 수 있는 원본 캡처·설계 문서·공식 제품 페이지를 확인하지 못했다.** 따라서 이 문서는 쌤보드의 구조를 추정하거나 “쌤보드 패턴”이라고 이름 붙여 구현 근거로 사용하지 않는다.

추후 사용자가 당시 참고 캡처나 링크를 제공하면, 이 문서의 TD2/BOGUNON 근거와 분리해 출처·날짜·적용 가능 범위를 다시 기록해야 한다.

### 2.4 실제 Windows 관찰 범위

2026-11-13 설치된 BOGUNON DESK 창을 실제 Windows에서 열어 Dashboard, Dock, 업무 도구함, 공문작업실을 관찰했다.

- Dashboard: 상시 좌측 메뉴 없음, 위젯 canvas + 하단 Dock
- Dock: 홈/온라인 보건실/BOGUNON/업무 도구/업무 폴더/빠른 메모/설정/공문작업실
- 업무 도구함: 카테고리별 실행 항목을 overlay로 제공; Dock의 업무 도구·공문작업실과 진입 기능이 중복
- 공문작업실: 상단 3개 업무 탭, 좌측 입력/우측 결과 2열, modal overlay, Dock은 배경에 남음
- 개인정보 보호: 실제 화면 캡처에는 학교 식별 정보와 일정이 있어 저장소에 새 증거 파일로 넣지 않았다. 본 문서 시안은 모두 익명화했다.

Newsletter와 Electron 독립 Workspace는 현재 설치된 Tauri 운영 앱에서 직접 열 수 있는 동일 surface가 아니므로, 현재 branch의 소스·승인 증거·기존 Windows QA 계약을 근거로 검토했다. 이 문서는 새 native QA PASS를 주장하지 않는다.

## 3. 현행 메뉴 구조의 문제점

### 3.1 “좌측 메뉴가 항상 표시되는가”에 대한 판정

| 화면 | 상시 좌측 메뉴 | 접기 | 콘텐츠 점유 | 작은 창 동작 | 작업 보존 |
|---|---:|---|---|---|---|
| Dashboard | 없음 | 해당 없음 | 위젯 canvas 중심 | compact/reflow + workspace scroll | widget/session owner 유지 |
| 업무 도구함 | 없음 | 닫기 가능 | overlay가 우측/중앙 작업면 일부 가림 | 내부 scroll 필요 가능 | 실행 전 Dashboard 유지 |
| 공문작업실 | 없음 | 모달 닫기 | 편집/미리보기 2열 | Electron CSS는 1050px 이하 1열 | session owner가 닫기 처리 |
| Newsletter | 전역 nav 없음; 330px 편집 도구 열 | 별도 접기 없음 | 일반 창 약 23%, 1040px 이하 280px | 760px 이하 상하 1열 | keep-alive + revision guard |
| 독립 Settings | 148px 설정 nav | 직접 접기 없음 | 설정 창 내부 고정 열 | 820px 이하 상단 가로 nav | Settings owner 유지 |
| SCHOOL Workspace | 상단 semantic task nav | 가로 scroll | 좌측 점유 없음 | 900×680 계약 | 연결/권한 gate 유지 |

즉, 상시 좌측 메뉴 문제는 **전역 제품 문제로 재현되지 않았다.** Newsletter 편집 열과 Settings 내비게이션을 같은 종류의 “좌측 메뉴”로 취급하면 잘못된 해결책이 나온다.

### 3.2 실제 개선이 필요한 부분

#### 진입점 중복

Dock, Dashboard 빠른 실행, 업무 도구함이 모두 실행 진입점을 제공한다. 중복 자체는 접근성에 도움이 될 수 있으나 다음 원칙이 없다.

- Dock에 항상 둘 기능
- Dashboard 위젯에서 최근/문맥상 노출할 기능
- 업무 도구함에서만 탐색할 저빈도 기능

공문작업실처럼 Dock과 업무 도구함에 동시에 영구 노출된 기능은 “즐겨찾기/최근 사용” 규칙을 명시해야 한다.

#### Newsletter 정보 위계

Newsletter는 파일 열기·저장·이미지 연결, 새 문서 작성, AI 보조, 원고/디자인 mode, revision, 편집 도구가 여러 수평·수직 영역에 흩어져 있다. 좌측 메뉴 제거보다 먼저 **파일 작업 / 5단계 흐름 / 현재 단계 도구**를 분리해야 한다.

#### 작은 창

CSS는 1040px에서 편집 도구 열을 330→280px, 760px에서 1열로 바꾼다. 980×700에서는 여전히 280px 열이 남아 실제 콘텐츠 폭의 약 29%를 점유한다. 높이 700px에서는 파일 도구막대와 mode tabs가 먼저 공간을 사용해 미리보기의 유효 높이가 줄 수 있다.

#### 작업 소실 위험

현재 `P0App`은 Newsletter keep-alive, Finance dirty guard, Workspace owner를 각각 보존한다. 새 단계형 도구가 route 전환이나 key 재생성으로 구현되면 원고·revision·selection이 사라질 수 있다. UX 변경은 **표현 상태만 전환**하고 기존 owner를 그대로 유지해야 한다.

## 4. 역할 정의

### Desktop Dock

- 앱 전체의 빠른 실행과 열린 작업 복귀
- 아이콘 중심, tooltip/focus/active marker 유지
- 자주 쓰는 모듈만 표시; 전체 카탈로그는 업무 도구함이 담당
- 기존 `DesktopActionId`, 저장 순서, 숨김/복원, identity 기반 색상 유지
- 모듈 내부 단계(월 선택/원고/출력)는 Dock에 넣지 않음

### Desktop Palette

- 오늘 일정, 할 일, D-Day, 메모처럼 작은 정보 확인과 짧은 입력
- 독립 위치·크기·모니터별 프로필 유지
- Workspace의 파일, 원고, 개인정보, Main-only IPC를 직접 투영하지 않음
- Palette에서 모듈을 열 수는 있지만 편집 owner는 Workspace 한 곳에만 둠

### Workspace

- 공문, Newsletter, Inventory, Finance 등 본격적인 편집 공간
- 전역 상시 좌측 메뉴를 추가하지 않음
- 상단에는 뒤로/제목/현재 문맥/핵심 행동만 배치
- 단계형 업무는 compact step bar, 현재 단계 도구는 좌측 보조 패널 또는 작은 창 bottom sheet
- 보조 패널을 닫아도 문서/selection/revision/session 유지

### 독립 Settings

- 계정, 화면, 연결, AI, 이 PC, 멀티모니터 프로필
- 설정 전용 좌측 nav는 일반 창에서 유지하고 좁은 창에서는 기존 상단 가로 nav 사용
- Workspace의 업무 단계와 섞지 않음
- UX-07D/E의 singleton, preload, 권한, 모니터 설정 authority 유지

## 5. 업무 모듈별 개선안

| 모듈 | 현행 패턴 | 권고 | 금지/보존 |
|---|---|---|---|
| 공문작업실 | 상단 3 mode + 2열 | 현행 유지. mode tab과 AI disclosure의 시각 위계만 INT/후속 QA에서 확인 | session-only, 개인정보 preflight, import/IPC 계약 변경 금지 |
| Newsletter | 파일 toolbar + mode tabs + 330/280px 편집 열 | 5단계 step bar 도입, 파일 작업은 header overflow/파일 메뉴로 묶고 현재 단계 도구만 노출 | revision, JSON/project save, image hash 연결, NS-05 provider 변경 금지 |
| Inventory | header + 요약/검색 + 목록/상세 2열 | module mode는 segmented control, 상세는 선택 문맥 패널. 전역 sidebar 금지 | item→lot→movement와 격리 저장 계약 유지 |
| MY FINANCE | hero + area tabs + editor | 상단 area tabs 유지, 자산/거래 편집 도구는 문맥 action | SQLCipher/DPAPI, dirty close guard 유지 |
| Purchase Helper | toolbar + tabs + table | 단계가 연속이면 compact segmented step, table 폭 우선 | session-only, 계산/내보내기 계약 유지 |
| Education Video | 검색 + 결과/편집 1.5:1 | 검색 조건은 접을 수 있는 상단 filter, 결과 선택 후 편집 패널 | 합성 Mock 표시, 검색 provider/보관함 계약 유지 |
| SCHOOL | 상단 semantic task nav | 현행 유지; 좁은 창 horizontal scroller 보존 | 권한/연결/MFA gate 변경 금지 |
| Settings | 148px 설정 nav | 유지. 작은 창의 기존 상단 전환을 QA | Workspace용 패턴으로 복제 금지 |

## 6. 보건소식지 제작소의 5단계 흐름

### 1) 월 선택

- 작성 월과 학교 유형 선택
- 새 문서가 기존 revision/임시 작업에 미치는 영향 명시
- 다음 단계로 이동해도 생성 전에는 기존 문서를 변경하지 않음

### 2) AI 제작

- NS-05가 제공하는 기존 AI 연결 상태와 전송 전 검토를 사용
- provider/model/key 저장 정책을 UX-08에서 변경하지 않음
- AI 미연결 시 deterministic/manual 흐름을 막지 않음
- 외부 전송 범위와 개인정보 검토를 현재 단계 안에서 표시

### 3) 원고 검토

- 주제·본문·승인 상태 중심
- AI 결과와 사용자 원고를 구분
- 편집 즉시 “검토 완료”로 추정하지 않음

### 4) 디자인 편집

- 기존 `NewsletterDesignEditor`와 출력 canvas 유지
- 330px 도구 열은 일반 창에서 펼침/접힘 가능한 “현재 단계 도구”로 재정의
- 작은 창에서는 미리보기 아래/위로 이동 가능한 sheet로 표현

### 5) 출력

- PNG/PDF/프로젝트 저장의 사전 검증 상태 표시
- 파일명, 대상, revision을 최종 확인
- build/export 성공을 디자인 검토 PASS로 오인하지 않음

단계 이동은 기존 문서 owner를 unmount하지 않고, `NewsletterStudio`의 keep-alive와 busy/close guard를 유지해야 한다.

## 7. Windows 크기별 시안

### 1440×900

- Workspace header 64~72px
- 5단계 step bar 72~82px
- 편집 단계에서만 320~360px 도구 패널 + 유연한 미리보기
- Dock은 Workspace 안에 중복 표시하지 않고 Desktop으로 돌아갈 때 사용
- 한 화면에서 “현재 단계/다음 행동/문서 상태”가 보이도록 함

### 1280×720

- header action은 중요도에 따라 primary 1개 + overflow
- step label은 유지하되 설명 문구 생략
- 도구 패널 280~300px 또는 접힘 상태 시작
- 미리보기와 문서 편집은 내부 스크롤을 명확히 분리
- 높이 720px에서는 sticky header/footer가 콘텐츠를 과도하게 가리지 않는지 확인

### 980×700

- 좌측 보조 패널 기본 미표시
- step bar는 한 줄 가로 scroll 또는 `3/5 원고 검토` compact 표현
- 현재 단계 도구는 상단 버튼으로 여는 non-destructive sheet
- 편집/미리보기 1열, 중요 콘텐츠가 먼저
- Dock과 modal footer가 겹치지 않아야 함

### 고 DPI

- 125%/150% renderer zoom과 실제 Windows display scale은 구분해 기록
- 980×700 CSS viewport, 900×680 native outer bounds, actual maximize를 별도 캡처
- focus ring, 40px target, CJK 줄바꿈, modal header/close, Dock tooltip을 확인
- 멀티모니터에서는 각 display의 DIP bounds/workArea/scaleFactor와 Palette profile 복원 확인

## 8. 비교 시안 목록

1. [현행 메뉴 구조](evidence/ux08-navigation-review/01-current-menu.svg) — 실제 관찰과 현재 소스의 익명화 재현
2. [TD2·TeacherDesk 근거 구조](evidence/ux08-navigation-review/02-reference-patterns.svg) — 검증된 패턴과 쌤보드 근거 부재를 분리
3. [좌측 메뉴 축소 시안](evidence/ux08-navigation-review/03-collapsed-left-menu.svg) — **비권고 비교안**. 980×700 frame은 축척 캡처가 아니라 동작·정보 위계 가설이다.
4. [상단 도구 중심 Newsletter 시안](evidence/ux08-navigation-review/04-top-tools-newsletter.svg) — 5단계 흐름
5. [Dock·Palette·Workspace·Settings 역할 분리](evidence/ux08-navigation-review/05-role-separation.svg)

시안은 의사결정용 구조 wireframe이며 TD2 material fidelity나 실제 viewport 검증 증거가 아니다. 실제 UI 소스, 라우팅, 저장 구조, 업무 로직을 변경하지 않는다. 원본 SVG와 동일 내용의 PNG 렌더, 조사 provenance와 SHA-256은 같은 폴더의 `MANIFEST.md`에 기록한다.

## 9. 변경 범위와 회귀 위험

| 위험 | 수준 | 원인 | 대응 |
|---|---|---|---|
| Newsletter 작업 소실 | HIGH | 단계 UI가 editor를 unmount/key reset | 기존 keep-alive owner 유지, 단계는 표현 state만 변경 |
| NS-05 충돌 | HIGH | AI 단계를 새 provider 흐름으로 구현 | 기존 `renderAiTools`/settings handoff만 사용, 연결 계약 변경 금지 |
| 작은 창 접근 불가 | HIGH | sticky chrome·sheet·Dock 중첩 | 980×700/900×680/short-height native QA |
| revision/출력 혼동 | HIGH | 단계 완료를 자동 추정 | 명시적 상태만 표시, export와 승인 분리 |
| Dock/도구함 중복 | MEDIUM | 동일 영구 진입점 | Dock=즐겨찾기, 도구함=전체 카탈로그 규칙 정의 |
| Settings 회귀 | MEDIUM | 전역 nav 제거가 설정까지 영향 | Settings는 별도 범위, 기존 nav/authority 유지 |
| Palette 권한 확장 | HIGH | 업무 데이터/IPC를 위젯에 투영 | 기존 제한 preload와 Main-only 경계 유지 |
| 디자인 토큰 분산 | MEDIUM | Newsletter 고유 mint/ivory와 TD2 rose 혼합 | chrome만 공통 token, 출력 canvas는 newsletter domain 유지 |
| CJK clipping | MEDIUM | compact step label/좁은 toolbar | keep-all + overflow fallback, 실제 125/150% 확인 |

## 10. 구현 우선순위

### P0 — 구현 전 계약 고정

1. 쌤보드 원본 자료 존재 여부를 사용자에게 확인한다.
2. Dock/빠른 실행/업무 도구함의 노출 규칙을 정한다.
3. Newsletter의 5단계와 기존 state owner 매핑을 문서화한다.
4. NS-05가 소유하는 AI 연결 경계와 UX-08이 소유하는 단계 표현 경계를 확정한다.

### P1 — 최소 시제품(별도 승인 필요)

1. Newsletter에 비파괴적 step bar만 추가한다.
2. 파일 도구를 header action/overflow로 재배치한다.
3. 디자인 편집 도구 열의 접힘 상태를 UI-only state로 추가한다.
4. 980×700에서는 sheet 표현을 사용하되 editor owner를 유지한다.

### P2 — 공통 Workspace primitive

1. `WorkspaceHeader`, compact step bar, contextual tools disclosure를 재사용 가능한 presentation primitive로 정리한다.
2. 공문/Inventory/Education Video에는 필요한 primitive만 적용한다.
3. SCHOOL과 Settings는 기존 semantic nav를 유지한다.

### P3 — 실제 Windows 검증

1. 1440×900, 1280×720, 980×700
2. 125%/150% zoom 및 실제 DPI
3. keyboard/focus/scroll/modal/Dock overlap
4. Newsletter busy/close/revision/restore
5. 다중 모니터 Palette profile 비회귀

## 11. 사용자 확인이 필요한 결정

전체 메뉴 교체 전에 다음 세 가지만 확인해야 한다.

1. “쌤보드”가 어떤 제품/캡처를 의미하는지 원본 자료를 제공할 수 있는가?
2. Newsletter 5단계 중 AI 제작을 독립 단계로 항상 보일지, AI 연결 시에만 보조 단계로 열지?
3. Dock에는 공문작업실처럼 즐겨찾은 모듈만 둘지, 현재처럼 일부 고정 모듈을 유지할지?

이 확인 전에는 전역 메뉴 교체, 모듈 라우팅 변경, AI 연결 변경을 시작하지 않는다.

## 12. 보존 확인

- 업무 로직 변경: 0건
- UI/CSS 제품 코드 변경: 0건
- NS-05 AI provider/model/key 계약 변경: 0건
- revision·사용자 데이터 변경: 0건
- Dock·Palette·멀티모니터 동작 변경: 0건
- 다른 worktree 변경/정리: 0건
- main 병합·배포: 0건
- 새 산출물: 본 검토 문서, 익명화 SVG 5개, 동일 내용 PNG 5개, 증거 manifest 1개
