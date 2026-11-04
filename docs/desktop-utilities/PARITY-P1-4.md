# PARITY-P1-4 — 계산기·명령 팔레트·빠른 추가

기준: `5cfdee00765d5ab11a9076028b4e6e4c1afc5292`.
브랜치: `feature/electron-desktop-utilities`.
이전 Windows QA run `41854402237`은 사용자 제공 기준본 근거이며, 이번 기능의 Windows 실검증 결과로 승계하지 않는다.

## 원본 계약과 재사용

- `CalculatorPanel`, `calculatorMachine`/arithmetic/percentage/dateDifference/units의 원본 UI·상태·연산을 재사용한다. 일반 계산(14자리 입력, 사칙연산, 소수점, 부호, 퍼센트, backspace, 초기화), 퍼센트 3종, 날짜 차이, 단위 변환, 명시적 결과 복사를 복원했다. eval/Function/OS 계산기를 사용하지 않는다.
- `CommandPalette`에서 순수 표시·검색·선택 UI를 `CommandPaletteView`로 분리했다. 기존 Tauri wrapper는 같은 server search hook을 주입해 원래 흐름을 유지한다. Electron은 로컬 검색 상태와 지원 command registry만 주입한다. `commandKeyboard`, `paletteItems`, 검색 필터를 재사용한다.
- 업무 폴더의 기존 순수 검색 함수만 별도 모듈로 분리해 재사용했다. 기존 service export/API와 Main ID 기반 열기 계약은 유지한다. 경로 문자열을 명령으로 해석하지 않는다.
- `QuickAddPanel`의 폼·pending guard·입력·저장/취소 UI와 순수 task validator를 재사용한다. 기본 Tauri mode는 계정/서버 업무·일정 계약을 유지하고, Electron mode만 별도로 명시한다.
- `useDesktopNavigation` 및 desktop action registry를 조사했다. 기존 Tauri hook 전체를 이식하면 다른 작업실을 닫고 서버/설정 경로를 불러오므로, Electron에서는 기존 `P0App.navigate`와 편집 콜백을 사용한다. 다른 모듈·미커밋 작업을 자동으로 닫거나 합치지 않는다.

## 기능별 판정

| 기능 | 코드/Cloud 검증 | 제한 |
| --- | --- | --- |
| 계산기 | **FULL** | 원본 4개 탭·연산·오류·복사·닫기/재열기 복원. 실제 Windows clipboard/GUI는 NOT VERIFIED |
| 명령 팔레트 | **PARTIAL** | 지원되는 로컬 명령·폴더 검색/실행 복원. Tauri 계정/서버 업무 검색·미지원 외부 연결 명령 제외 |
| 빠른 추가 | **PARTIAL** | 기존 Electron 로컬 업무의 제목·수행일·마감일·4분류·중요도 저장. 독립 시간 일정·Tauri 서버 일정·계정 동기화 제외 |
| Windows GUI/OS 단축키/Portable | **NOT VERIFIED / NOT RUN** | 새 실행/캡처/패키징 없음. 기존 TD2 PARTIAL을 PASS로 바꾸지 않음 |

## 계산기·팔레트·진입 경로

- 기존 Dock의 업무 도구 메뉴에 계산기/명령 팔레트/로컬 빠른 추가를 추가했다. Dock ID/순서·저장 JSON은 변경하지 않는다. Dashboard의 기존 빠른 추가, 달력 날짜, Quick Memo 업무 전달도 같은 로컬 폼으로 연결한다.
- 계산기는 닫고 다시 열면 원본처럼 초기 상태로 시작한다. 계산 불가 결과 복사는 차단하고 복사 오류는 안전한 안내만 표시한다.
- Ctrl+K는 원본의 **포커스된 renderer 내** 단축키다. Main/globalShortcut 등록·OS 전역 hook·새 계산기/빠른 추가 shortcut은 추가하지 않는다. Main 소스에서 Ctrl+K accelerator/globalShortcut 경로가 없음을 확인했다. 실제 Windows 충돌 여부는 NOT RUN이다.
- 다른 모달/작업실, IME composition, 반복 키, Alt/Meta/Shift 조합에서는 새 팔레트를 열지 않는다. 이미 열린 팔레트의 Ctrl+K는 검색 입력으로 포커스만 이동한다. 계산기는 입력 요소·상위 inert modal·수정 키/IME 입력을 가로채지 않는다.
- 기존 `SurfaceDialog`의 focus trap/inert/Escape/호출자 복귀를 재사용한다. 원본 패널은 선택적 embedded mode로만 넣고, 검색 결과 실행 후에는 기존 모달이 닫힌 다음 프레임에 대상 기능을 연다. 검색/Enter 실행은 동시·중복 요청을 막는다.
- 고정 allowlist 16개: quick-add/home/today-tasks/inbox/calculator/purchase-helper/official-document/toolbox/quick-memo/settings/work-folder/workspace/widget-library/presets/appearance/dock-editor. inbox는 실제 Electron 동작인 **로컬 업무 목록**으로 명확히 표시한다. today-tasks는 현재 Electron 로컬 업무 관리 진입을 유지한다.
- BOGUNON/온라인 보건실/업무포털 직접 연결 command는 실행 목록에 넣지 않는다. 기존 학교 행정 모듈의 연결은 그대로 유지한다. AED 등 미연결 기능의 검색 키워드도 Electron 목록에 넣지 않는다. 서버 검색 banner·계정 성공 표시는 없다.
- 공통 TD2 Glass/Dashboard geometry CSS는 변경하지 않는다. 새 패널 전용 폭과 기존 스크롤/고정된 모달 헤더·하단 조작 영역을 사용한다. 980×700/1280×800의 실제 geometry·DPI·렌더링은 미검증이다.

## 빠른 추가 저장 경계와 보호

- 기존 `LocalWorkspaceProvider.commit` → named tasks IPC → `LocalTaskStore`를 그대로 사용한다. 저장 위치는 `<Electron userData>/work-data/local-tasks/tasks.json` 및 `tasks.backup.json`, version 1/revision/LocalTask schema 그대로다. 원자적 저장·백업·충돌·손상 파일/복구 읽기 전용 보호를 재사용한다.
- Tauri validator로 제목/날짜/마감/우선순위를 검증하고 로컬 schema도 재검증한다. 원본 UI의 대응 가능한 category 값만 교육(training)/검진(studentHealthScreening)/행사(event)/보고(officialDocument)로 표시·매핑한다. 저장하지 못하는 영역 선택과 나머지 서버 category는 숨긴다.
- area는 기존 로컬 provider의 healthWork 의미를 유지한다. 시간 일정·별도 event를 task로 조용히 바꾸지 않으며 event 제출은 거절한다. 로컬 UI의 일정 탭은 미지원 안내와 함께 비활성화한다. 달력의 날짜 선택은 수행일을 지정한 **업무 추가**다.
- 사용자 저장 전 mutation 0회. 한 폼에 고정 UUID를 사용하고 원본 pending guard + 동기 lock을 적용한다. 응답 유실 후 새로 불러와 동일 요청을 재시도해도 이미 저장된 항목을 중복 생성/덮어쓰지 않는다.
- 저장 실패 시 기존 목록과 폼 입력을 유지한다. 저장 중에는 입력·저장·닫기를 막고 이미 진행 중인 원자적 저장을 취소 성공으로 위장하지 않는다. 취소 전에는 저장하지 않는다. unmount 후 늦은 응답은 닫기/알림 등 새 UI 상태에 반영하지 않는다.
- 저장 성공은 기존 provider를 통해 오늘 업무·주간/월간 날짜 표시·D-Day와 동기화한다. 서버 저장/인증 성공으로 표시하지 않는다. Finance/Inventory/학생 자료·Tauri 저장소를 조회하거나 이전하지 않는다.

## 집중 검증 및 인계

- Vitest **188 PASS**: 원본 계산/퍼센트/날짜/단위·키보드/command/filter/QuickAdd 계약, 신규 UI/실제 P0 진입·모달 handoff, 실제 합성 파일 저장/재실행·Dashboard 반영, 취소/쓰기 실패/응답 유실/중복/늦은 응답, 복구 읽기 전용, 기존 P0-1/P0-2/P1-1/P1-2/P1-3와 Surface/QA profile의 관련 최소 회귀. 반복 실행 합산이 아니다.
- Electron Main/Renderer/tests TypeScript 및 production build PASS. ASAR runtime graph 및 기존 5개 native resource/provenance 계약 **6 PASS**. 새로운 IPC/native CLI/의존성/workflow/Portable은 추가하지 않는다.
- 루트 타입 오류는 기준과 같은 기존 **13개**, 신규 오류 서명 **0개**. lint script가 없어 새 명령은 만들지 않았다. diff·민감정보·변경 범위 검사 수행.
- 실제 Windows clipboard·IME·OS 단축키·작은 창 GUI/캡처·Portable은 **NOT RUN**. 실제 API·학교/학생/금융 데이터는 사용하지 않는다. Cloud DOM 검증을 Windows GUI PASS로 간주하지 않는다.
- 기능 브랜치만 일반 push한다. 원격 통합 HEAD가 기준 SHA를 유지하면 Cloud B에서 fast-forward 가능하며, 이번 작업에서는 통합/main/배포를 변경하지 않는다.
